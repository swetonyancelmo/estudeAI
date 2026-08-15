import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import type {
  ResourceContentDto,
  RoadmapResponseDto,
} from '@estudeai/shared-types';
import {
  RESOURCE_SEARCH_SYSTEM_INSTRUCTION,
  buildResourceSearchPrompt,
} from './resource-discovery.prompt';

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

const DEFAULT_MODEL = 'gemini-flash-latest';
const DEFAULT_BUDGET_MS = 40_000;
const DEFAULT_DELAY_MS = 250;
const DEFAULT_SEARCH_TIMEOUT_MS = 10_000;
const DEFAULT_URL_TIMEOUT_MS = 3_000;

/** Buscamos mais do que exibimos: a validação descarta parte dos candidatos. */
const YOUTUBE_CANDIDATES = 4;
const YOUTUBE_RESULTS = 2;
const WEB_CANDIDATES = 4;
const WEB_RESULTS = 2;

/**
 * Status em que um HEAD negado NÃO significa link morto: muitos servidores
 * (MDN, freeCodeCamp e afins) simplesmente não implementam ou não autorizam
 * HEAD. Descartá-los por isso jogaria fora justamente as melhores fontes, então
 * esses três — e só esses — ganham uma segunda tentativa com GET.
 */
const RETRY_WITH_GET = new Set([403, 405, 501]);

/** Sem user-agent de browser, uma parcela dos sites responde 403 a qualquer coisa. */
const USER_AGENT =
  'Mozilla/5.0 (compatible; estudeAI-link-check/1.0; +https://github.com/)';

/** Forma mínima da resposta de youtube/v3/search que realmente consumimos. */
interface YoutubeSearchResponse {
  items?: {
    id?: { kind?: string; videoId?: string; playlistId?: string };
    snippet?: {
      title?: string;
      thumbnails?: Record<string, { url?: string } | undefined>;
    };
  }[];
}

/**
 * Etapa 8 — descoberta de recursos gratuitos de estudo por tópico.
 *
 * Camada isolada no mesmo espírito do `RoadmapAiService` (CLAUDE.md §6): é o
 * único lugar do projeto que conhece a YouTube Data API, e trocar de fonte de
 * conteúdo não toca em mais nada.
 *
 * Duas invariantes governam este arquivo:
 *
 * 1. **Nenhum método público lança.** Recurso é enfeite: se a quota estourou, a
 *    API caiu ou o orçamento de tempo acabou, o tópico fica sem links e a
 *    geração do roadmap segue normalmente. O pior retorno possível é `[]`.
 *
 * 2. **URL só vem de fonte estruturada** — `id.videoId`/`id.playlistId` da
 *    YouTube API e `groundingMetadata.groundingChunks[].web.uri` do Gemini.
 *    Nada é lido do texto livre do modelo, que é a origem clássica de link
 *    inventado. E mesmo essas URLs só viram linha no banco depois de responder
 *    a uma requisição HTTP de verdade.
 */
@Injectable()
export class ResourceDiscoveryService {
  private readonly logger = new Logger(ResourceDiscoveryService.name);
  private client: GoogleGenAI | null = null;
  private missingKeysLogged = new Set<string>();

  constructor(private readonly config: ConfigService) {}

  /**
   * Anexa recursos aos tópicos de um roadmap recém-gerado (ou de um template
   * antigo, no backfill). Devolve uma CÓPIA — o `payload` que chega pode ser o
   * jsonb de um `RoadmapTemplate` compartilhado, então nada dele é mutado.
   *
   * Só busca para tópicos com `resources` AUSENTE. Um array vazio significa
   * "já buscamos e não sobrou nada válido" e não é retentado; ausência
   * significa "nunca buscamos" — é assim que um roadmap interrompido pelo
   * orçamento é completado no próximo cache hit, sem regastar cota nos tópicos
   * que já têm links.
   */
  async enrichRoadmap(
    roadmap: RoadmapResponseDto,
  ): Promise<RoadmapResponseDto> {
    if (!this.isEnabled()) {
      this.logger.debug(
        'Descoberta de recursos desabilitada — roadmap intacto.',
      );
      return roadmap;
    }

    const pending = roadmap.modules.flatMap((module, moduleIndex) =>
      module.topics
        .map((topic, topicIndex) => ({ topic, moduleIndex, topicIndex }))
        .filter((entry) => entry.topic.resources === undefined),
    );

    if (pending.length === 0) {
      return roadmap;
    }

    const found = await this.discoverWithBudget(
      pending.map((entry) => entry.topic.title),
    );

    const byPosition = new Map<string, ResourceContentDto[]>();
    pending.forEach((entry, index) => {
      const resources = found[index];
      if (resources) {
        byPosition.set(`${entry.moduleIndex}:${entry.topicIndex}`, resources);
      }
    });

    return {
      ...roadmap,
      modules: roadmap.modules.map((module, moduleIndex) => ({
        ...module,
        topics: module.topics.map((topic, topicIndex) => {
          const resources = byPosition.get(`${moduleIndex}:${topicIndex}`);
          return resources ? { ...topic, resources } : { ...topic };
        }),
      })),
    };
  }

