import type { ConfigService } from '@nestjs/config';
import type { RoadmapResponseDto } from '@estudeai/shared-types';

// Mesmo mock do SDK usado nos specs das Etapas 4 e 7: nada bate na API real.
const generateContent = jest.fn();
jest.mock('@google/genai', () => ({
  ...jest.requireActual('@google/genai'),
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent },
  })),
}));

import { ResourceDiscoveryService } from './resource-discovery.service';

const YOUTUBE_HOST = 'googleapis.com/youtube/v3/search';
const VERTEX_REDIRECT =
  'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc123';

const baseEnv: Record<string, string> = {
  YOUTUBE_API_KEY: 'youtube-key',
  GEMINI_API_KEY: 'gemini-key',
  // Sem intervalo entre tópicos: o ritmo é comportamento de produção, não de teste.
  RESOURCE_DISCOVERY_DELAY_MS: '0',
};

let fetchMock: jest.Mock;

function buildService(
  env: Record<string, string | undefined> = baseEnv,
): ResourceDiscoveryService {
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
  return new ResourceDiscoveryService(config);
}

/** Resposta HTTP falsa com o mínimo que o service consome. */
function httpResponse(options: {
  status?: number;
  url?: string;
  json?: unknown;
}) {
  const status = options.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    url: options.url ?? '',
    body: null,
    json: () => Promise.resolve(options.json),
  };
}

/** Item de `search.list`, na forma que a API devolve. */
function youtubeVideo(id: string, title: string) {
  return {
    id: { kind: 'youtube#video', videoId: id },
    snippet: {
      title,
      thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mq.jpg` } },
    },
  };
}

function youtubePlaylist(id: string, title: string) {
  return {
    id: { kind: 'youtube#playlist', playlistId: id },
    snippet: {
      title,
      thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/pl.jpg` } },
    },
  };
}

/** Resposta do Gemini com grounding: só os chunks importam. */
function groundedResponse(
  chunks: { uri?: string; title?: string }[],
  text = 'Veja https://link-inventado-pelo-modelo.example para aprender.',
) {
  return {
    text,
    candidates: [
      {
        groundingMetadata: {
          groundingChunks: chunks.map((chunk) => ({ web: chunk })),
        },
      },
    ],
  };
}

/** Roteia o fetch: YouTube devolve `items`, o resto é validação de link. */
function routeFetch(options: {
  youtubeItems?: unknown[];
  youtubeStatus?: number;
  onValidate?: (
    url: string,
    init?: RequestInit,
  ) => ReturnType<typeof httpResponse>;
}) {
  fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
    const url = String(input);

    if (url.includes(YOUTUBE_HOST)) {
      const status = options.youtubeStatus ?? 200;
      return Promise.resolve(
        httpResponse({ status, json: { items: options.youtubeItems ?? [] } }),
      );
    }

    const validate =
      options.onValidate ?? ((target: string) => httpResponse({ url: target }));
    return Promise.resolve(validate(url, init));
  });
}

/** URLs das chamadas ao search.list — uma por tópico é o que custa cota. */
function youtubeSearchCalls(): string[] {
  return (fetchMock.mock.calls as unknown[][])
    .map((call) => String(call[0]))
    .filter((url) => url.includes(YOUTUBE_HOST));
}

