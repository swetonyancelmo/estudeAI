import { ReviewSession } from "@/components/review/review-session";

/** Revisão espaçada do dia (Fase 6). */
export default function ReviewPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-10 sm:px-10 sm:py-14">
      <header className="flex flex-col gap-2">
        <h1>Revisão do dia</h1>
        <p className="text-muted-foreground">
          Perguntas dos exercícios que você já fez, no momento certo de rever:
          quem acerta demora mais para voltar, quem erra volta amanhã.
        </p>
      </header>
      <ReviewSession />
    </div>
  );
}
