import Link from "next/link";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  /** Destino do link. Sem href, renderiza como texto puro. */
  href?: string;
  className?: string;
}

/**
 * Logotipo tipográfico: "estude" em tom de texto + "AI" no acento da marca.
 * O acento aqui é intencional — é o único lugar da navegação que recebe cor.
 */
export function Wordmark({ href, className }: WordmarkProps) {
  const content = (
    <span
      className={cn(
        "font-heading text-lg font-extrabold tracking-[-0.02em]",
        className,
      )}
    >
      estude<span className="text-brand">AI</span>
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="rounded-sm" aria-label="estudeAI — início">
      {content}
    </Link>
  );
}
