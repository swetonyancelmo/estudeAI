"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Altura (px) que um elemento `sticky` pode ocupar sem passar da tela nem entrar
 * debaixo da barra inferior.
 *
 * Uma altura fixa só acerta depois que a página rolou e o elemento "grudou" no
 * topo: na posição inicial ele começa mais embaixo (abaixo do cabeçalho e do
 * breadcrumb) e o fim da lista ficava cortado pela barra. Aqui a altura é o que
 * sobra entre a posição atual do elemento (nunca acima de `stickyTop`) e o rodapé
 * reservado, e é recalculada ao rolar e ao redimensionar.
 *
 * `undefined` até o primeiro cálculo: quem usa mantém uma altura de reserva em
 * CSS para o primeiro render e para quando o JS ainda não rodou.
 */
export function useFitToViewport(
  ref: RefObject<HTMLElement | null>,
  { stickyTop, reserve, min = 240 }: { stickyTop: number; reserve: number; min?: number },
  active: boolean,
): number | undefined {
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const element = ref.current;
    if (!active || !element) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const top = Math.max(element.getBoundingClientRect().top, stickyTop);
      setHeight(Math.max(min, Math.floor(window.innerHeight - top - reserve)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ref, stickyTop, reserve, min, active]);

  return active ? height : undefined;
}