describe('ResourceDiscoveryService (Etapa 8 — YouTube e grounding mockados)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    // Sem grounding por padrão: cada teste liga o que for examinar.
    generateContent.mockResolvedValue(groundedResponse([]));
  });

  describe('searchYoutubeResources', () => {
    it('monta vídeo e playlist com URL canônica, thumbnail e título decodificado', async () => {
      routeFetch({
        youtubeItems: [
          youtubeVideo('vid1', 'CSS Flexbox &quot;do zero&quot;'),
          youtubePlaylist('pl1', 'Curso de CSS &amp; HTML'),
        ],
      });

      const resources = await buildService().searchYoutubeResources('CSS');

      expect(resources).toEqual([
        {
          title: 'CSS Flexbox "do zero"',
          url: 'https://www.youtube.com/watch?v=vid1',
          type: 'video',
          source: 'youtube',
          thumbnailUrl: 'https://i.ytimg.com/vi/vid1/mq.jpg',
        },
        {
          title: 'Curso de CSS & HTML',
          url: 'https://www.youtube.com/playlist?list=pl1',
          type: 'playlist',
          source: 'youtube',
          thumbnailUrl: 'https://i.ytimg.com/vi/pl1/pl.jpg',
        },
      ]);

      // Uma única chamada ao search.list cobre vídeo e playlist (cota!).
      const searchCalls = youtubeSearchCalls();
      expect(searchCalls).toHaveLength(1);
      expect(searchCalls[0]).toContain('type=video%2Cplaylist');
    });

    it('descarta o link que não responde e mantém o válido', async () => {
      routeFetch({
        youtubeItems: [
          youtubeVideo('morto', 'Vídeo removido'),
          youtubeVideo('vivo', 'Vídeo bom'),
        ],
        onValidate: (url) =>
          url.includes('morto')
            ? httpResponse({ status: 404, url })
            : httpResponse({ url }),
      });

      const resources = await buildService().searchYoutubeResources('CSS');

      expect(resources).toHaveLength(1);
      expect(resources[0].url).toBe('https://www.youtube.com/watch?v=vivo');
    });

    it('descarta o link cuja validação estoura (timeout / DNS)', async () => {
      fetchMock.mockImplementation((input: unknown) => {
        const url = String(input);
        if (url.includes(YOUTUBE_HOST)) {
          return Promise.resolve(
            httpResponse({ json: { items: [youtubeVideo('v1', 'Vídeo')] } }),
          );
        }
        return Promise.reject(new Error('The operation was aborted'));
      });

      await expect(
        buildService().searchYoutubeResources('CSS'),
      ).resolves.toEqual([]);
    });

    it('preserva o link que recusa HEAD mas responde ao GET', async () => {
      // MDN e afins respondem 405 a HEAD; descartá-los perderia as melhores fontes.
      routeFetch({
        youtubeItems: [youtubeVideo('v1', 'Vídeo')],
        onValidate: (url, init) =>
          init?.method === 'HEAD'
            ? httpResponse({ status: 405, url })
            : httpResponse({ status: 206, url }),
      });

      const resources = await buildService().searchYoutubeResources('CSS');

      expect(resources).toHaveLength(1);
    });

    it('devolve [] sem lançar quando a quota estoura (HTTP 403)', async () => {
      routeFetch({ youtubeStatus: 403 });

      await expect(
        buildService().searchYoutubeResources('CSS'),
      ).resolves.toEqual([]);
    });

    it('devolve [] e nem chama a API quando falta YOUTUBE_API_KEY', async () => {
      routeFetch({ youtubeItems: [youtubeVideo('v1', 'Vídeo')] });

      const service = buildService({ GEMINI_API_KEY: 'gemini-key' });

      await expect(service.searchYoutubeResources('CSS')).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('searchWebResources (grounding)', () => {
    it('IGNORA a URL escrita no texto e usa apenas o groundingMetadata', async () => {
      generateContent.mockResolvedValue(
        groundedResponse(
          [
            {
              uri: 'https://developer.mozilla.org/pt-BR/docs/Web/CSS',
              title: 'mozilla.org',
            },
          ],
          'Recomendo https://site-que-o-modelo-inventou.example/css',
        ),
      );
      routeFetch({});

      const resources = await buildService().searchWebResources('CSS');

      expect(resources).toEqual([
        {
          title: 'mozilla.org',
          url: 'https://developer.mozilla.org/pt-BR/docs/Web/CSS',
          type: 'article',
          source: 'web',
        },
      ]);
    });

    it('devolve [] quando a resposta tem URL no texto mas nenhum chunk', async () => {
      generateContent.mockResolvedValue(
        groundedResponse([], 'Veja https://inventado.example/css'),
      );
      routeFetch({});

      await expect(buildService().searchWebResources('CSS')).resolves.toEqual(
        [],
      );
    });

    it('persiste a URL FINAL, não o redirect do Vertex (que expira em ~30 dias)', async () => {
      generateContent.mockResolvedValue(
        groundedResponse([{ uri: VERTEX_REDIRECT }]),
      );
      routeFetch({
        onValidate: () =>
          httpResponse({ url: 'https://www.freecodecamp.org/portuguese/css' }),
      });

      const resources = await buildService().searchWebResources('CSS');

      expect(resources[0].url).toBe(
        'https://www.freecodecamp.org/portuguese/css',
      );
      // Sem `title` no chunk, o host resolvido vira o título.
      expect(resources[0].title).toBe('freecodecamp.org');
    });

    it('descarta chunk que resolve para o YouTube (é assunto da outra fonte)', async () => {
      generateContent.mockResolvedValue(
        groundedResponse([
          { uri: VERTEX_REDIRECT },
          { uri: 'https://css-tricks.com/flexbox' },
        ]),
      );
      routeFetch({
        onValidate: (url) =>
          url === VERTEX_REDIRECT
            ? httpResponse({ url: 'https://www.youtube.com/watch?v=x' })
            : httpResponse({ url }),
      });

      const resources = await buildService().searchWebResources('CSS');

      expect(resources).toHaveLength(1);
      expect(resources[0].url).toBe('https://css-tricks.com/flexbox');
    });

    it('devolve [] sem lançar quando o Gemini falha', async () => {
      generateContent.mockRejectedValue(new Error('503 Service Unavailable'));
      routeFetch({});

      await expect(buildService().searchWebResources('CSS')).resolves.toEqual(
        [],
      );
    });
  });

  describe('enrichRoadmap', () => {
    function roadmapWith(titles: string[]): RoadmapResponseDto {
      return {
        targetArea: 'frontend',
        justification: 'justificativa',
        modules: [
          {
            title: 'Fundamentos',
            description: 'base',
            order: 0,
            topics: titles.map((title, order) => ({ title, order })),
          },
        ],
      };
    }

    it('anexa recursos a cada tópico sem mutar o molde recebido', async () => {
      routeFetch({ youtubeItems: [youtubeVideo('v1', 'Vídeo')] });
      const roadmap = roadmapWith(['HTML', 'CSS']);
      const snapshot = structuredClone(roadmap);

      const enriched = await buildService().enrichRoadmap(roadmap);

      const topics = enriched.modules[0].topics;
      expect(topics[0].resources).toHaveLength(1);
      expect(topics[1].resources).toHaveLength(1);
      // O molde pode ser o jsonb de um template compartilhado: sai intacto.
      expect(roadmap).toEqual(snapshot);
    });

    it('falha na busca de UM tópico não interrompe os demais nem quebra o roadmap', async () => {
      fetchMock.mockImplementation((input: unknown) => {
        const url = String(input);
        if (url.includes(YOUTUBE_HOST)) {
          // O tópico "CSS" derruba as duas fontes; os outros seguem normais.
          return url.includes('CSS')
            ? Promise.reject(new Error('ECONNRESET'))
            : Promise.resolve(
                httpResponse({
                  json: { items: [youtubeVideo('v1', 'Vídeo')] },
                }),
              );
        }
        return Promise.resolve(httpResponse({ url }));
      });
      generateContent.mockImplementation((request: { contents: string }) =>
        request.contents.includes('CSS')
          ? Promise.reject(new Error('quota'))
          : Promise.resolve(groundedResponse([])),
      );

      const enriched = await buildService().enrichRoadmap(
        roadmapWith(['HTML', 'CSS', 'JS']),
      );

      const topics = enriched.modules[0].topics;
      expect(topics.map((topic) => topic.title)).toEqual(['HTML', 'CSS', 'JS']);
      expect(topics[0].resources).toHaveLength(1);
      // Sem recursos, mas presente e vazio: já buscamos, não há o que retentar.
      expect(topics[1].resources).toEqual([]);
      expect(topics[2].resources).toHaveLength(1);
    });

    it('ao estourar o orçamento, deixa os tópicos restantes SEM o campo resources', async () => {
      // Relógio controlado: a busca do primeiro tópico "consome" 10s de um
      // orçamento de 5s, então os seguintes nem são tentados.
      let clock = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => clock);
      fetchMock.mockImplementation((input: unknown) => {
        const url = String(input);
        if (url.includes(YOUTUBE_HOST)) {
          clock += 10_000;
          return Promise.resolve(
            httpResponse({ json: { items: [youtubeVideo('v1', 'Vídeo')] } }),
          );
        }
        return Promise.resolve(httpResponse({ url }));
      });

      const service = buildService({
        ...baseEnv,
        RESOURCE_DISCOVERY_BUDGET_MS: '5000',
      });
      const enriched = await service.enrichRoadmap(
        roadmapWith(['HTML', 'CSS', 'JS']),
      );

      const topics = enriched.modules[0].topics;
      expect(topics[0].resources).toHaveLength(1);
      // `undefined` (e não `[]`) é o que faz o próximo cache hit completá-los.
      expect(topics[1].resources).toBeUndefined();
      expect(topics[2].resources).toBeUndefined();
    });

    it('não rebusca tópicos que já têm recursos (backfill parcial)', async () => {
      routeFetch({ youtubeItems: [youtubeVideo('v1', 'Vídeo')] });
      const roadmap = roadmapWith(['HTML', 'CSS']);
      roadmap.modules[0].topics[0].resources = [
        {
          title: 'MDN',
          url: 'https://developer.mozilla.org/',
          type: 'article',
          source: 'web',
        },
      ];

      const enriched = await buildService().enrichRoadmap(roadmap);

      expect(enriched.modules[0].topics[0].resources).toEqual(
        roadmap.modules[0].topics[0].resources,
      );
      expect(youtubeSearchCalls()).toHaveLength(1);
    });

    it('devolve o roadmap intacto quando a descoberta está desabilitada', async () => {
      routeFetch({ youtubeItems: [youtubeVideo('v1', 'Vídeo')] });
      const service = buildService({
        ...baseEnv,
        RESOURCE_DISCOVERY_ENABLED: 'false',
      });
      const roadmap = roadmapWith(['HTML']);

      const result = await service.enrichRoadmap(roadmap);

      expect(result).toBe(roadmap);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('discoverForTopics (reajuste)', () => {
    it('indexa por id e omite os tópicos que não renderam nada', async () => {
      fetchMock.mockImplementation((input: unknown) => {
        const url = String(input);
        if (url.includes(YOUTUBE_HOST)) {
          return Promise.resolve(
            httpResponse({
              json: {
                items: url.includes('Flexbox')
                  ? [youtubeVideo('v1', 'Flexbox')]
                  : [],
              },
            }),
          );
        }
        return Promise.resolve(httpResponse({ url }));
      });

      const found = await buildService().discoverForTopics([
        { id: 't-1', title: 'Flexbox' },
        { id: 't-2', title: 'Grid' },
      ]);

      expect(found.get('t-1')).toHaveLength(1);
      expect(found.has('t-2')).toBe(false);
    });
  });
});
