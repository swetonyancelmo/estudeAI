import { MDN_HOST } from "@estudeai/shared-types";

/**
 * Nome curto do site oficial de uma documentação, exibido como legenda
 * ("MDN", "React"). Casa por domínio ou subdomínio; o que não está aqui
 * aparece pelo próprio domínio.
 */
const SITE_NAMES: [host: string, name: string][] = [
  [MDN_HOST, "MDN"],
  ["web.dev", "web.dev"],
  ["react.dev", "React"],
  ["nextjs.org", "Next.js"],
  ["nodejs.org", "Node.js"],
  ["typescriptlang.org", "TypeScript"],
  ["docs.docker.com", "Docker"],
  ["git-scm.com", "Git"],
  ["docs.github.com", "GitHub"],
  ["postgresql.org", "PostgreSQL"],
  ["nestjs.com", "NestJS"],
  ["prisma.io", "Prisma"],
  ["kubernetes.io", "Kubernetes"],
  ["aws.amazon.com", "AWS"],
  ["developer.hashicorp.com", "Terraform"],
  ["tailwindcss.com", "Tailwind CSS"],
  ["vitest.dev", "Vitest"],
  ["playwright.dev", "Playwright"],
  ["tanstack.com", "TanStack"],
  ["prometheus.io", "Prometheus"],
  ["grafana.com", "Grafana"],
  ["owasp.org", "OWASP"],
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function docSiteName(url: string): string {
  const host = hostOf(url);
  if (!host) return url;
  const match = SITE_NAMES.find(
    ([site]) => host === site || host.endsWith(`.${site}`),
  );
  return match ? match[1] : host;
}

/** Página de documentação da MDN: abre no leitor interno. */
export function isMdnDocUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === MDN_HOST &&
      /^\/[a-z]{2}(-[A-Z]{2})?\/docs\/./.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}
