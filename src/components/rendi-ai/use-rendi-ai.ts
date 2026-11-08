'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { portalApi } from '@/services/portal';
import { asDirective, Directive, highlightAnchor, scrollToAnchor } from './directives';

export interface RendiMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  /** Navigations offered this turn, kept so the officer can re-use them. */
  jumps?: Array<{ route: string; label: string }>;
}

interface AskEvent {
  type: 'conversation' | 'status' | 'text' | 'directive' | 'done' | 'error';
  message?: string;
  text?: string;
  directive?: unknown;
  conversationId?: string;
  title?: string;
}

/**
 * Rendi AI's conversation state.
 *
 * Messages on screen are a mirror of what the server stored, not the source
 * of truth: the API replays history from the conversation record, so a chat
 * resumes identically on another device and the browser cannot fabricate a
 * turn the model never produced.
 */
export function useRendiAI(
  communityId: string | undefined,
  onConversationStarted?: () => void,
) {
  const router = useRouter();
  const pathname = usePathname();
  const [messages, setMessages] = useState<RendiMessage[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The draft lives here with the conversation so closing and reopening the
  // panel does not discard a half-typed question.
  const [draft, setDraft] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Read inside `ask` without making it a dependency, which would rebuild the
  // callback on every turn and restart the effects that depend on it.
  const conversationRef = useRef<string | null>(null);
  conversationRef.current = conversationId;

  // A question in flight is about the page the officer was on when they
  // asked. If they navigate away mid-answer, the answer is stale — drop it.
  useEffect(() => () => abortRef.current?.abort(), []);

  const runDirective = useCallback(
    (directive: Directive) => {
      switch (directive.kind) {
        case 'navigate':
          // The cast is the portal's established pattern for Next's typed
          // routes. Safety does not rest on it: the route was validated
          // against the officer's allowlist on the server and re-checked by
          // `asDirective` as an app-internal absolute path.
          router.push(directive.route as Route);
          break;
        case 'scrollTo':
          // The page may still be rendering after a navigate; one retry on the
          // next frame is enough in practice without a polling loop.
          if (!scrollToAnchor(directive.anchor)) {
            requestAnimationFrame(() => scrollToAnchor(directive.anchor));
          }
          break;
        case 'highlight':
          requestAnimationFrame(() => highlightAnchor(directive.anchor, directive.durationMs));
          break;
        case 'focusPanel':
          break;
      }
    },
    [router],
  );

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || busy) return;
      if (!communityId) {
        setError('No community selected.');
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const asked: RendiMessage = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
      const answerId = `m-${Date.now()}`;
      setMessages((previous) => [...previous, asked, { id: answerId, role: 'model', text: '' }]);
      setBusy(true);
      setError(null);
      setStatus(null);

      try {
        const response = await fetch('/api/rendi-ai/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            communityId,
            question: trimmed,
            currentRoute: pathname,
            conversationId: conversationRef.current ?? undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message ?? 'Rendi AI could not answer that.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by a blank line. Anything after the last
          // separator is a partial frame and waits for more bytes.
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            const line = frame.split('\n').find((l) => l.startsWith('data:'));
            if (!line) continue;
            let event: AskEvent;
            try {
              event = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }

            if (event.type === 'conversation' && event.conversationId) {
              // Sent before the answer so a new chat is attached even if the
              // model then fails — the question is already on the record.
              setConversationId(event.conversationId);
              conversationRef.current = event.conversationId;
              onConversationStarted?.();
            } else if (event.type === 'status' && event.message) {
              setStatus(event.message);
            } else if (event.type === 'text' && event.text) {
              setStatus(null);
              setMessages((previous) =>
                previous.map((message) =>
                  message.id === answerId
                    ? { ...message, text: `${message.text}${message.text ? '\n\n' : ''}${event.text}` }
                    : message,
                ),
              );
            } else if (event.type === 'directive') {
              const directive = asDirective(event.directive);
              if (!directive) continue;
              if (directive.kind === 'navigate') {
                setMessages((previous) =>
                  previous.map((message) =>
                    message.id === answerId
                      ? {
                          ...message,
                          jumps: [
                            ...(message.jumps ?? []),
                            { route: directive.route, label: directive.label },
                          ],
                        }
                      : message,
                  ),
                );
              }
              runDirective(directive);
            } else if (event.type === 'error') {
              throw new Error(event.message ?? 'Rendi AI could not answer that.');
            }
          }
        }
      } catch (cause) {
        if ((cause as Error)?.name === 'AbortError') return;
        const message = cause instanceof Error ? cause.message : 'Something went wrong.';
        setError(message);
        // Drop the empty placeholder so the panel does not show a blank reply.
        setMessages((previous) =>
          previous.filter((entry) => !(entry.id === answerId && !entry.text)),
        );
      } finally {
        setBusy(false);
        setStatus(null);
      }
    },
    [busy, communityId, onConversationStarted, pathname, runDirective],
  );

  /** Send the current draft, clearing it so the field is ready for the next. */
  const submit = useCallback(() => {
    const question = draft;
    setDraft('');
    void ask(question);
  }, [ask, draft]);

  /** Start a fresh conversation. The stored one is left alone. */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setStatus(null);
    setBusy(false);
    setDraft('');
    setConversationId(null);
    conversationRef.current = null;
  }, []);

  /** Open a stored conversation and continue it. */
  const openConversation = useCallback(
    async (id: string) => {
      if (!communityId) return;
      abortRef.current?.abort();
      setLoadingConversation(true);
      setError(null);
      setStatus(null);
      setBusy(false);
      try {
        const detail = await portalApi.rendiAiConversation(communityId, id);
        setMessages(
          detail.messages.map((message) => ({
            id: message.id,
            role: message.role,
            text: message.text,
          })),
        );
        setConversationId(detail.id);
        conversationRef.current = detail.id;
      } catch {
        setError('That conversation could not be opened.');
      } finally {
        setLoadingConversation(false);
      }
    },
    [communityId],
  );

  return {
    conversationId,
    openConversation,
    loadingConversation,
    messages,
    status,
    busy,
    error,
    ask,
    reset,
    draft,
    setDraft,
    submit,
    currentRoute: pathname,
  };
}
