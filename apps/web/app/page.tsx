import { HealthStatus } from "@/components/health-status";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 p-16 dark:bg-black">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Web Dev Roadmap AI</h1>
        <p className="text-muted-foreground text-sm">
          Skeleton do monorepo — comunicação entre apps/web e apps/api
        </p>
      </div>
      <HealthStatus />
    </div>
  );
}
