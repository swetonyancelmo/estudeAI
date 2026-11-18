"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  SandpackTests,
  useSandpack,
} from "@codesandbox/sandpack-react";
import {
  CHALLENGE_TEST_FILE,
  type ChallengeDto,
  type ChallengeFiles,
} from "@estudeai/shared-types";
import {
  challengePassed,
  testCounts,
  type SpecResult,
} from "@/lib/challenges/results";
import { runMessage, type ChallengeRunResult } from "./challenge-message";

/** Pausa na digitação antes de salvar o código. */
const AUTOSAVE_MS = 1_500;

/** Bibliotecas que os testes de componentes React usam dentro do Sandpack. */
const REACT_TEST_DEPENDENCIES = {
  "@testing-library/react": "16.3.0",
  "@testing-library/dom": "10.4.0",
};

interface ChallengeEditorProps {
  challenge: ChallengeDto;
  /** Código com que o editor abre (o salvo, o inicial ou a solução). */
  files: ChallengeFiles;
  onSave: (files: ChallengeFiles) => void;
  onRun: (files: ChallengeFiles, result: ChallengeRunResult) => void;
}

/**
 * Editor do desafio (Sandpack). Carregado só quando a pessoa abre o editor
 * (`next/dynamic`), porque o Sandpack é pesado e usa o bundler do CodeSandbox.
 *
 * O arquivo de testes entra escondido e só leitura; os testes rodam no
 * navegador a cada mudança (watch), e o resultado sobe para a API.
 */
export default function ChallengeEditor({
  challenge,
  files,
  onSave,
  onRun,
}: ChallengeEditorProps) {
  const { resolvedTheme } = useTheme();
  const isReact = challenge.template === "react";

  // Tudo o que vai para o SandpackProvider é estável entre renders: o editor
  // re-renderiza a cada salvamento (o status volta do servidor), e objetos
  // novos aqui fariam o Sandpack reconfigurar e rodar os testes de novo.
  const editable = useMemo(
    () => Object.keys(challenge.starterFiles),
    [challenge.starterFiles],
  );
  const providerFiles = useMemo(
    () => ({
      ...files,
      [CHALLENGE_TEST_FILE]: {
        code: challenge.tests,
        hidden: true,
        readOnly: true,
      },
    }),
    [files, challenge.tests],
  );
  const customSetup = useMemo(
    () => (isReact ? { dependencies: REACT_TEST_DEPENDENCIES } : undefined),
    [isReact],
  );
  const options = useMemo(
    () => ({ activeFile: editable[0], visibleFiles: editable }),
    [editable],
  );

  // Callbacks do pai mudam a cada render; os filhos leem sempre a versão atual.
  const handlers = useRef({ onSave, onRun });
  useEffect(() => {
    handlers.current = { onSave, onRun };
  });
  const save = useCallback(
    (next: ChallengeFiles) => handlers.current.onSave(next),
    [],
  );
  const run = useCallback(
    (next: ChallengeFiles, result: ChallengeRunResult) =>
      handlers.current.onRun(next, result),
    [],
  );

  return (
    <SandpackProvider
      template={challenge.template}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      files={providerFiles}
      customSetup={customSetup}
      options={options}
    >
      <div className="border-border overflow-hidden rounded-lg border [&_.sp-layout]:rounded-none [&_.sp-layout]:border-0">
        <SandpackLayout>
          <SandpackCodeEditor
            showLineNumbers
            showTabs={editable.length > 1}
            style={{ height: isReact ? 360 : 320 }}
          />
          {isReact && <SandpackPreview style={{ height: 360 }} />}
        </SandpackLayout>
        <TestsPanel editable={editable} onRun={run} />
      </div>
      <AutoSave editable={editable} onSave={save} />
    </SandpackProvider>
  );
}

/** Só os arquivos editáveis do desafio, com o código atual do editor. */
function useEditableFiles(editable: string[]): ChallengeFiles {
  const { sandpack } = useSandpack();
  return Object.fromEntries(
    editable.map((path) => [path, sandpack.files[path]?.code ?? ""]),
  );
}

function TestsPanel({
  editable,
  onRun,
}: {
  editable: string[];
  onRun: ChallengeEditorProps["onRun"];
}) {
  const files = useEditableFiles(editable);
  const latest = useRef({ files, onRun });
  useEffect(() => {
    latest.current = { files, onRun };
  });
  /** Último par código + resultado enviado: repetir não chama a API. */
  const lastReported = useRef("");
  const [summary, setSummary] = useState<ChallengeRunResult | null>(null);

  // Uma função só durante toda a vida do editor: o SandpackTests não pode ver
  // um `onComplete` novo a cada render, senão roda os testes de novo, o
  // resultado é salvo, o cartão re-renderiza... e vira um laço de requisições.
  //
  // O SandpackTests chama `onComplete` durante a própria renderização; mudar
  // estado ali ("Cannot update a component while rendering...") é proibido no
  // React, então o tratamento vai para logo depois, num microtask.
  const handleComplete = useCallback((specs: Record<string, unknown>) => {
    queueMicrotask(() => {
      const results = specs as unknown as Record<string, SpecResult>;
      const counts = testCounts(results);
      const result = {
        passed: challengePassed(results),
        total: counts.total,
        passing: counts.passed,
      };
      setSummary(result);
      const { files: current, onRun: report } = latest.current;
      const key = JSON.stringify([current, result]);
      if (key === lastReported.current) return;
      lastReported.current = key;
      report(current, result);
    });
  }, []);

  return (
    <div className="border-border border-t">
      <SandpackTests
        watchMode
        showWatchButton={false}
        showVerboseButton={false}
        style={{ height: 220 }}
        onComplete={handleComplete}
      />
      <p className="sr-only" aria-live="polite">
        {summary && runMessage(summary)}
      </p>
    </div>
  );
}

/** Salva o código pouco depois de a pessoa parar de digitar. */
function AutoSave({
  editable,
  onSave,
}: {
  editable: string[];
  onSave: ChallengeEditorProps["onSave"];
}) {
  const files = useEditableFiles(editable);
  const serialized = JSON.stringify(files);
  const first = useRef(serialized);
  const save = useRef(onSave);
  useEffect(() => {
    save.current = onSave;
  });

  useEffect(() => {
    // Abrir o editor não é edição: só salva depois que o código mudar.
    if (serialized === first.current) return;
    const timer = setTimeout(
      () => save.current(JSON.parse(serialized) as ChallengeFiles),
      AUTOSAVE_MS,
    );
    return () => clearTimeout(timer);
  }, [serialized]);

  return null;
}
