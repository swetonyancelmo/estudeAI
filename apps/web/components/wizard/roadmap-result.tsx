import type { RoadmapResponseDto, TargetArea } from "@estudeai/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AREA_LABELS: Record<TargetArea, string> = {
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Fullstack",
};

interface RoadmapResultProps {
  roadmap: RoadmapResponseDto;
  onRestart: () => void;
}

/**
 * Tela de resultado (FR-01, final): área sugerida + justificativa + módulos e
 * tópicos. Sem marcar progresso — isso é FR-03.3 (Etapa 6).
 */
export function RoadmapResult({ roadmap, onRestart }: RoadmapResultProps) {
  return (
    <div className="flex flex-col gap-6 duration-300 animate-in fade-in-0 slide-in-from-bottom-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Área sugerida</span>
          <Badge>{AREA_LABELS[roadmap.targetArea]}</Badge>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {roadmap.justification}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {[...roadmap.modules]
          .sort((a, b) => a.order - b.order)
          .map((module) => (
            <Card key={module.order}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-muted-foreground tabular-nums">
                    {String(module.order + 1).padStart(2, "0")}
                  </span>
                  {module.title}
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  {module.description}
                </p>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {[...module.topics]
                    .sort((a, b) => a.order - b.order)
                    .map((topic) => (
                      <li
                        key={topic.order}
                        className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0"
                      >
                        <span>{topic.title}</span>
                        {topic.estimatedHours !== undefined && (
                          <span className="text-muted-foreground shrink-0 text-xs">
                            ~{topic.estimatedHours}h
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          ))}
      </div>

      <div className="flex justify-center">
        <Button variant="outline" onClick={onRestart}>
          Refazer diagnóstico
        </Button>
      </div>
    </div>
  );
}
