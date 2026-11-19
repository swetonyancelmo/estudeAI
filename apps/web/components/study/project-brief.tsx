/**
 * "O que construir" do checkpoint (D20). Hoje a API só manda a descrição e as
 * horas. `deliverables` e `steps` já têm lugar aqui para quando a pendência P6
 * existir; não são inventados no front nem pedidos à IA.
 */
export function ProjectBrief({
  description,
  estimatedHours,
  deliverables,
  steps,
}: {
  description?: string;
  estimatedHours?: number;
  deliverables?: string[];
  steps?: string[];
}) {
  return (
    <section
      aria-labelledby="project-brief"
      className="border-border bg-card flex flex-col gap-4 rounded-lg border p-5 sm:p-6"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="project-brief" className="text-lg">
          O que construir
        </h2>
        {estimatedHours !== undefined && (
          <p className="data-label text-ink-faint">~{estimatedHours}h</p>
        )}
      </header>
      {description && <p className="text-muted-foreground">{description}</p>}

      {deliverables && deliverables.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Entregue</h3>
          <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5">
            {deliverables.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {steps && steps.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Passos</h3>
          <ol className="text-muted-foreground flex list-decimal flex-col gap-1 pl-5">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
