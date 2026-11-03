/**
 * Reading an error out of an upstream response.
 *
 * The Rendi API always answers with `{ success, statusCode, message }`. When
 * the body does not look like that, the request did not reach the API — the
 * usual cause is `API_BASE` pointing at something else on the same port, and
 * the usual symptom is a generic "could not do the thing" that blames the
 * user for someone else's 400.
 */

export interface UpstreamFailure {
  message: string;
  /** True when the responder was not the Rendi API. */
  misrouted: boolean;
}

/** Fields other servers use for the human-readable part of an error. */
function foreignMessage(body: Record<string, unknown>): string | null {
  for (const key of ['detail', 'error_description', 'title', 'error']) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

export function readUpstreamError(
  status: number,
  body: unknown,
  fallback: string,
): UpstreamFailure {
  const json = (body ?? {}) as Record<string, unknown>;

  // The Rendi shape. `message` is an array when class-validator rejects a DTO.
  const message = json.message;
  if (typeof message === 'string' && message.trim()) {
    return { message, misrouted: false };
  }
  if (Array.isArray(message) && message.length) {
    return { message: message.join(', '), misrouted: false };
  }

  const foreign = foreignMessage(json);

  // Something answered, but not the API. Say that plainly rather than
  // reporting it as a problem with what the person typed.
  const where = process.env.API_BASE ?? 'http://localhost:9100/api/v1';
  return {
    message:
      `${fallback} The API did not respond as expected (HTTP ${status}` +
      `${foreign ? `: ${foreign}` : ''}). ` +
      `Check that the Rendi API is running and that API_BASE is correct — it is currently ${where}.`,
    misrouted: true,
  };
}
