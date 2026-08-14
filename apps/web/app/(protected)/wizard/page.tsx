import { WizardFlow } from "@/components/wizard/wizard-flow";

export default function WizardPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 p-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-heading text-2xl font-semibold">
          Vamos montar seu roadmap
        </h1>
        <p className="text-muted-foreground text-sm">
          Responda algumas perguntas rápidas para personalizar seu plano de
          estudos.
        </p>
      </div>
      <WizardFlow />
    </div>
  );
}
