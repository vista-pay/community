import type { ReactNode } from 'react';

/**
 * Marks a region of a page as something Rendi AI may point at.
 *
 * Rendi AI can only scroll to or outline regions that carry a
 * `data-rendi-id`, and only ids its surface has registered in
 * `community-routes.ts`. Both halves are needed: an id here that the surface
 * does not know about is never targeted, and an id the surface knows about
 * that does not appear on the page is reported as missing rather than
 * silently ignored.
 *
 * This is also the only coupling between the guide and the UI. A page that
 * wants to be explainable adds anchors; nothing else changes, and no page has
 * to know Rendi AI exists.
 */
export function RendiAnchor({
  id,
  children,
  className,
  as: Tag = 'div',
}: {
  /** Must match an anchor registered for this route. Lowercase, hyphenated. */
  id: string;
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <Tag data-rendi-id={id} className={className}>
      {children}
    </Tag>
  );
}
