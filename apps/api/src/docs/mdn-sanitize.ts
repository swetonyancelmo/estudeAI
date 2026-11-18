import sanitizeHtml, { type Attributes } from 'sanitize-html';
import { MDN_HOST } from '@estudeai/shared-types';
import { MDN_ORIGIN } from './mdn-url';

/**
 * Lista de PERMISSÕES do que o leitor exibe do HTML da MDN. Tudo que não está
 * aqui cai fora (o texto de dentro fica, exceto em script/style). A MDN não
 * manda script nem iframe hoje, mas este HTML é renderizado com
 * `dangerouslySetInnerHTML` no web: a garantia tem que estar aqui, não na
 * confiança na fonte.
 */
const ALLOWED_TAGS = [
  'p',
  'a',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'mark',
  'small',
  'sub',
  'sup',
  'code',
  'pre',
  'kbd',
  'samp',
  'var',
  'abbr',
  'br',
  'hr',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'blockquote',
  'figure',
  'figcaption',
  'details',
  'summary',
  'table',
  'caption',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'img',
  'span',
  'div',
];

/** Linguagem do bloco de código a partir da classe da MDN ("brush: js ..."). */
function codeLanguage(className: string | undefined): string | undefined {
  const match = /(?:^|\s)brush:\s*([a-z0-9-]+)/i.exec(className ?? '');
  return match?.[1]?.toLowerCase();
}

/**
 * Link da MDN vira absoluto (o leitor não está em developer.mozilla.org),
 * âncora da própria página continua âncora, e o resto que não for http(s)
 * perde o href.
 */
function absoluteHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  if (href.startsWith('#')) return href;
  try {
    const url = new URL(href, MDN_ORIGIN);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Imagem só da própria MDN (páginas e o repositório de diagramas
 * `mdn.github.io/shared-assets`): evita o leitor carregar pixel de rastreio.
 */
const IMAGE_HOSTS = new Set([MDN_HOST, 'mdn.github.io']);

/**
 * Blocos da página da MDN que não fazem sentido no leitor: a navegação do
 * curso ("Anterior", "Menu") e o rótulo da linguagem em cima do código (ela já
 * vai no `data-language` do `<pre>`). Saem inteiros, com o texto de dentro.
 */
const DROPPED_BLOCKS: [tag: string, className: string][] = [
  ['ul', 'prev-next'],
  ['div', 'example-header'],
];

function mdnImage(src: string | undefined): string | undefined {
  if (!src) return undefined;
  try {
    const url = new URL(src, MDN_ORIGIN);
    return url.protocol === 'https:' && IMAGE_HOSTS.has(url.hostname)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 1ª passada: só tira os blocos de `DROPPED_BLOCKS`. Precisa ser à parte porque
 * o `exclusiveFilter` da passada restrita já recebe os atributos filtrados, sem
 * a `class` que identifica esses blocos. Não protege nada — a segurança é toda
 * da 2ª passada, que recebe esta saída.
 */
function dropMdnChrome(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: false,
    allowedAttributes: false,
    allowVulnerableTags: true,
    exclusiveFilter: (frame) =>
      DROPPED_BLOCKS.some(
        ([tag, className]) =>
          frame.tag === tag &&
          (frame.attribs.class ?? '').split(/\s+/).includes(className),
      ),
  });
}

export function sanitizeMdnHtml(html: string): string {
  return sanitizeHtml(dropMdnChrome(html), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
      pre: ['data-language'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
      abbr: ['title'],
      '*': ['id'],
    },
    // Só as classes das caixas de nota/aviso da MDN, para o leitor destacá-las.
    allowedClasses: { div: ['notecard', 'note', 'warning', 'callout'] },
    allowedSchemes: ['https', 'http'],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attribs) => {
        const href = absoluteHref(attribs.href);
        const next: Attributes = !href
          ? {}
          : href.startsWith('#')
            ? { href }
            : { href, target: '_blank', rel: 'noreferrer noopener' };
        return { tagName: 'a', attribs: next };
      },
      img: (_tag, attribs) => {
        const src = mdnImage(attribs.src);
        const next: Attributes = src
          ? {
              src,
              alt: attribs.alt ?? '',
              loading: 'lazy',
              ...(attribs.width ? { width: attribs.width } : {}),
              ...(attribs.height ? { height: attribs.height } : {}),
            }
          : {};
        return { tagName: 'img', attribs: next };
      },
      pre: (_tag, attribs) => {
        const language = codeLanguage(attribs.class);
        const next: Attributes = language ? { 'data-language': language } : {};
        return { tagName: 'pre', attribs: next };
      },
    },
    // Imagem sem src (de fora da MDN) não deixa uma caixa vazia na página.
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  });
}

/** Título de seção em texto puro (a MDN manda `<code>` dentro de alguns). */
export function plainText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0 ? decodeEntities(text) : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
