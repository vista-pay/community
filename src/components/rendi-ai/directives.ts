'use client';

/**
 * The client half of Rendi AI's no-actions guarantee.
 *
 * The server validates directives against a closed vocabulary; this file is
 * what can actually happen to the page once one arrives. It implements exactly
 * three effects — change route, scroll, draw a ring — and nothing else.
 *
 * There is intentionally no code path here that calls `.click()`, sets an
 * input's value, or dispatches an event. An element is only ever located to be
 * scrolled to or outlined. So even a directive forged past the server could
 * not make the page do anything: the capability does not exist on this side
 * either.
 *
 * Elements are found by `data-rendi-id`, never by a selector supplied from
 * outside, which is why `querySelector` is called with a value built here from
 * an allowlisted id rather than with anything the model produced.
 */

export type Directive =
  | { kind: 'navigate'; route: string; label: string }
  | { kind: 'scrollTo'; anchor: string }
  | { kind: 'highlight'; anchor: string; durationMs?: number }
  | { kind: 'focusPanel'; state: 'expanded' | 'collapsed' };

export const HIGHLIGHT_CLASS = 'rendi-ai-highlight';

/** Anchor ids are `[a-z0-9-]`, so a crafted value cannot escape the attribute. */
const SAFE_ANCHOR = /^[a-z0-9][a-z0-9-]{0,63}$/;

function findAnchor(anchor: string): HTMLElement | null {
  if (!SAFE_ANCHOR.test(anchor)) return null;
  return document.querySelector<HTMLElement>(`[data-rendi-id="${anchor}"]`);
}

/** Scroll a registered region into view. Returns false if it is not on this page. */
export function scrollToAnchor(anchor: string): boolean {
  const element = findAnchor(anchor);
  if (!element) return false;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

/**
 * Outline a registered region for a moment.
 *
 * Purely decorative — a class is added and removed. The element is never
 * focused or activated, because focusing a control is a step towards
 * triggering it and this is a guide, not a driver.
 */
export function highlightAnchor(anchor: string, durationMs = 2600): () => void {
  const element = findAnchor(anchor);
  if (!element) return () => {};

  element.classList.add(HIGHLIGHT_CLASS);
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const clamped = Math.min(Math.max(durationMs, 500), 10_000);
  const timer = window.setTimeout(() => element.classList.remove(HIGHLIGHT_CLASS), clamped);

  return () => {
    window.clearTimeout(timer);
    element.classList.remove(HIGHLIGHT_CLASS);
  };
}

/**
 * Narrow an unknown SSE payload to a directive.
 *
 * The server has already validated, so this is defence in depth rather than
 * the primary gate — but it is cheap, and it means a change on one side cannot
 * silently widen what the other side will execute.
 */
export function asDirective(raw: unknown): Directive | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const kind = value.kind;

  if (kind === 'navigate') {
    // Must be an app-internal absolute path. This is what stops a forged
    // directive navigating the officer to an external site.
    const route = typeof value.route === 'string' ? value.route : '';
    if (!/^\/[A-Za-z0-9/_-]*$/.test(route) || route.startsWith('//')) return null;
    return {
      kind: 'navigate',
      route,
      label: typeof value.label === 'string' && value.label ? value.label : route,
    };
  }
  if (kind === 'scrollTo' && typeof value.anchor === 'string' && SAFE_ANCHOR.test(value.anchor)) {
    return { kind: 'scrollTo', anchor: value.anchor };
  }
  if (kind === 'highlight' && typeof value.anchor === 'string' && SAFE_ANCHOR.test(value.anchor)) {
    return {
      kind: 'highlight',
      anchor: value.anchor,
      ...(typeof value.durationMs === 'number' ? { durationMs: value.durationMs } : {}),
    };
  }
  if (kind === 'focusPanel' && (value.state === 'expanded' || value.state === 'collapsed')) {
    return { kind: 'focusPanel', state: value.state };
  }
  return null;
}
