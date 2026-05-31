# Phase 1 — Foundation & Polish (repair-focused pass)

Scope decision: executed the approved Phase 1 spec **minus PostgreSQL** (the app
is stateless; persistence is a Phase 2/3 feature, not repair). Default model set
to **gpt-4.1-mini** per user request.

## Tasks

- [x] **Security remediation**
  - [x] Add root `.gitignore` (`.env`, `node_modules/`, uploaded PDFs, `.DS_Store`, stray lockfiles, build output)
  - [x] `git rm --cached` the tracked `.env`, all `node_modules/`, leaked PDFs in `backend/pdfsummary/`, `.DS_Store`
  - [x] Add `.env.example`; keep upload dir via `.gitkeep`
  - [x] Remove leftover `package-lock-LAPTOP-PS4ENIGN.json`
  - [ ] **USER ACTION:** rotate the OpenAI key — it remains in git *history* (treat as compromised)
- [x] **Backend dependency cleanup** — 26 deps → 6 runtime + 4 dev (jest, supertest, nodemon, concurrently)
- [x] **Backend restructure** — `server.js` (199 lines, monolith) split into `config.js`, `app.js`, `server.js`, `routes/summary.js`, `services/{pdf,summarize,tokens}.js`
- [x] **OpenAI v3 → v4** SDK (`new OpenAI()` + `chat.completions.create`); model `gpt-4.1-mini`; single-call default, chunking kept only as fallback; rewrote the buggy chunker
- [x] **Hardening + bug fixes** — 20 MB multer limit, PDF mimetype+extension filter, temp-file cleanup in `finally`, centralized error handler returning only safe messages, `/api/health`
- [x] **Frontend** — fixed stuck-loading bug (validate before `setLoading(true)`), added the missing `axios` dependency, removed 6 unused packages
- [x] **Tests** — Jest + supertest; 19 tests across tokens/summarize(mocked)/pdf(real fixture)/route(integration)

## Review / results

- `npm test` (backend): **19/19 pass**, 4 suites.
- Frontend `react-scripts build`: **compiled successfully**.
- Server boots; `GET /api/health` → `{"status":"ok"}`; config fails fast on missing `OPENAI_API_KEY`.
- No secrets / `node_modules` / uploaded PDFs tracked by git anymore.

## Hardening pass 2 (Listening Room parity)

- [x] **Rate limiting** — `express-rate-limit` on `/api/pdfsummary` (default 20/hr per IP, env-configurable); `trust proxy` set for real client IP behind Railway.
- [x] **Input validation** — `maxWords` bounded to 10–2500; out-of-range/non-integer -> 400. Frontend input gets `max=2500`.
- [x] **Timeouts/retries** — OpenAI client `timeout` (60s) + `maxRetries` (2); frontend `axios` 120s timeout + surfaces server's safe error message.
- [x] **Deploy artifacts** — `Dockerfile` (backend, node:20-alpine) + `.dockerignore`; CORS via `ALLOWED_ORIGINS`; frontend API URL via `REACT_APP_API_BASE_URL` (+ `frontend/.env.example`).
- Tests now 25/25. Docker image not built locally (docker unavailable) — Dockerfile is standard, no native deps.

## Out of scope (later phases)

PostgreSQL persistence, library/history, chat/RAG, auth — see the design spec.
Optional follow-up: `git filter-repo` to purge the key from history (rotation is
the real remediation); address `npm audit` advisories from transitive deps.
