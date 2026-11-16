'use client';

/**
 * A two-sided conversation, laid out the way every messaging app lays one out:
 * what you sent on the right, what the other side sent on the left.
 *
 * That alignment is not decoration. In a thread where both sides are "the
 * community" or "Rendi" rather than named individuals, the only reliable way
 * to tell at a glance who said what is which edge the bubble hangs from —
 * reading the author line on every message is work nobody does.
 */

import { useEffect, useRef } from 'react';
import { Download, FileText } from 'lucide-react';
import { cn, fileSize, relative } from '@/lib/format';

export interface ChatAttachment {
  id?: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  author: string;
  at: string;
  /** True when this side sent it — the bubble goes right. */
  mine: boolean;
  attachments?: ChatAttachment[];
}

const isImage = (mimeType: string) => mimeType.startsWith('image/');

export function ChatThread({
  messages,
  emptyState,
  className,
}: {
  messages: ChatMessage[];
  emptyState?: React.ReactNode;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  // Pinned to the newest message, as a conversation should open.
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length]);

  if (messages.length === 0 && emptyState) {
    return <div className={cn('flex-1 overflow-y-auto px-5 py-4', className)}>{emptyState}</div>;
  }

  return (
    <div ref={scroller} className={cn('flex-1 space-y-2 overflow-y-auto px-4 py-4', className)}>
      {messages.map((message, index) => {
        // The author is named once per run, not on every bubble — a back and
        // forth of six messages should read as two voices, not twelve labels.
        const startsRun = index === 0 || messages[index - 1].mine !== message.mine;
        return (
          <div
            key={message.id}
            className={cn('flex w-full', message.mine ? 'justify-end' : 'justify-start')}
          >
            <div className={cn('max-w-[78%] min-w-0', message.mine ? 'items-end' : 'items-start')}>
              {startsRun && (
                <p
                  className={cn(
                    'mb-1 px-1 text-[11px] font-semibold text-slate-500',
                    message.mine ? 'text-right' : 'text-left',
                  )}
                >
                  {message.author}
                </p>
              )}

              <div
                className={cn(
                  'rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                  message.mine
                    ? 'rounded-br-md bg-brand-600 text-white'
                    : 'rounded-bl-md border border-slate-200 bg-white text-navy-900',
                )}
              >
                {message.attachments && message.attachments.length > 0 && (
                  <div className={cn('space-y-2', message.text && 'mb-2')}>
                    {message.attachments.map((file) => (
                      <Attachment key={file.id ?? file.fileUrl} file={file} mine={message.mine} />
                    ))}
                  </div>
                )}

                {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}

                <p
                  className={cn(
                    'mt-1 text-[10px]',
                    message.mine ? 'text-white/70' : 'text-slate-400',
                  )}
                >
                  {relative(message.at)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * An image shows itself; anything else is a row you can click.
 *
 * A PDF rendered as a broken <img> is worse than a filename, and a filename
 * is all a document needs — the decision to open it is made from the name and
 * the size, not from a preview.
 */
function Attachment({ file, mine }: { file: ChatAttachment; mine: boolean }) {
  if (isImage(file.mimeType)) {
    return (
      <a href={file.fileUrl} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={file.fileUrl}
          alt={file.fileName}
          className="max-h-60 w-full rounded-xl object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={file.fileUrl}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors',
        mine ? 'bg-white/15 hover:bg-white/25' : 'bg-slate-100 hover:bg-slate-200',
      )}
    >
      <FileText className={cn('h-5 w-5 shrink-0', mine ? 'text-white/80' : 'text-slate-500')} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{file.fileName}</span>
        <span className={cn('block text-[11px]', mine ? 'text-white/70' : 'text-slate-500')}>
          {fileSize(file.sizeBytes)}
        </span>
      </span>
      <Download className={cn('h-4 w-4 shrink-0', mine ? 'text-white/80' : 'text-slate-400')} />
    </a>
  );
}
