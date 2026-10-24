# Vista Community Portal

The officer-facing workspace for a cooperative or association on Vista:
members, contributions and Ajo, loans, savings, the community's own books,
governance, communications and billing.

Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript.

## Run

```bash
pnpm install          # or npm install
API_BASE=http://localhost:9000/api/v1 pnpm dev   # http://localhost:3200
pnpm build && pnpm start
pnpm typecheck && pnpm lint
```

`API_BASE` points at the Nest API. It is deliberately **not** a
`NEXT_PUBLIC_` variable — the browser never talks to the API directly.

> **Check the port.** The default is `:9000`, which on some machines is taken
> by other local services (an S3 mock, for instance). If something else is
> listening there, every call fails with a generic error that reads like a
> problem with what the user typed. The server checks this at boot and prints
> `API_BASE looks wrong` with the reason — start the API on a free port and
> point `API_BASE` at it.

## How it is put together

```
src/
  app/
    (auth)/signin          sign-in
    (portal)/              everything behind a session, inside AppShell
    api/auth/*             login, logout, session, refresh (see api/README.md)
    api/proxy/[...path]    the only route from the browser to the API
    onboarding/account     create an account, verify it, register a community
  components/
    ui/                    the design system (Button, Card, Table, Modal…)
    layout/                shell, sidebar, notifications
    providers/             session and toasts
    charts/                Recharts wrappers
  hooks/                   useQuery / useMutation / useDebounced
  lib/                     api clients, money maths, formatting, session
  server/                  server-only reads for server components
  services/portal.ts       every API call the portal makes, typed
```

**Onboarding is three steps,** because the API needs them in that order:
create the Vista account (`/auth/register`, no session yet), confirm the
emailed code (`/auth/verify-otp`, which activates the account and issues the
first tokens), then register the community (`POST /communities`, which is
authenticated). Someone already signed in starts at the last step.

**Pages are server components.** Each one fetches with the session cookie and
hands the result to a client component as `initial`, so the first paint is
real data. The client half refetches through the proxy when an officer acts.

**No token ever reaches the browser.** The Nest API returns bearer tokens in
the response body; the route handlers put them in HttpOnly cookies and the
proxy attaches them. A script-readable token would turn any XSS into control
of the cooperative's money. The only script-visible cookie is `vcp_session`,
a flag with no credential in it, which the middleware uses for routing.

**Money is a decimal string end to end.** `lib/money.ts` does the arithmetic
in integer minor units. Nothing is parsed to a JS number except for chart
geometry, where the exact figure is printed beside it anyway.

## What is not here

The Vista platform-owner console (plans, invoices, coupons, listing reviews)
lives in the separate `admin/` app, against `/admin/*`. A community officer's
token cannot call those endpoints, so the screens do not belong in this app.
