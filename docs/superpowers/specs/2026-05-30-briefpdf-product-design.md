# BriefPDFReader — Product Design & Phase 1 Spec

**Date:** 2026-05-30
**Status:** Approved (design); Phase 1 ready for implementation planning

## Vision

Evolve BriefPDFReader from a single-purpose PDF summarizer into a **document
workspace**: upload a PDF → get a summary in a chosen format → keep it in a
searchable library → and chat/ask questions grounded in the document. Hosted and
multi-user-ready, with user accounts as a clean later addition.

### Decisions captured during brainstorming

- **Goal:** a capable real product (not just a polished portfolio piece).
- **Priority features:** chat/Q&A with the PDF, a summary history/library, richer
  output options. (User accounts were *not* prioritized — single-user first.)
- **Deployment:** hosted, multi-user *later*. Start single-user but design the
  schema so a `user_id` slots in cleanly.
- **Datastore:** PostgreSQL + `pgvector` (one store for relational data and the
  vector search the chat feature needs).
- **Architecture approach:** keep the existing React + Express stack and refactor
  incrementally (rejected: Next.js full rewrite; a separate Python NLP service).

## Current state (baseline)

- **Frontend** (React CRA): one page — upload a PDF, pick a target word count,
  receive a summary string.
- **Backend** (single `backend/server.js`): extract PDF text → recursive
  chunk-and-summarize via OpenAI `gpt-3.5-turbo-16k` (deprecated v3 SDK) → return
  the final summary.

### Known problems in the baseline

- ⚠️ **`.env` is tracked in git with a real `OPENAI_API_KEY`**; there is **no
  `.gitignore`** anywhere, and `node_modules/` plus uploaded PDFs in
  `backend/pdfsummary/` are committed.
- Deprecated OpenAI **v3 SDK** and old `gpt-3.5-turbo-16k` model.
- **Stuck-loading bug:** when `maxWords` is empty, `handleSubmit` sets
  `loading=true` then `return`s without resetting it.
- Temp uploads are **never deleted** after processing.
- No file-size limit, no rate limiting; the error `catch` leaks raw error objects.
- ~30 dependencies installed; only 6 are used (`express`, `dotenv`, `openai`,
  `multer`, `pdf.js-extract`, `gpt-3-encoder`).
- Zero tests.

## Phase decomposition

| Phase | Scope | Rationale |
|------|-------|-----------|
| **1 — Foundation & modernization** | Fix the `.env`/uploads security leak, upgrade OpenAI SDK v3→v4 + modern model, trim dead deps, fix the loading bug, add file-size limits + temp-file cleanup, introduce Postgres + a modular backend (routes/services/migrations). | Everything else builds on this; security + structure first. |
| **2 — Library & richer output** | Persist documents + summaries; summary options (length, format: bullets/TL;DR/key points, tone); copy & download (md/PDF); library UI to browse/search/re-open. | Delivers two priority features; needs Phase 1 persistence. |
| **3 — Chat / Q&A (RAG)** | Chunk + embed text into pgvector, retrieval + streaming chat endpoint, per-document chat UI with history. | Highest-value feature; builds on stored documents. |
| **4 — Accounts (later)** | Auth + per-user data scoping. Schema designed for it from Phase 1. | Deferred per user choice, but unblocked. |

---

## Phase 1 — Foundation & Modernization (this spec)

**Scope guard:** Phase 1 changes **no user-facing features**. The upload→summary
flow behaves the same, but the app becomes secure, modern, persisted, and
structured for Phases 2–3. The produced summary is additionally saved to the DB.

### 1. Security remediation (do first)

- Add a `.gitignore` covering at minimum: `.env`, `node_modules/`,
  `**/node_modules/`, `backend/pdfsummary/*` (keep the dir via `.gitkeep`),
  `.DS_Store`.
- Remove already-tracked files from the index (keep on disk):
  `git rm --cached` for the tracked `.env`, all committed `node_modules/`, and the
  leaked uploaded PDFs under `backend/pdfsummary/`.
- Add `.env.example` listing key names only (`PORT`, `BASE_URL`,
  `OPENAI_API_KEY`, `DATABASE_URL`).
- **User action (cannot be automated):** rotate the OpenAI API key — treat the
  committed one as compromised.
