import {
  MDN_LOCALES,
  type MdnArticleDto,
  type MdnLinkDto,
  type MdnLocale,
  type MdnSectionDto,
} from '@estudeai/shared-types';
import { plainText, sanitizeMdnHtml } from './mdn-sanitize';
import { MDN_ORIGIN } from './mdn-url';

/**
 * Forma mínima do `index.json` de uma página da MDN que consumimos. O resto do
 * documento (sidebar, toc, popularidade...) é ignorado.
 */
export interface MdnJsonDocument {
  doc?: {
    title?: string;
    locale?: string;
    mdn_url?: string;
    modified?: string;
    body?: {
      type?: string;
      value?: {
        id?: string | null;
        title?: string | null;
        isH3?: boolean;
        content?: string;
        specifications?: { title?: string; bcdSpecificationURL?: string }[];
      };
    }[];
  };
}

/** Converte o JSON da MDN no DTO do leitor. Nulo se faltar o essencial. */
export function toMdnArticle(json: MdnJsonDocument): MdnArticleDto | null {
  const doc = json.doc;
  if (!doc?.title || !doc.mdn_url || !Array.isArray(doc.body)) return null;

  const locale: MdnLocale = MDN_LOCALES.includes(doc.locale as MdnLocale)
    ? (doc.locale as MdnLocale)
    : 'en-US';
  const path = doc.mdn_url.startsWith('/') ? doc.mdn_url : `/${doc.mdn_url}`;

  const sections: MdnSectionDto[] = [];
  const specifications: MdnLinkDto[] = [];
  let hasBrowserCompat = false;

  for (const block of doc.body) {
    const value = block.value ?? {};
    if (block.type === 'prose') {
      const html = sanitizeMdnHtml(value.content ?? '').trim();
      if (html.length === 0) continue;
      sections.push({
        id: value.id ?? null,
        title: plainText(value.title),
        isH3: value.isH3 === true,
        html,
      });
    } else if (block.type === 'specifications') {
      for (const spec of value.specifications ?? []) {
        if (spec.title && spec.bcdSpecificationURL?.startsWith('https://')) {
          specifications.push({
            title: spec.title,
            url: spec.bcdSpecificationURL,
          });
        }
      }
    } else if (block.type === 'browser_compatibility') {
      hasBrowserCompat = true;
    }
  }

  return {
    title: doc.title,
    locale,
    url: `${MDN_ORIGIN}${path}`,
    englishUrl: `${MDN_ORIGIN}${path.replace(/^\/[^/]+\//, '/en-US/')}`,
    isTranslated: locale !== 'en-US',
    modified: doc.modified ?? null,
    sections,
    specifications,
    hasBrowserCompat,
  };
}
