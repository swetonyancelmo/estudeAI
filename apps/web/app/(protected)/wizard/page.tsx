import { WizardFlow } from "@/components/wizard/wizard-flow";

/**
 * Diagnóstico em tela cheia: uma pergunta grande por vez, sem cabeçalho
 * explicativo competindo — a própria pergunta é o título da página.
 */
export default function WizardPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10 sm:px-10 sm:py-16">
      <WizardFlow />
    </div>
  );
}
