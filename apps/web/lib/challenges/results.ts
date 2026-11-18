/**
 * Forma mínima do resultado que o `SandpackTests` entrega em `onComplete`
 * (um "spec" por arquivo de teste, com `describe`s aninhados).
 */
export interface SpecResult {
  error?: unknown;
  tests: Record<string, { status: string }>;
  describes: Record<string, SpecResult>;
}

function collect(block: SpecResult): { status: string }[] {
  return [
    ...Object.values(block.tests ?? {}),
    ...Object.values(block.describes ?? {}).flatMap(collect),
  ];
}

/**
 * O desafio passou quando nenhum arquivo de teste quebrou ao carregar, existe
 * ao menos um teste e todos terminaram em "pass". Sem testes não conta como
 * aprovado: um erro de sintaxe pode impedir os testes de serem registrados.
 */
export function challengePassed(specs: Record<string, SpecResult>): boolean {
  const all = Object.values(specs);
  if (all.length === 0 || all.some((spec) => spec.error)) return false;
  const tests = all.flatMap(collect);
  return tests.length > 0 && tests.every((test) => test.status === "pass");
}

/** Contagem para a mensagem "3 de 4 testes passando". */
export function testCounts(specs: Record<string, SpecResult>) {
  const tests = Object.values(specs).flatMap(collect);
  return {
    total: tests.length,
    passed: tests.filter((test) => test.status === "pass").length,
  };
}
