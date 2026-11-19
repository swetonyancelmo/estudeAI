import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

/**
 * Trilha › Estação › Parada, no topo da sala de estudo e do leitor. No
 * celular só ficam a trilha e a página atual: o resto não cabe, e o botão da
 * lista já mostra a estação.
 * `actions` fica à direita (modo foco e lista, na sala de estudo).
 */
export function StudyBreadcrumb({
  trackHref,
  trackLabel,
  station,
  items,
  actions,
}: {
  trackHref: string;
  trackLabel: string;
  station: string;
  /** Do mais geral ao atual; o último é a página atual. */
  items: { label: string; href?: string }[];
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem className="shrink-0">
            <BreadcrumbLink
              render={<Link href={trackHref} />}
              className="flex min-h-11 items-center font-medium"
            >
              {trackLabel}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          <BreadcrumbItem className="hidden min-w-0 md:inline-flex">
            <span className="truncate">{station}</span>
          </BreadcrumbItem>
          {items.map((item, index) => {
            const last = index === items.length - 1;
            return (
              <Fragment key={`${item.label}-${index}`}>
                <BreadcrumbSeparator className={cn(!last && "hidden md:block")} />
                <BreadcrumbItem className={cn("min-w-0", !last && "hidden md:inline-flex")}>
                  {last || !item.href ? (
                    <BreadcrumbPage className="truncate font-medium">
                      {item.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      render={<Link href={item.href} />}
                      className="flex min-h-11 min-w-0 items-center"
                    >
                      <span className="truncate">{item.label}</span>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

