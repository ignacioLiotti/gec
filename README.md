This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Local Supabase (barebones)

Prerequisites:

- Install the Supabase CLI: see `https://supabase.com/docs/guides/cli`.
- Install Docker Desktop and have it running.

Setup:

1. Copy envs: `cp env.example .env.local` (Windows PowerShell: `Copy-Item env.example .env.local`).
2. Start stack: `npm run supabase:start`.
3. Check status: `npm run supabase:status`.
4. Stop stack: `npm run supabase:stop`.

Project config lives in `supabase/config.toml`. Default ports:

- API: `54321` (REST), DB: `54322` (Postgres). URL and anon key from `env.example` are set for local.

Client usage:
Create a client in components/pages using the helper:

```ts
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const supabase = createSupabaseBrowserClient();
```

Notes:

- This is a minimal local setup for development only.
- Do not commit real service role keys.
