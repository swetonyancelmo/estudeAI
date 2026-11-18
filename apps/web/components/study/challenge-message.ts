/**
 * Resultado de uma execução dos testes de um desafio. Fica fora do
 * `challenge-editor` de propósito: o cartão do desafio usa isto, e importar o
 * editor puxaria o Sandpack inteiro para o carregamento da página.
 */
export interface ChallengeRunResult {
  passed: boolean;
  total: number;
  passing: number;
}

/** Texto do resultado, no cartão e no aviso para leitores de tela. */
export function runMessage(result: ChallengeRunResult): string {
  if (result.passed) return "Todos os testes passaram. Desafio resolvido.";
  if (result.total === 0) {
    return "Os testes não chegaram a rodar. Confira se o código tem algum erro de sintaxe.";
  }
  return `${result.passing} de ${result.total} testes passando.`;
}
