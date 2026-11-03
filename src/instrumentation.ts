/**
 * Runs once when the server starts.
 *
 * The only job here is to fail loudly if API_BASE is not the Rendi API.
 * Finding that out at boot costs one request; finding it out from a user's
 * failed registration costs an afternoon.
 */
export async function register() {
  // Only in the Node runtime — the edge runtime has no outbound fetch budget
  // for this and the middleware does not need it.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { checkApiBase } = await import('./lib/constants');
  const result = await checkApiBase();

  if (result.ok) {
    console.log(`[vista-portal] ${result.detail}`);
    return;
  }

  console.error(
    `\n[vista-portal] API_BASE looks wrong.\n` +
      `  ${result.detail}\n` +
      `  Set API_BASE to the Rendi API, e.g.\n` +
      `    API_BASE=http://localhost:9100/api/v1 pnpm dev\n`,
  );
}
