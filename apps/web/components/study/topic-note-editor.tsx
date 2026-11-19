"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { TOPIC_NOTE_MAX_LENGTH } from "@estudeai/shared-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaveTopicNote, useTopicNote } from "@/lib/roadmaps/api";
import { timeAgo } from "@/lib/study/time";

/** Pausa na digitação antes de salvar. */
const AUTOSAVE_MS = 1_000;

/**
 * Anotações do tópico com salvamento automático. Mostra o editor só depois de
 * carregar o texto salvo: um editor vazio que aceita digitação antes disso
 * sobrescreveria a anotação existente no primeiro autosave.
 */
export function TopicNoteEditor({
  roadmapId,
  topicId,
}: {
  roadmapId: string;
  topicId: string;
}) {
  const note = useTopicNote(roadmapId, topicId);

  return (
    <section className="flex flex-col gap-2">
      <label htmlFor="topic-note" className="data-label text-ink-faint">
        Suas anotações
      </label>
      {note.isPending ? (
        <Skeleton className="h-32 w-full rounded-lg" />
      ) : note.isError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>
            Não foi possível carregar suas anotações.
          </AlertDescription>
        </Alert>
      ) : (
        <NoteField
          roadmapId={roadmapId}
          topicId={topicId}
          initial={note.data.content}
          savedAt={note.data.updatedAt}
        />
      )}
    </section>
  );
}

function NoteField({
  roadmapId,
  topicId,
  initial,
  savedAt,
}: {
  roadmapId: string;
  topicId: string;
  initial: string;
  /** Último salvamento no servidor (atualizado pelo cache a cada PUT). */
  savedAt: string | null;
}) {
  const save = useSaveTopicNote(roadmapId, topicId);
  const [content, setContent] = useState(initial);
  const saved = useRef(initial);
  /** Espelho de `saved` para o render (ref não pode ser lida no render). */
  const [savedContent, setSavedContent] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ content, mutate: save.mutate });
  useEffect(() => {
    latest.current = { content, mutate: save.mutate };
  });

  function flush() {
    clearTimeout(timer.current);
    const { content: current, mutate } = latest.current;
    if (current === saved.current) return;
    saved.current = current;
    setSavedContent(current);
    mutate(current);
  }

  // Sair da página (ou trocar de tópico) com texto pendente: salva na hora.
  useEffect(() => flush, []);

  const dirty = content !== savedContent;

  // Relógio do "salvo há 2 min": avança a cada 30s, sem depender de digitação.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  return (
    <>
      <Textarea
        id="topic-note"
        value={content}
        maxLength={TOPIC_NOTE_MAX_LENGTH}
        placeholder="Resuma com suas palavras, anote dúvidas e trechos de código."
        className="min-h-40"
        onChange={(event) => {
          setContent(event.target.value);
          clearTimeout(timer.current);
          timer.current = setTimeout(flush, AUTOSAVE_MS);
        }}
        onBlur={flush}
      />
      <p className="data-label text-ink-faint" aria-live="polite">
        {save.isError
          ? "Não foi possível salvar. Continue escrevendo que tentamos de novo."
          : save.isPending || dirty
            ? "Salvando…"
            : savedAt
              ? `Salvo ${timeAgo(savedAt, now)}`
              : "Nada salvo ainda"}
      </p>
    </>
  );
}
