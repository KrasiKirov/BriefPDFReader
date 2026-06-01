# Lessons

## Branch-switching can silently overwrite a gitignored `.env`

**What happened:** While `.env` held the user's freshly-rotated OpenAI key (untracked
+ gitignored on the feature branch), I ran `git checkout main` to merge. On the
*old* `main`, `.env` was still **tracked**. Git overwrites ignored files with the
target branch's tracked version without the usual "untracked file would be
overwritten" guard — so the working-tree `.env` got reverted to the old committed
key. The user noticed ("it reverted my api key change").

**Rule for myself:**
- Before `git checkout`/branch-switch, check whether a secret/config file (`.env`)
  is **untracked here but tracked on the target branch**. If so, **back it up first**
  (`cp .env /tmp/.env.bak`) and restore after, or avoid switching branches.
- Prefer operations that don't change the working tree: merge via the GitHub PR, or
  use `git fetch` + `git push` of the branch ref to main without checking it out
  locally, e.g. push the branch and merge server-side.
- Never assume gitignored == safe-from-checkout. `git checkout` *will* clobber
  ignored files that the target commit tracks.

## Secrets: where they may and may not go
- `OPENAI_API_KEY` → backend host env (Railway) ONLY. Never commit `.env`; never
  put it in a `REACT_APP_*` var (those are bundled into the public client JS).
- See [[commit-message-style]] for how the user wants commits written.
