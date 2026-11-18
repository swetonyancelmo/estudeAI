import { MDN_HOST, type MdnLocale } from '@estudeai/shared-types';

export const MDN_ORIGIN = `https://${MDN_HOST}`;

/**
 * Caminho de uma página da MDN depois de `/{locale}/docs/`, ex.
 * `Web/HTTP/Guides/Overview`. Só letras, números e a pontuação que a MDN usa
 * nos slugs: é com ele que a API monta a URL que vai buscar, então nada de
 * `..`, query ou outro host consegue entrar por aqui.
 */
const SLUG_PATTERN = /^[A-Za-z0-9_\-.:()%*@]+(\/[A-Za-z0-9_\-.:()%*@]+)*$/;
const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

/**
 * Extrai o slug de uma URL de página da MDN (qualquer idioma). Nulo quando não
 * é uma página de documentação da MDN — o leitor só abre essas.
 */
export function parseMdnUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== MDN_HOST) return null;

  const [locale, docs, ...rest] = url.pathname.split('/').filter(Boolean);
  if (!locale || !LOCALE_PATTERN.test(locale) || docs !== 'docs') return null;

  const slug = rest.join('/');
  if (!SLUG_PATTERN.test(slug) || slug.split('/').includes('..')) return null;
  return slug;
}

/** URL pública da página num idioma. */
export function mdnPageUrl(locale: MdnLocale, slug: string): string {
  return `${MDN_ORIGIN}/${locale}/docs/${slug}`;
}

/** URL da versão JSON da página, que é o que a API busca. */
export function mdnJsonUrl(locale: MdnLocale, slug: string): string {
  return `${mdnPageUrl(locale, slug)}/index.json`;
}
