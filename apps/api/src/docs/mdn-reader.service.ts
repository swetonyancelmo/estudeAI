import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MDN_HOST,
  MDN_LOCALES,
  type MdnArticleDto,
} from '@estudeai/shared-types';
import { MdnArticle } from './entities/mdn-article.entity';
import { toMdnArticle, type MdnJsonDocument } from './mdn-article';
import { mdnJsonUrl, parseMdnUrl } from './mdn-url';

/** A MDN muda pouco: uma semana de cache poupa a fonte e deixa o leitor instantâneo. */
export const MDN_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Sobe a cada mudança no sanitizador ou no mapeamento (ver MdnArticle). */
export const MDN_ARTICLE_FORMAT = 1;
const FETCH_TIMEOUT_MS = 8_000;
/** Páginas da MDN têm 100–500 KB; acima disso algo está errado. */
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;

/**
 * Leitor da MDN dentro do estudeAI (Fase 2). Único lugar da API que fala com a
 * MDN.
 *
 * Só busca URLs que ELE monta a partir de um slug validado (`parseMdnUrl`), e
 * confere que o redirect final continua na MDN — o cliente não consegue fazer a
 * API buscar outro endereço.
 *
 * Prefere pt-BR; se a página não existe em português, usa a original em inglês.
 * Com a MDN fora do ar, serve a cópia do cache mesmo vencida.
 */
@Injectable()
export class MdnReaderService {
  private readonly logger = new Logger(MdnReaderService.name);

  constructor(
    @InjectRepository(MdnArticle)
    private readonly articles: Repository<MdnArticle>,
  ) {}

  async getArticle(url: string): Promise<MdnArticleDto> {
    const slug = parseMdnUrl(url);
    if (!slug) {
      throw new BadRequestException(
        'O leitor só abre páginas de documentação da MDN.',
      );
    }

    const cached = await this.articles.findOne({ where: { slug } });
    if (
      cached &&
      cached.formatVersion === MDN_ARTICLE_FORMAT &&
      Date.now() - cached.fetchedAt.getTime() < MDN_CACHE_TTL_MS
    ) {
      return cached.payload;
    }

    let article: MdnArticleDto | null;
    try {
      article = await this.fetchArticle(slug);
    } catch (error) {
      if (cached) {
        this.logger.warn(
          `MDN indisponível para "${slug}", servindo cache vencido: ${String(error)}`,
        );
        return cached.payload;
      }
      throw new ServiceUnavailableException(
        'Não foi possível carregar a documentação agora. Abra direto na MDN.',
      );
    }

    if (!article) {
      throw new NotFoundException('Esta página não existe mais na MDN.');
    }

    await this.articles.save({
      slug,
      payload: article,
      formatVersion: MDN_ARTICLE_FORMAT,
    });
    return article;
  }

  /**
   * Busca o artigo, idioma por idioma. Nulo = 404 em todos (a página não
   * existe). Lança em erro de rede, status inesperado ou conteúdo inválido.
   */
  private async fetchArticle(slug: string): Promise<MdnArticleDto | null> {
    for (const locale of MDN_LOCALES) {
      const response = await fetch(mdnJsonUrl(locale, slug), {
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: 'application/json' },
      });

      if (new URL(response.url).hostname !== MDN_HOST) {
        throw new Error(`redirect para fora da MDN: ${response.url}`);
      }
      if (response.status === 404) continue;
      if (!response.ok) {
        throw new Error(`MDN respondeu ${response.status}`);
      }
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > MAX_RESPONSE_BYTES) {
        throw new Error(`resposta grande demais (${length} bytes)`);
      }

      const article = toMdnArticle((await response.json()) as MdnJsonDocument);
      if (!article) throw new Error('JSON da MDN em formato inesperado');
      return article;
    }
    return null;
  }
}
