"use client";

import { useEffect, useRef, useState } from "react";
import { TOPIC_NOTE_MAX_LENGTH } from "@estudeai/shared-types";
import { Textarea } from "@/components/ui/textarea";
import { useSaveTopicNote, useTopicNote } from "@/lib/roadmaps/api";

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
        <div className="bg-muted h-32 w-full animate-pulse rounded-lg" />
      ) : note.isError ? (
        <p className="text-destructive text-sm" role="alert">
          Não foi possível carregar suas anotações.
        </p>
      ) : (
        <NoteField
          roadmapId={roadmapId}
          topicId={topicId}
          initial={note.data.content}
        />
      )}
    </section>
  );
}

function NoteField({
  roadmapId,
  topicId,
  initial,
}: {
  roadmapId: string;
  topicId: string;
  initial: string;
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
      <p className="text-ink-faint text-xs" aria-live="polite">
        {save.isError
          ? "Não foi possível salvar. Continue escrevendo que tentamos de novo."
          : save.isPending || dirty
            ? "Salvando…"
            : "Salvo"}
      </p>
    </>
  );
}
