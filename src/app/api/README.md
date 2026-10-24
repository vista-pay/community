# Route handlers

The browser never holds a Vista token.

- `POST /api/auth/login` — exchanges credentials with the Nest API and writes
  the access and refresh tokens into HttpOnly cookies. The JSON it returns has
  no token in it.
- `POST /api/auth/logout` — clears the cookies.
- `GET  /api/auth/session` — who the officer is and which community is active.
- `POST /api/auth/session` — switch active community (membership is checked).
- `POST /api/auth/refresh` — refreshes the pair; used by the proxy, not the UI.
- `ALL  /api/proxy/<nest path>` — forwards to the API with the bearer token
  attached from the cookie, retrying once behind a refresh on 401.

Server components skip the proxy and call `apiServer()` directly; it reads the
same cookie. Client components use `src/lib/api.ts`, which only ever calls
same-origin `/api/proxy/...`.
