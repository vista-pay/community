'use client';

import { useState } from 'react';
import { Check, Copy, Mail, QrCode, Share2 } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Field,
  Input,
  Modal,
  Textarea,
} from '@/components/ui';
import { useMutation } from '@/hooks/use-query';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { JOIN_LINK_BASE } from '@/lib/constants';
import { date } from '@/lib/format';

interface Invitation {
  identifier: string | null;
  token: string;
  expiresAt: string;
  shareUrl: string;
}

/**
 * Getting people into a group.
 *
 * Two kinds of invitation, because they are used in different rooms:
 *
 *   The group code is reusable and never expires. It is what you read out at
 *   a meeting, print on a flyer, or hold up as a QR for forty people to scan
 *   at once.
 *
 *   A personal invitation is a token tied to one email, phone or Vista tag,
 *   and it expires. It is what you send to someone who was not in the room.
 *
 * Both are shown with a QR, because the people joining are on phones and
 * typing a token by hand is how a code gets mistyped.
 */
export function InvitePanel({
  groupId,
  groupName,
  invitationCode,
  memberCount,
  memberLimit,
}: {
  groupId: string;
  groupName: string;
  invitationCode: string | null;
  memberCount: number;
  memberLimit: number;
}) {
  const { toast } = useToast();
  const [inviting, setInviting] = useState(false);
  const [minted, setMinted] = useState<Invitation[]>([]);

  const joinUrl = invitationCode ? `${JOIN_LINK_BASE}/${invitationCode}` : null;
  const seatsLeft = Math.max(0, memberLimit - memberCount);
  const full = seatsLeft === 0;

  return (
    <>
      <Card>
        <CardHeader
          title="Invite members"
          subtitle={
            full
              ? 'This group is full'
              : `${seatsLeft} place${seatsLeft === 1 ? '' : 's'} left of ${memberLimit}`
          }
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={<Mail className="h-3.5 w-3.5" />}
              onClick={() => setInviting(true)}
              disabled={full}
            >
              Invite by email or phone
            </Button>
          }
        />

        {!invitationCode ? (
          <p className="px-5 py-6 text-[13px] text-slate-500">
            This group has no shareable code. Invite people individually instead.
          </p>
        ) : (
          <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row">
            <QrPanel value={joinUrl ?? invitationCode} />

            <div className="min-w-0 flex-1 space-y-4">
              <CopyRow
                label="Invite code"
                value={invitationCode}
                hint="Read this out at a meeting; members enter it in the Vista app."
                mono
              />

              {joinUrl && (
                <CopyRow
                  label="Invite link"
                  value={joinUrl}
                  hint="Opens the group in the Vista app, ready to join."
                />
              )}

              <ShareButton
                groupName={groupName}
                code={invitationCode}
                url={joinUrl}
                onCopied={() =>
                  toast('Invitation copied', 'success', 'Paste it into WhatsApp or SMS.')
                }
              />

              {full && (
                <Callout tone="warning">
                  Every place is taken. Raise the member limit before sharing this further, or
                  nobody scanning it will be able to join.
                </Callout>
              )}
            </div>
          </div>
        )}

        {minted.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-4">
            <p className="eyebrow mb-2">Personal invitations just sent</p>
            <ul className="space-y-3">
              {minted.map((i) => (
                <li key={i.token} className="flex items-start gap-3">
                  <QrPanel value={i.shareUrl} size={96} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-navy-900">
                      {i.identifier ?? 'Open link'}
                    </p>
                    <p className="truncate text-xs text-slate-500">{i.shareUrl}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Expires {date(i.expiresAt)}
                    </p>
                  </div>
                  <CopyButton value={i.shareUrl} label={`Copy link for ${i.identifier ?? 'invite'}`} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <InviteModal
        open={inviting}
        onClose={() => setInviting(false)}
        groupId={groupId}
        seatsLeft={seatsLeft}
        onMinted={(invitations) => {
          setMinted(invitations);
          setInviting(false);
        }}
      />
    </>
  );
}

/** The QR itself, rendered by this app's own /api/qr route. */
function QrPanel({ value, size = 160 }: { value: string; size?: number }) {
  return (
    <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- an SVG from our
          own route; next/image cannot optimise it and would only add a hop. */}
      <img
        src={`/api/qr?text=${encodeURIComponent(value)}&size=${size}`}
        alt={`QR code for ${value}`}
        width={size}
        height={size}
        className="block"
      />
    </div>
  );
}

function CopyRow({
  label,
  value,
  hint,
  mono,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code
          className={`min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-navy-900 ${
            mono ? 'font-mono tracking-widest' : ''
          }`}
        >
          {value}
        </code>
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          // Long enough to notice, short enough that the button is ready
          // again before they reach for it twice.
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Clipboard access can be refused; the value is on screen to select.
        }
      }}
      className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 hover:text-navy-900 focus-ring"
    >
      {copied ? (
        <Check className="h-4 w-4 text-brand-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

/** Uses the native share sheet where there is one, the clipboard otherwise. */
function ShareButton({
  groupName,
  code,
  url,
  onCopied,
}: {
  groupName: string;
  code: string;
  url: string | null;
  onCopied: () => void;
}) {
  const message = `Join my Ajo group “${groupName}” on Vista.\n\nInvite code: ${code}${
    url ? `\n${url}` : ''
  }`;

  return (
    <Button
      variant="secondary"
      icon={<Share2 className="h-4 w-4" />}
      onClick={async () => {
        if (typeof navigator !== 'undefined' && 'share' in navigator) {
          try {
            await navigator.share({ title: `Join ${groupName}`, text: message });
            return;
          } catch {
            // Dismissed, or unavailable — fall through to the clipboard.
          }
        }
        await navigator.clipboard.writeText(message).then(onCopied).catch(() => {});
      }}
    >
      Share invitation
    </Button>
  );
}

function InviteModal({
  open,
  onClose,
  groupId,
  seatsLeft,
  onMinted,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  seatsLeft: number;
  onMinted: (invitations: Invitation[]) => void;
}) {
  const { toast } = useToast();
  const [raw, setRaw] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('7');

  // One per line or comma-separated, because people paste from a spreadsheet
  // as often as they type.
  const identifiers = raw
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);

  const tooMany = identifiers.length > seatsLeft;

  const send = useMutation(
    () =>
      portalApi.inviteMembers(groupId, {
        identifiers,
        expiresInDays: Number(expiresInDays),
      }),
    {
      onSuccess: (invitations) => {
        toast(
          `${invitations.length} invitation${invitations.length === 1 ? '' : 's'} created`,
          'success',
        );
        setRaw('');
        onMinted(invitations);
      },
      onError: (message) => toast('Could not create the invitations', 'error', message),
    },
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite people"
      description="Each person gets their own link, which expires."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={identifiers.length === 0 || tooMany}
            loading={send.pending}
            onClick={() => void send.run()}
          >
            Create {identifiers.length || ''} invitation{identifiers.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {send.error && <Callout tone="danger">{send.error}</Callout>}

        <Field
          label="Email, phone or Vista tag"
          htmlFor="inv-ids"
          required
          hint="One per line, or separated by commas"
        >
          <Textarea
            id="inv-ids"
            rows={5}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={'ada@example.com\n+234 801 234 5678\n@ada.vista'}
          />
        </Field>

        <Field label="Invitation expires in" htmlFor="inv-exp" required>
          <Input
            id="inv-exp"
            type="number"
            min="1"
            max="90"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            suffix="days"
          />
        </Field>

        {identifiers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tooMany ? 'red' : 'slate'}>
              {identifiers.length} recipient{identifiers.length === 1 ? '' : 's'}
            </Badge>
            <span className="text-xs text-slate-500">
              {seatsLeft} place{seatsLeft === 1 ? '' : 's'} left
            </span>
          </div>
        )}

        {tooMany && (
          <Callout tone="warning" title="More invitations than places">
            {identifiers.length} people for {seatsLeft} place
            {seatsLeft === 1 ? '' : 's'}. Whoever accepts last will be turned away — raise the
            member limit first, or invite fewer people.
          </Callout>
        )}
      </div>
    </Modal>
  );
}

/** Compact version for a list row: opens the full panel in a dialog. */
export function InviteButton({
  groupId,
  groupName,
  invitationCode,
  memberCount,
  memberLimit,
}: {
  groupId: string;
  groupName: string;
  invitationCode: string | null;
  memberCount: number;
  memberLimit: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="xs"
        variant="secondary"
        icon={<QrCode className="h-3.5 w-3.5" />}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        Invite
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={`Invite to ${groupName}`}>
        <InvitePanel
          groupId={groupId}
          groupName={groupName}
          invitationCode={invitationCode}
          memberCount={memberCount}
          memberLimit={memberLimit}
        />
      </Modal>
    </>
  );
}
