# Deployment

BriefPDF Reader deploys as two pieces:

- **Backend** (Express API) → **Railway** (Docker)
- **Frontend** (React static build) → **Vercel** (CDN)

They run on different origins, so the backend uses CORS (`ALLOWED_ORIGINS`) and
the frontend points at the backend via `REACT_APP_API_BASE_URL`.

> The project lives under the `PDF Summarizer/` folder (note the space). Both
> platforms let you set a **Root Directory** — use it instead of moving files.

---

## 0. Before you start

**Rotate the OpenAI API key.** The original key was committed to git history and
must be treated as compromised. Create a new key at
<https://platform.openai.com/api-keys> and use it below.

---

## 1. Backend on Railway

1. **New Project → Deploy from GitHub repo**, select this repo.
2. **Settings → Root Directory:** `PDF Summarizer`
   (Railway auto-detects the `Dockerfile` there and builds it.)
3. **Variables:**
   | Key | Value |
   |-----|-------|
   | `OPENAI_API_KEY` | your **rotated** key |
   | `OPENAI_MODEL` | `gpt-4.1-mini` (optional; this is the default) |
   | `ALLOWED_ORIGINS` | *(leave empty for now — set in step 3)* |
   | `RATE_LIMIT_MAX` | `20` (optional) |

   Do **not** set `PORT` — Railway injects it; `config.js` reads it.
4. Deploy. Copy the generated public URL, e.g.
   `https://briefpdf-backend.up.railway.app`.
5. Verify: open `<backend-url>/api/health` → `{"status":"ok"}`.

## 2. Frontend on Vercel

1. **Add New → Project**, import this repo.
2. **Root Directory:** `PDF Summarizer/frontend`
   (Framework preset auto-detects **Create React App**.)
3. **Environment Variables:**
   | Key | Value |
   |-----|-------|
   | `REACT_APP_API_BASE_URL` | the Railway backend URL from step 1.4 |
4. Deploy. Copy the Vercel domain, e.g. `https://briefpdf.vercel.app`.

## 3. Wire up CORS (close the loop)

1. Back in **Railway → Variables**, set:
   `ALLOWED_ORIGINS = https://briefpdf.vercel.app`
   (comma-separate if you add a custom domain / preview domains).
2. Redeploy/restart the backend so it picks up the change.
3. Open the Vercel URL and run an end-to-end summary to confirm.

---

## Local development (unchanged)

```bash
# Backend (from "PDF Summarizer/")
cp .env.example .env        # fill in OPENAI_API_KEY
npm install
npm run dev                 # nodemon on :5000

# Frontend (from "PDF Summarizer/frontend/")
npm install
npm start                   # CRA dev server on :3000, proxies /api -> :5000
```

In dev, leave `REACT_APP_API_BASE_URL` and `ALLOWED_ORIGINS` empty: the CRA
proxy forwards `/api` to the local backend, and empty `ALLOWED_ORIGINS` allows
any origin.
