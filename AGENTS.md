<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Keychain Print Queue

Webapp for the Devin Local: London 3D-printing keychain competition. Stack and
visual language come from https://github.com/dabit3/vending-machine (Next.js App
Router + Convex + Clerk + shadcn/Tailwind, monochrome dark theme). Reuse the
components in `components/ui` and the existing page chrome (`SiteHeader`,
`SiteFooter`, admin layout) rather than inventing new styles.

## Domain rules

- The verified email configured as `OWNER_EMAIL` is the owner; rows in
  `admins` are staff. Guest import, votes/results, participant management and
  team management are owner-only. The owner can delete participant accounts
  and block email addresses.
- Checked-in guests register with their verified email and choose a unique
  username stored as `displayName`; public pages show usernames, never emails.
- Each participant may have two active STL/3MF uploads and one
  `printRequested` entry, which is used for printing and voting. Enforce
  `settings.maxFileBytes` and `settings.maxDimensionsMm` in any orientation.
- Intake follows `settings.submissionsOpen` and its optional
  `settings.submissionsDeadline`; `settings.announcement` is shown publicly.
  Printers and available colours come from settings; colour requests are not
  guaranteed.
- A `print_failed` rejection may permit a fixed replacement after submissions
  close only when there is no active entry or newer active upload.
- Each participant gets two votes on eligible entries, never their own. Votes
  can change while voting is open; the owner closes voting to lock them.
- Admin mutations use `requireAdmin` and write an `auditLog` row. Render STL/3MF
  previews with `components/ModelViewer.tsx`.

## File ownership (parallel workstreams)

- A participant submissions: `app/submit/**`, `components/participant/**`,
  `convex/submissions.ts`
- B administration: `app/admin/**` except `app/admin/votes/**`,
  `components/admin/**`, `convex/queue.ts`, `convex/http.ts`, guest-import code
- C TV: `app/tv/**`, `convex/tv.ts`, `components/tv/**`
- D voting: `app/vote/**`, `app/admin/votes/**`, `convex/votes.ts`,
  `convex/likes.ts`, `components/vote/**`
- Coordinate changes to shared contracts in `convex/schema.ts`, `convex/admins.ts`,
  `convex/entries.ts`, `convex/participants.ts`, `convex/settings.ts`, `lib/**`,
  and `convex/_generated/**`; regenerate and commit generated Convex files.

## Local development (no cloud accounts needed)

```bash
npm install
CONVEX_AGENT_MODE=anonymous npx convex dev      # local backend on :3210, writes .env.local
npx convex env set CLERK_JWT_ISSUER_DOMAIN <issuer>  # placeholder ok for codegen
npx convex env set OWNER_EMAIL you@example.com
npm run dev                                     # Clerk runs in keyless dev mode
npx convex run seed:dev '{"adminEmail":"you@example.com"}'
```

## Verification

- `npm test` (vitest, `convex-test` for backend functions)
- `npm run lint`
- `npx --no-install tsc --noEmit --incremental false`
- `npm run build`
- Regenerate Convex types with `npx convex codegen` and commit `convex/_generated`.
