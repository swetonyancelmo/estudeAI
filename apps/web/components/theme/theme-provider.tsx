"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Tema por classe (`.dark` no <html>), casando com o `@custom-variant dark`
 * declarado em globals.css. O padrão é `system`: sem escolha explícita, o app
 * acompanha a preferência do dispositivo — inclusive se ela mudar com a janela
 * aberta. O <html> precisa de `suppressHydrationWarning` porque o script
 * inline do next-themes escreve a classe antes da hidratação.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
