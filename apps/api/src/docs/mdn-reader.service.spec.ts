import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { MdnArticleDto } from '@estudeai/shared-types';
import { toMdnArticle, type MdnJsonDocument } from './mdn-article';
import {
  MDN_ARTICLE_FORMAT,
  MDN_CACHE_TTL_MS,
  MdnReaderService,
} from './mdn-reader.service';

const URL_PT =
  'https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Guides/Overview';
const SLUG = 'Web/HTTP/Guides/Overview';

function mdnJson(locale: string): MdnJsonDocument {
  return {
    doc: {
      title: 'Uma visão geral do HTTP',
      locale,
      mdn_url: `/${locale}/docs/${SLUG}`,
      modified: '2025-07-07T09:37:06.000Z',
      body: [
        {
          type: 'prose',
          value: {
            id: null,
            title: null,
            content: '<p><strong>HTTP</strong> é um protocolo.</p>',
          },
        },
        {
          type: 'prose',
          value: {
            id: 'sintaxe',
            title: 'Usando <code>fetch</code>',
            isH3: true,
            content: '<pre class="brush: js notranslate">fetch(url)</pre>',
          },
        },
        { type: 'prose', value: { id: 'vazio', title: 'Vazio', content: '' } },
        {
          type: 'specifications',
          value: {
            specifications: [
              {
                title: 'HTTP Semantics',
                bcdSpecificationURL: 'https://httpwg.org/specs/rfc9110.html',
              },
              { title: 'Sem link', bcdSpecificationURL: 'javascript:x' },
            ],
          },
        },
        { type: 'browser_compatibility', value: {} },
      ],
    },
  };
}

function response(status: number, body: unknown, url: string): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    url,
    headers: new Headers({ 'content-length': '1000' }),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('toMdnArticle', () => {
  it('converte seções, especificações e compatibilidade', () => {
    const article = toMdnArticle(mdnJson('pt-BR'))!;

    expect(article).toMatchObject({
      title: 'Uma visão geral do HTTP',
      locale: 'pt-BR',
      url: URL_PT,
      englishUrl: `https://developer.mozilla.org/en-US/docs/${SLUG}`,
      isTranslated: true,
      hasBrowserCompat: true,
      specifications: [
        {
          title: 'HTTP Semantics',
          url: 'https://httpwg.org/specs/rfc9110.html',
        },
      ],
    });
    // Seção vazia some; título vira texto puro; pre guarda só a linguagem.
    expect(article.sections).toEqual([
      {
        id: null,
        title: null,
        isH3: false,
        html: '<p><strong>HTTP</strong> é um protocolo.</p>',
      },
      {
        id: 'sintaxe',
        title: 'Usando fetch',
        isH3: true,
        html: '<pre data-language="js">fetch(url)</pre>',
      },
    ]);
  });

  it('nulo quando o JSON não tem o essencial', () => {
    expect(toMdnArticle({})).toBeNull();
    expect(toMdnArticle({ doc: { title: 'x' } })).toBeNull();
  });
});

describe('MdnReaderService', () => {
  let repo: { findOne: jest.Mock; save: jest.Mock };
  let service: MdnReaderService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    service = new MdnReaderService(repo as never);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => fetchMock.mockRestore());

  it('busca em pt-BR, guarda no cache e devolve', async () => {
    fetchMock.mockResolvedValueOnce(
      response(200, mdnJson('pt-BR'), `${URL_PT}/index.json`),
    );

    const article = await service.getArticle(URL_PT);

    expect(article.locale).toBe('pt-BR');
    expect(fetchMock).toHaveBeenCalledWith(
      `${URL_PT}/index.json`,
      expect.objectContaining({ redirect: 'follow' }),
    );
    expect(repo.save).toHaveBeenCalledWith({
      slug: SLUG,
      payload: article,
      formatVersion: MDN_ARTICLE_FORMAT,
    });
  });

  it('sem tradução em pt-BR, usa a página em inglês', async () => {
    const en = `https://developer.mozilla.org/en-US/docs/${SLUG}`;
    fetchMock
      .mockResolvedValueOnce(response(404, {}, `${URL_PT}/index.json`))
      .mockResolvedValueOnce(
        response(200, mdnJson('en-US'), `${en}/index.json`),
      );

    const article = await service.getArticle(URL_PT);

    expect(article.locale).toBe('en-US');
    expect(article.isTranslated).toBe(false);
  });

  it('cache dentro da validade não chama a MDN', async () => {
    const payload = { title: 'em cache' } as MdnArticleDto;
    repo.findOne.mockResolvedValue({
      slug: SLUG,
      payload,
      formatVersion: MDN_ARTICLE_FORMAT,
      fetchedAt: new Date(),
    });

    expect(await service.getArticle(URL_PT)).toBe(payload);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cache de formato antigo é buscado de novo, mesmo dentro da validade', async () => {
    repo.findOne.mockResolvedValue({
      slug: SLUG,
      payload: { title: 'formato velho' } as MdnArticleDto,
      formatVersion: MDN_ARTICLE_FORMAT - 1,
      fetchedAt: new Date(),
    });
    fetchMock.mockResolvedValueOnce(
      response(200, mdnJson('pt-BR'), `${URL_PT}/index.json`),
    );

    const article = await service.getArticle(URL_PT);

    expect(article.title).toBe('Uma visão geral do HTTP');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('MDN fora do ar com cache vencido: serve o cache', async () => {
    const payload = { title: 'velho' } as MdnArticleDto;
    repo.findOne.mockResolvedValue({
      slug: SLUG,
      payload,
      formatVersion: MDN_ARTICLE_FORMAT,
      fetchedAt: new Date(Date.now() - MDN_CACHE_TTL_MS - 1000),
    });
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));

    expect(await service.getArticle(URL_PT)).toBe(payload);
  });

  it('MDN fora do ar sem cache: 503', async () => {
    fetchMock.mockResolvedValueOnce(response(500, {}, `${URL_PT}/index.json`));

    await expect(service.getArticle(URL_PT)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('página que não existe em nenhum idioma: 404', async () => {
    fetchMock.mockResolvedValue(response(404, {}, `${URL_PT}/index.json`));

    await expect(service.getArticle(URL_PT)).rejects.toThrow(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('redirect para fora da MDN é recusado', async () => {
    fetchMock.mockResolvedValueOnce(
      response(200, mdnJson('pt-BR'), 'https://evil.com/index.json'),
    );

    await expect(service.getArticle(URL_PT)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('URL que não é da MDN: 400 sem buscar nada', async () => {
    await expect(
      service.getArticle('https://evil.com/pt-BR/docs/Web'),
    ).rejects.toThrow(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(repo.findOne).not.toHaveBeenCalled();
  });
});
