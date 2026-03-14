## Cursor Cloud specific instructions

### Architecture
Single Next.js 16 app (App Router, Turbopack, React Compiler) with Supabase (Postgres + Auth + Storage) as the backend. The app is a Spanish-language B2B construction project management SaaS ("Sintesis").

### Key services
| Service | How to start | Port |
|---|---|---|
| Docker | `sudo dockerd &` (needed before Supabase) | — |
| Supabase | `npx supabase start` | API: 54321, DB: 54322, Studio: 54323 |
| Next.js dev | `npm run dev` | 3000 |

### Common commands
- **Lint**: `npm run lint` (ESLint 9; pre-existing warnings/errors exist in the codebase)
- **Test**: `npm run test` (Vitest 4; tests in `tests/`)
- **Dev server**: `npm run dev`
- **Supabase status**: `npx supabase status`

### Gotchas
- The `.npmrc` has `legacy-peer-deps=true` — always use `npm install --legacy-peer-deps` or just `npm install` (the `.npmrc` handles it).
- Both `package-lock.json` and `pnpm-lock.yaml` exist; use **npm** as the primary package manager.
- `.env.local` must be created from `env.example`; the anon key in `env.example` is a placeholder — use the actual key from `npx supabase status -o env` (`ANON_KEY`).
- Docker must be running before `npx supabase start`. In this cloud environment, start Docker with `sudo dockerd &` and wait a few seconds.
- Supabase local auth has email confirmation disabled by default, so email/password sign-up works immediately.
- The `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars for Google OAuth are not set locally — Google sign-in won't work, but email/password sign-up/sign-in works fine.
- The workspace rule "do not run npm run build or npm run dev" applies to co-located local dev (where the user already has it running). In cloud agent environments, you must start the dev server yourself.
