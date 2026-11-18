import { plainText, sanitizeMdnHtml } from './mdn-sanitize';
import { mdnJsonUrl, parseMdnUrl } from './mdn-url';

describe('parseMdnUrl', () => {
  it.each([
    [
      'https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Guides/Overview',
      'Web/HTTP/Guides/Overview',
    ],
    [
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map#syntax',
      'Web/JavaScript/Reference/Global_Objects/Array/map',
    ],
    [
      'https://developer.mozilla.org/en-US/docs/Web/CSS/:hover',
      'Web/CSS/:hover',
    ],
  ])('%s → %s', (url, slug) => {
    expect(parseMdnUrl(url)).toBe(slug);
  });

  it.each([
    'http://developer.mozilla.org/en-US/docs/Web/HTML',
    'https://developer.mozilla.org.evil.com/en-US/docs/Web/HTML',
    'https://react.dev/learn',
    'https://developer.mozilla.org/en-US/blog/algum-post',
    'https://developer.mozilla.org/en-US/docs/',
    'https://developer.mozilla.org/../../etc/passwd',
    'não é url',
  ])('recusa %s', (url) => {
    expect(parseMdnUrl(url)).toBeNull();
  });

  it('".." codificado é resolvido pela URL e não sai de /docs/', () => {
    // new URL normaliza /Web/%2e%2e/x para /x: o slug fica dentro da MDN.
    expect(
      parseMdnUrl('https://developer.mozilla.org/en-US/docs/Web/%2e%2e/x?y=1'),
    ).toBe('x');
  });

  it('monta a URL JSON só a partir do slug validado', () => {
    expect(mdnJsonUrl('pt-BR', 'Web/HTML')).toBe(
      'https://developer.mozilla.org/pt-BR/docs/Web/HTML/index.json',
    );
  });
});

describe('sanitizeMdnHtml', () => {
  it('remove script, iframe, handlers e javascript:, mantendo o texto útil', () => {
    const html = sanitizeMdnHtml(
      '<p onclick="x()">Oi <script>alert(1)</script><iframe src="https://evil.com"></iframe>' +
        '<a href="javascript:alert(1)">clique</a> <img src="x" onerror="alert(1)"></p>',
    );

    expect(html).not.toMatch(/script|iframe|onclick|onerror|javascript:/i);
    expect(html).toContain('Oi');
    expect(html).toContain('clique');
  });

  it('não deixa passar javascript: escondido em entidades', () => {
    const html = sanitizeMdnHtml(
      '<a href="&#0000106avascript:alert(1)">a</a><a href="jav&#x09;ascript:alert(1)">b</a>' +
        '<a href="  JaVaScRiPt:alert(1)">c</a>',
    );

    expect(html).not.toMatch(/javascript/i);
    expect(html).toBe('<a>a</a><a>b</a><a>c</a>');
  });

  it('links da MDN viram absolutos em nova aba; âncoras continuam âncoras', () => {
    const html = sanitizeMdnHtml(
      '<a href="/pt-BR/docs/Glossary/Protocol">protocolo</a> <a href="#sintaxe">sintaxe</a>',
    );

    expect(html).toContain(
      '<a href="https://developer.mozilla.org/pt-BR/docs/Glossary/Protocol" target="_blank" rel="noreferrer noopener">protocolo</a>',
    );
    expect(html).toContain('<a href="#sintaxe">sintaxe</a>');
  });

  it('só aceita imagem da própria MDN', () => {
    const html = sanitizeMdnHtml(
      '<img src="/en-US/docs/Web/HTTP/fetching.svg" alt="fluxo"><img src="https://tracker.com/p.gif" alt="">',
    );

    expect(html).toContain(
      'src="https://developer.mozilla.org/en-US/docs/Web/HTTP/fetching.svg"',
    );
    expect(html).not.toContain('tracker.com');
    expect(html.match(/<img/g)).toHaveLength(1);
  });

  it('bloco de código guarda só a linguagem; tag desconhecida some e o código fica', () => {
    const html = sanitizeMdnHtml(
      '<interactive-example><pre class="brush: js interactive-example notranslate"><code>[1].map(x =&gt; x)</code></pre></interactive-example>',
    );

    expect(html).toBe(
      '<pre data-language="js"><code>[1].map(x =&gt; x)</code></pre>',
    );
  });

  it('mantém só as classes de nota da MDN', () => {
    expect(
      sanitizeMdnHtml(
        '<div class="notecard note evil-class" style="color:red"><p>Nota</p></div>',
      ),
    ).toBe('<div class="notecard note"><p>Nota</p></div>');
  });

  it('descarta a navegação do curso e o rótulo de linguagem do código', () => {
    const html = sanitizeMdnHtml(
      '<ul class="prev-next"><li class="prev"><a class="button" href="/pt-BR/docs/X">Anterior</a></li></ul>' +
        '<div class="code-example"><div class="example-header"><span class="language-name">js</span></div>' +
        '<pre class="brush: js notranslate"><code>x()</code></pre></div>',
    );

    expect(html).toBe(
      '<div><pre data-language="js"><code>x()</code></pre></div>',
    );
  });

  it('aceita os diagramas oficiais de mdn.github.io', () => {
    expect(
      sanitizeMdnHtml(
        '<img src="https://mdn.github.io/shared-assets/images/diagrams/http/overview/fetching-a-page.svg" alt="">',
      ),
    ).toContain('src="https://mdn.github.io/shared-assets/');
  });

  it('plainText tira as tags do título', () => {
    expect(plainText('Exemplo: usando <code>map</code> genericamente')).toBe(
      'Exemplo: usando map genericamente',
    );
    expect(plainText(null)).toBeNull();
  });
});
