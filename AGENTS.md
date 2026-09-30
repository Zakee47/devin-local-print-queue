<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Keychain Print Queue

Webapp for the Devin Local: London 3D-printing keychain competition. Stack and
visual language come from https://github.com/dabit3/vending-machine (Next.js App
Router + Convex + Clerk + shadcn/Tailwind, monochrome dark theme). Reuse the
components in `components/ui` and the existing page chrome (`SiteHeader`,
`SiteFooter`, admin layout) rather than inventing new styles.

## Domain rules

- Eligibility: admins upload the Luma guest CSV at `/admin/guests`
  (`lib/guest-csv.ts` → `guests.importCsv`). If the CSV has a `checked_in_at`
  column only checked-in rows are eligible. Each upload replaces the list;
  existing participants keep their accounts. There is no Luma API integration.
- A participant registers once (`participants.register`) with their verified
  Clerk email. Everything participant-facing requires `requireParticipant`.
- Max 2 active (non-rejected) submissions per participant, STL or 3MF only,
  size capped by `settings.maxFileBytes`. Exactly one active submission may have
  `printRequested: true`. A rejected submission frees its slot.
- Status lifecycle: `submitted` → `rejected` (with `rejectionReason`) or
  `queued` → `printing` → `done`. Participants see `STATUS_LABELS`.
  Participants may edit / swap the print choice only while `submitted`.
- Colours are requests from `settings.colours`; always say "not guaranteed".
- Download names come from `downloadFileName` in `lib/files.ts`
  (`KC-007_ada-lovelace_red_rocket-keychain.3mf`). Print codes are allocated
  with `takePrintNumber` + `formatPrintCode`.
- Voting: each participant gets 2 votes, only for `done` submissions, never
  their own, only while `settings.votingOpen`.
- Public surfaces (TV, gallery) show `participant.displayName` only, never emails.
- Every admin mutation calls `requireAdmin` and writes an `auditLog` row.
- Render STL/3MF previews with `components/ModelViewer.tsx`.

## File ownership (parallel workstreams)

- A participant: `app/submit/**`, `convex/submissions.ts`, `components/participant/**`
- B admin: `app/admin/page.tsx`, `app/admin/guests/**`, `app/admin/settings/**`,
  `convex/queue.ts`, `convex/http.ts`, `components/admin/**`
- C TV: `app/tv/**`, `convex/tv.ts`, `components/tv/**`
- D voting: `app/vote/**`, `app/admin/votes/**`, `convex/votes.ts`, `components/vote/**`

Shared files (`convex/schema.ts`, `lib/*`, `convex/admins.ts`,
`convex/participants.ts`, `convex/settings.ts`, `components/ModelViewer.tsx`)
should only get small additive changes; call them out in the PR.

## Local development (no cloud accounts needed)

```bash
npm install
CONVEX_AGENT_MODE=anonymous npx convex dev      # local backend on :3210, writes .env.local
npx convex env set CLERK_JWT_ISSUER_DOMAIN <issuer>  # placeholder ok for codegen
npm run dev                                     # Clerk runs in keyless dev mode
npx convex run seed:dev '{"adminEmail":"you@example.com"}'
```

## Verification

- `npm test` (vitest, `convex-test` for backend functions)
- `npm run lint`
- `npx --no-install tsc --noEmit --incremental false`
- `npm run build`
- Regenerate Convex types with `npx convex codegen` and commit `convex/_generated`.
