'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import {
  ArrowRight,
  Compass,
  History,
  MessageCircleQuestion,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { portalApi } from '@/services/portal';
import type { RendiAiConversationSummary } from '@/types';
import { relative } from '@/lib/format';
import { useRendiAI } from './use-rendi-ai';

/**
 * Rendi AI's right sidebar.
 *
 * A sidebar rather than a floating dock because the guide's whole value is
 * being answerable *while* an officer works: it needs to sit beside the page
 * it is explaining, not on top of it. From `xl` up the content reflows to
 * make room (`xl:pr-[380px]` on the shell's content column, which must stay
 * in step with this panel's width) so nothing it points at ends up hidden
 * behind it — self-defeating for a thing whose job includes highlighting
 * regions of the page.
 *
 * Below `xl` there is not enough width to show both, so it overlays with a
 * backdrop and the officer closes it to get back to the page.
 *
 * Open state is owned by the shell, not here, because opening also collapses
 * the left sidebar — one panel cannot sensibly drive another sibling's state.
 */

const SUGGESTIONS = [
  'What am I looking at on this page?',
  'Where do I see members who have not paid their dues?',
  'How much is out on loan right now?',
  'Explain the difference between our wallet balance and member savings',
];

export function RendiAiPanel({
  communityId,
  open,
  onClose,
}: {
  communityId: string | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<RendiAiConversationSummary[]>([]);
  const [showSessions, setShowSessions] = useState(false);

  /**
   * Fetched on demand — when the officer opens the history, and again when a
   * new conversation is created so the list they are about to open is
   * current. Never on mount: someone who does not use Rendi AI should not be
   * paying for a list they will never see.
   */
  const refreshSessions = useCallback(async () => {
    if (!communityId) return;
    try {
      setSessions(await portalApi.rendiAiConversations(communityId));
    } catch {
      // A failed list is not worth interrupting the conversation for.
    }
  }, [communityId]);

  const {
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
  } = useRendiAI(communityId, refreshSessions);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const deleteSession = async (id: string) => {
    if (!communityId) return;
    setSessions((previous) => previous.filter((session) => session.id !== id));
    try {
      await portalApi.deleteRendiAiConversation(communityId, id);
      if (id === conversationId) reset();
    } catch {
      void refreshSessions();
    }
  };

  // Keep the newest exchange in view as text streams in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!communityId) return null;

  return (
    <>
      {/* Overlay only where the content cannot make room for the panel. */}
      {open && (
        <button
          type="button"
          aria-label="Close Rendi AI"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-navy-950/30 xl:hidden"
        />
      )}

      <aside
        aria-label="Rendi AI"
        aria-hidden={!open}
        className={cnPanel(open)}
        // Keeps the whole panel out of the tab order while closed, so an
        // officer tabbing through the header does not land inside a
        // conversation sitting off-screen.
        inert={!open}
      >
        <header className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-50">
              <Compass className="h-4 w-4 text-navy-700" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-navy-900">Rendi AI</p>
              <p className="truncate text-[11px] leading-tight text-slate-500">
                Explains and navigates — never changes anything
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setShowSessions((previous) => !previous);
                void refreshSessions();
              }}
              className={`rounded-lg p-1.5 focus-ring ${
                showSessions
                  ? 'bg-navy-50 text-navy-700'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
              aria-label="Past conversations"
              aria-expanded={showSessions}
            >
              <History className="h-4 w-4" aria-hidden />
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  reset();
                  setShowSessions(false);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-ring"
                aria-label="New conversation"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-ring"
              aria-label="Close Rendi AI"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        {showSessions ? (
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <button
              type="button"
              onClick={() => {
                reset();
                setShowSessions(false);
              }}
              className="mb-2 flex w-full items-center gap-2 rounded-xl border border-navy-200 bg-navy-50 px-3 py-2.5 text-[13px] font-semibold text-navy-700 hover:bg-navy-100 focus-ring"
            >
              <Plus className="h-4 w-4" aria-hidden />
              New conversation
            </button>

            {sessions.length === 0 ? (
              <p className="px-1 py-6 text-center text-[12px] text-slate-500">
                No past conversations yet.
              </p>
            ) : (
              <ul className="space-y-1">
                {sessions.map((session) => (
                  <li key={session.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        void openConversation(session.id);
                        setShowSessions(false);
                      }}
                      className={`w-full rounded-xl border px-3 py-2.5 pr-9 text-left focus-ring ${
                        session.id === conversationId
                          ? 'border-navy-300 bg-navy-50'
                          : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block truncate text-[13px] font-medium text-navy-900">
                        {session.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {relative(session.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSession(session.id)}
                      aria-label={`Delete conversation: ${session.title}`}
                      className="absolute right-2 top-2.5 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus-ring group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {loadingConversation && (
            <p className="text-[12px] italic text-slate-400">Opening conversation…</p>
          )}
          {messages.length === 0 && !loadingConversation && (
            <div className="space-y-3">
              <p className="text-[13px] leading-relaxed text-slate-600">
                I can tell you what a page is for, read your figures back to you, and take you
                where you need to go. I cannot approve, post or pay anything — you always do that
                yourself.
              </p>
              <div className="space-y-1.5">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void ask(suggestion)}
                    className="flex w-full items-start gap-2 rounded-xl border border-slate-200 p-2.5 text-left text-[13px] text-slate-700 hover:border-navy-300 hover:bg-navy-50/60 focus-ring"
                  >
                    <MessageCircleQuestion
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-600"
                      aria-hidden
                    />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) =>
            message.role === 'user' ? (
              <p
                key={message.id}
                className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-navy-800 px-3 py-2 text-[13px] font-medium text-white"
              >
                {message.text}
              </p>
            ) : (
              <div key={message.id} className="max-w-[92%] space-y-2">
                {message.text && (
                  <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-800">
                    {message.text}
                  </div>
                )}
                {message.jumps?.map((jump) => (
                  <Link
                    key={`${message.id}-${jump.route}`}
                    href={jump.route as Route}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-navy-50 px-2.5 py-1.5 text-[12px] font-semibold text-navy-700 hover:bg-navy-100 focus-ring"
                  >
                    {jump.label}
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                ))}
              </div>
            ),
          )}

          {/* One live region for both, so a screen reader hears progress and
              the answer in order rather than as two competing announcements. */}
          <div aria-live="polite" className="space-y-1">
            {status && (
              <p className="flex items-center gap-2 text-[12px] italic text-slate-500">
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-navy-600"
                  aria-hidden
                />
                {status}
              </p>
            )}
            {busy && !status && <p className="text-[12px] italic text-slate-400">Thinking…</p>}
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>
          )}
        </div>
        )}

        <form
          className="flex items-end gap-2 border-t border-slate-200/80 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter breaks the line.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Ask about this page…"
            aria-label="Ask Rendi AI a question"
            className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] text-navy-900 outline-none focus:border-navy-500"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-800 text-white disabled:opacity-40 focus-ring"
            aria-label="Send"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </aside>
    </>
  );
}

/**
 * Translated off-screen rather than unmounted, so a conversation survives
 * being closed and reopened — an officer who shuts the panel to look at the
 * page should not lose what Rendi AI just told them.
 */
function cnPanel(open: boolean) {
  return [
    'fixed inset-y-0 right-0 z-40 flex w-[min(380px,100vw)] flex-col border-l border-slate-200/80 bg-white',
    'transition-transform duration-200 ease-out motion-reduce:transition-none',
    open ? 'translate-x-0 shadow-2xl xl:shadow-none' : 'translate-x-full',
  ].join(' ');
}