- The secret remains in git *history*. History rewrite (`git filter-repo`) is
  **optional** and noted as a follow-up; key rotation is the actual remediation.

### 2. Backend restructure

Split the single `server.js` into focused modules:

```
backend/
  app.js                 # express app + middleware (json, error handler)
  server.js              # bootstrap: load config, run migrations, listen
  config.js              # env loading + validation (fail fast on missing vars)
  routes/summary.js      # POST /api/pdfsummary
  services/pdf.js        # extract text from an uploaded PDF
  services/summarize.js  # OpenAI summarization (single-call + chunk fallback)
  services/tokens.js     # token counting + chunking (reused by Phase 3 RAG)
  db/
    index.js             # pg pool, query helper, runMigrations()
    migrations/          # ordered .sql files
```

Each unit has one purpose and a clear interface (e.g. `pdf.extractText(path) ->
string`, `summarize.summarize(text, {wordTarget}) -> string`). The route wires
them together.

### 3. SDK + model modernization

- OpenAI **v3 → v4** SDK: `new OpenAI({ apiKey })`,
  `openai.chat.completions.create(...)`.
- Model → **`gpt-4o-mini`** (low cost, strong quality, 128k context window).
- **Simplification:** with a 128k context window, most PDFs summarize in a single
  call. Keep chunking only as a **fallback** for documents that exceed a safe
  input budget. This removes most of the fragile recursive `while` loop in the
  current `server.js`. The sentence/chunk helpers stay in `tokens.js` because
  Phase 3 RAG embeddings reuse them.

### 4. Database foundation (Postgres + pgvector)

Postgres is a Phase-1 dependency (local instance or connection string via
`DATABASE_URL`). Schema designed now for all later phases:

```sql
-- migration 001_init.sql
create table documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,                 -- nullable now; Phase 4 makes it real
  filename      text not null,
  extracted_text text not null,
  char_count    integer not null,
  created_at    timestamptz not null default now()
);

create table summaries (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  content      text not null,
  format       text,                  -- Phase 2 fills this (e.g. 'paragraph')
  word_target  integer,
  model        text not null,
  created_at   timestamptz not null default now()
);

-- Phase 3 will add: create extension vector; create table chunks(... embedding vector);
```

Migrations are plain ordered `.sql` files run on boot by `db.runMigrations()`
(tracked in a `schema_migrations` table to run each file once). `pgvector`
extension is **not** required until Phase 3.

In Phase 1 the summary route, after producing a summary, inserts a `documents`
row and a `summaries` row. No read/library endpoints yet (Phase 2).

### 5. Hardening + bug fixes

- Multer config: **20 MB file-size limit** and reject non-PDF mimetypes.
- **Delete the temp upload file** after processing (success or failure).
- Fix the **stuck-loading bug**: validate `maxWords` before setting
  `loading=true`, and ensure `loading` is reset in every path (the `finally`
  already exists — the early `return` bypasses it; move validation above
  `setLoading(true)`).
- **Sanitized errors:** the route returns `{ error: <safe message string> }` and
  an appropriate status code; raw error objects are logged server-side only,
  never serialized to the client.

### 6. Testing

Introduce **Jest** (zero tests exist today):

- Unit: `tokens.js` chunking — boundaries, oversized single sentence, empty text.
- Unit: `summarize.js` with a **mocked** OpenAI client — single-call path and
  chunk-fallback path.
- Integration: `POST /api/pdfsummary` with a small fixture PDF and mocked OpenAI,
  asserting a 200 + summary and that rows are written (against a test DB or a
  mocked db layer).

### Out of scope for Phase 1

Summary format/tone options, copy/download, library/history UI and read
endpoints, chat/RAG, embeddings/pgvector, authentication. These belong to later
phases.

## Success criteria

- No secrets or `node_modules/` or uploaded PDFs tracked by git; `.gitignore` and
  `.env.example` present; OpenAI key rotated by the user.
- App runs on the v4 SDK with `gpt-4o-mini`; upload→summary works end to end.
- A summary request writes one `documents` row and one `summaries` row.
- Oversized / non-PDF uploads are rejected with a clean error; temp files are
  removed after each request.
- The frontend never gets stuck on "Analysing…".
- `npm test` passes with the new unit + integration tests.
- Only used dependencies remain in `package.json`.