  /**
   * Descoberta para tópicos que JÁ existem no banco (usada pelo reajuste).
   * Devolve um mapa id → recursos; ids ausentes do mapa não foram buscados
   * (orçamento estourado) ou não renderam nada.
   */
  async discoverForTopics(
    topics: { id: string; title: string }[],
  ): Promise<Map<string, ResourceContentDto[]>> {
    const byTopicId = new Map<string, ResourceContentDto[]>();
    if (!this.isEnabled() || topics.length === 0) {
      return byTopicId;
    }

    const found = await this.discoverWithBudget(
      topics.map((topic) => topic.title),
    );

    topics.forEach((topic, index) => {
      const resources = found[index];
      if (resources && resources.length > 0) {
        byTopicId.set(topic.id, resources);
      }
    });

    return byTopicId;
  }

  /**
   * Vídeos e playlists reais do YouTube. UMA chamada a `search.list` cobre os
   * dois tipos (`type=video,playlist`) — e isso não é economia de código, é
   * economia de cota: cada `search.list` custa 100 das 10.000 unidades diárias
   * gratuitas, então uma segunda chamada por tópico cortaria pela metade
   * quantos roadmaps cabem no dia.
   *
   * O preço dessa escolha é que os filtros `videoEmbeddable`/`videoDuration`
   * ficam indisponíveis (a API só os aceita com `type=video` puro); o recorte
   * educacional fica no `q` e no `safeSearch`. Gratuidade vem de graça: todo
   * conteúdo do YouTube é aberto.
   */
  async searchYoutubeResources(
    topicTitle: string,
  ): Promise<ResourceContentDto[]> {
    const apiKey = this.config.get<string>('YOUTUBE_API_KEY');
    if (!apiKey) {
      this.warnOnce(
        'YOUTUBE_API_KEY',
        'YOUTUBE_API_KEY ausente — os roadmaps sairão apenas com recursos web.',
      );
      return [];
    }

    const url = new URL(YOUTUBE_SEARCH_URL);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video,playlist');
    url.searchParams.set('q', `${topicTitle} tutorial curso`);
    url.searchParams.set('maxResults', String(YOUTUBE_CANDIDATES));
    url.searchParams.set('relevanceLanguage', 'pt');
    url.searchParams.set('regionCode', 'BR');
    url.searchParams.set('safeSearch', 'strict');
    url.searchParams.set('order', 'relevance');

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.searchTimeoutMs()),
      });

      if (!response.ok) {
        // 403 aqui é quase sempre quota diária estourada — vale um warn, não um
        // erro: o roadmap sai sem vídeos e ninguém fica sem roadmap por isso.
        this.logger.warn(
          `YouTube search falhou (HTTP ${response.status}) para "${topicTitle}".`,
        );
        return [];
      }

      const payload = (await response.json()) as YoutubeSearchResponse;
      const candidates = (payload.items ?? []).flatMap((item) => {
        const resource = this.toYoutubeResource(item);
        return resource ? [resource] : [];
      });

      return await this.keepValid(candidates, YOUTUBE_RESULTS);
    } catch (error) {
      this.logger.warn(
        `Erro na busca do YouTube para "${topicTitle}": ${this.describe(error)}`,
      );
      return [];
    }
  }

  /**
   * Artigos/sites via Gemini com Google Search grounding.
   *
   * O texto da resposta é DESCARTADO: as URLs saem exclusivamente de
   * `groundingMetadata.groundingChunks[].web.uri`, preenchido pela própria
   * busca do Google. (Com a tool `googleSearch` ligada a API nem aceitaria
   * `responseSchema`, então saída estruturada não é opção aqui — o que só
   * reforça a regra.)
   *
   * Detalhe que justifica o validador seguir redirects: na Gemini API esse
   * `uri` NÃO é o endereço do site, e sim um redirect do Vertex
   * (`vertexaisearch.cloud.google.com/grounding-api-redirect/...`) que expira
   * em cerca de 30 dias. Persistir o redirect daria link morto em um mês; como
   * a validação segue os redirects de qualquer forma, gravamos a URL final.
   */
  async searchWebResources(topicTitle: string): Promise<ResourceContentDto[]> {
    const client = this.getClient();
    if (!client) {
      return [];
    }

    try {
      const response = await client.models.generateContent({
        model: this.config.get<string>('GEMINI_MODEL') ?? DEFAULT_MODEL,
        contents: buildResourceSearchPrompt(topicTitle),
        config: {
          systemInstruction: RESOURCE_SEARCH_SYSTEM_INSTRUCTION,
          tools: [{ googleSearch: {} }],
          temperature: 0.2,
          abortSignal: AbortSignal.timeout(this.searchTimeoutMs()),
        },
      });

      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

      const candidates: ResourceContentDto[] = [];
      for (const chunk of chunks) {
        const uri = chunk.web?.uri;
        if (!uri) {
          continue;
        }
        candidates.push({
          // Título definitivo só depois de resolver a URL: `web.title` costuma
          // vir como domínio e pode faltar (ver `keepValid`).
          title: chunk.web?.title?.trim() ?? '',
          url: uri,
          type: 'article',
          source: 'web',
        });
        if (candidates.length >= WEB_CANDIDATES) {
          break;
        }
      }

      // Vídeo é assunto da outra fonte: se a busca devolver YouTube, descartamos
      // depois de resolver o redirect — antes disso o host real é invisível.
      return await this.keepValid(
        candidates,
        WEB_RESULTS,
        (resource) => !this.isYoutubeUrl(resource.url),
      );
    } catch (error) {
      this.logger.warn(
        `Erro na busca web (grounding) para "${topicTitle}": ${this.describe(error)}`,
      );
      return [];
    }
  }

  /**
   * Percorre os títulos SEQUENCIALMENTE, com intervalo entre eles: uma rajada
   * de 25 chamadas simultâneas ao YouTube é o jeito mais rápido de tomar 403 por
   * rate limit. O `deadline` é o teto de tempo do roadmap inteiro — a partir
   * dele os tópicos restantes voltam como `undefined` ("não buscado"), e não
   * como `[]`, para que um cache hit futuro complete o que faltou.
   *
   * Dentro de UM tópico as duas fontes vão em paralelo: são APIs diferentes, a
   * cota do YouTube continua sendo uma chamada por tópico, e isso corta o tempo
   * por tópico praticamente pela metade.
   */
  private async discoverWithBudget(
    titles: string[],
  ): Promise<(ResourceContentDto[] | undefined)[]> {
    const deadline = Date.now() + this.budgetMs();
    const delayMs = this.delayMs();
    const results: (ResourceContentDto[] | undefined)[] = [];
    let skipped = 0;

    for (let index = 0; index < titles.length; index += 1) {
      if (Date.now() >= deadline) {
        results.push(undefined);
        skipped += 1;
        continue;
      }

      if (index > 0 && delayMs > 0) {
        await this.sleep(delayMs);
      }

      const title = titles[index];
      try {
        const [youtube, web] = await Promise.all([
          this.searchYoutubeResources(title),
          this.searchWebResources(title),
        ]);
        results.push(this.dedupeByUrl([...youtube, ...web]));
      } catch (error) {
        // Rede de segurança: os dois métodos já engolem os próprios erros, mas
        // um tópico jamais pode derrubar o laço (e com ele a geração inteira).
        this.logger.error(
          `Falha inesperada ao descobrir recursos de "${title}": ${this.describe(error)}`,
        );
        results.push([]);
      }
    }

    if (skipped > 0) {
      this.logger.warn(
        `Orçamento de ${this.budgetMs()}ms esgotado: ${skipped} de ${titles.length} tópicos ficaram sem recursos (serão buscados num próximo cache hit).`,
      );
    }

    return results;
  }

  /**
   * Valida os candidatos e devolve no máximo `limit` sobreviventes, já com a
   * URL final. As validações de um mesmo tópico correm em paralelo (são 2 a 4
   * requisições curtas); o ritmo sequencial existe entre tópicos, por causa da
   * cota do YouTube, e não tem motivo para pesar aqui.
   */
  private async keepValid(
    candidates: ResourceContentDto[],
    limit: number,
    accept: (resource: ResourceContentDto) => boolean = () => true,
  ): Promise<ResourceContentDto[]> {
    const resolved = await Promise.all(
      candidates.map(async (candidate) => {
        const url = await this.resolveUrl(candidate.url);
        if (!url) {
          return null;
        }
        return {
          ...candidate,
          url,
          title: candidate.title.trim() || this.hostOf(url),
        };
      }),
    );

    const kept: ResourceContentDto[] = [];
    const seen = new Set<string>();

    for (const resource of resolved) {
      if (!resource || seen.has(resource.url) || !accept(resource)) {
        continue;
      }
      seen.add(resource.url);
      kept.push(resource);
      if (kept.length >= limit) {
        break;
      }
    }

    return kept;
  }

  /**
   * Confere que o link responde e devolve a URL FINAL (pós-redirect), ou `null`
   * para descarte silencioso. Nenhum link entra no banco sem passar por aqui.
   */
  private async resolveUrl(url: string): Promise<string | null> {
    if (!this.isHttpUrl(url)) {
      return null;
    }

    const timeoutMs = this.urlTimeoutMs();
    let status: number;

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': USER_AGENT, accept: '*/*' },
      });
      if (response.ok) {
        return response.url || url;
      }
      status = response.status;
    } catch (error) {
      this.logger.debug(`Link descartado (${url}): ${this.describe(error)}`);
      return null;
    }

    if (!RETRY_WITH_GET.has(status)) {
      this.logger.debug(`Link descartado (${url}): HTTP ${status}.`);
      return null;
    }

    try {
      // `Range: bytes=0-0` pede um byte só: confirma que a página existe sem
      // baixar o conteúdo. 206 (Partial Content) também é `ok`.
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': USER_AGENT,
          accept: '*/*',
          range: 'bytes=0-0',
        },
      });
      const finalUrl = response.url || url;
      await response.body?.cancel();

      if (response.ok) {
        return finalUrl;
      }
      this.logger.debug(
        `Link descartado (${url}): HTTP ${status} no HEAD e ${response.status} no GET.`,
      );
      return null;
    } catch (error) {
      this.logger.debug(`Link descartado (${url}): ${this.describe(error)}`);
      return null;
    }
  }

  /** Converte um item do search.list em recurso, ou `null` se não der. */
  private toYoutubeResource(item: {
    id?: { kind?: string; videoId?: string; playlistId?: string };
    snippet?: {
      title?: string;
      thumbnails?: Record<string, { url?: string } | undefined>;
    };
  }): ResourceContentDto | null {
    const title = this.decodeHtml(item.snippet?.title?.trim() ?? '');
    const thumbnails = item.snippet?.thumbnails;
    const thumbnailUrl =
      thumbnails?.medium?.url ??
      thumbnails?.high?.url ??
      thumbnails?.default?.url;

    const base = {
      title,
      source: 'youtube' as const,
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
    };

    if (item.id?.kind === 'youtube#video' && item.id.videoId) {
      return {
        ...base,
        type: 'video',
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      };
    }

    if (item.id?.kind === 'youtube#playlist' && item.id.playlistId) {
      return {
        ...base,
        type: 'playlist',
        url: `https://www.youtube.com/playlist?list=${item.id.playlistId}`,
      };
    }

    return null;
  }

  /** Cria (uma vez) o client do Gemini. Sem key, a busca web fica indisponível. */
  private getClient(): GoogleGenAI | null {
    if (this.client) {
      return this.client;
    }
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.warnOnce(
        'GEMINI_API_KEY',
        'GEMINI_API_KEY ausente — sem busca de recursos web.',
      );
      return null;
    }
    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }

  private dedupeByUrl(resources: ResourceContentDto[]): ResourceContentDto[] {
    const seen = new Set<string>();
    return resources.filter((resource) => {
      if (seen.has(resource.url)) {
        return false;
      }
      seen.add(resource.url);
      return true;
    });
  }

  private isEnabled(): boolean {
    return this.config.get<string>('RESOURCE_DISCOVERY_ENABLED') !== 'false';
  }

  private budgetMs(): number {
    return this.positiveNumber(
      'RESOURCE_DISCOVERY_BUDGET_MS',
      DEFAULT_BUDGET_MS,
    );
  }

  private delayMs(): number {
    const raw = this.config.get<string>('RESOURCE_DISCOVERY_DELAY_MS');
    const parsed = raw === undefined ? NaN : Number(raw);
    // Zero é válido aqui (desliga o intervalo), ao contrário dos timeouts.
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DELAY_MS;
  }

  private searchTimeoutMs(): number {
    return this.positiveNumber(
      'RESOURCE_SEARCH_TIMEOUT_MS',
      DEFAULT_SEARCH_TIMEOUT_MS,
    );
  }

  private urlTimeoutMs(): number {
    return this.positiveNumber(
      'RESOURCE_URL_TIMEOUT_MS',
      DEFAULT_URL_TIMEOUT_MS,
    );
  }

  private positiveNumber(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    const parsed = raw === undefined ? NaN : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private isHttpUrl(url: string): boolean {
    try {
      const protocol = new URL(url).protocol;
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  }

  private isYoutubeUrl(url: string): boolean {
    const host = this.hostOf(url);
    return (
      host === 'youtu.be' ||
      host === 'youtube.com' ||
      host.endsWith('.youtube.com')
    );
  }

  private hostOf(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  /** Títulos do YouTube vêm com entidades HTML (&quot;, &#39;, &amp;). */
  private decodeHtml(value: string): string {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  private warnOnce(key: string, message: string): void {
    if (this.missingKeysLogged.has(key)) {
      return;
    }
    this.missingKeysLogged.add(key);
    this.logger.warn(message);
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
