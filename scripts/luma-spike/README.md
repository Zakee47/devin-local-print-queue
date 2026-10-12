# Luma QR check-in spike

This throwaway worker only accepts the local mock host; it refuses `luma.com`
and `lu.ma`. The selectors in `worker.mjs` are a hypothesis and must be
calibrated against the real logged-in Luma page before any real integration.

1. Start local Convex with a fresh local `.env.local`, after confirming its URL
   is `http://127.0.0.1:3210`:

   ```sh
   env -u CONVEX_DEPLOY_KEY -u CONVEX_DEPLOYMENT CONVEX_AGENT_MODE=anonymous npx convex dev
   ```

2. In a separate shell set only local environment values:

   ```sh
   env -u CONVEX_DEPLOY_KEY -u CONVEX_DEPLOYMENT npx convex env set OWNER_EMAIL owner@example.com
   env -u CONVEX_DEPLOY_KEY -u CONVEX_DEPLOYMENT npx convex env set CHECKIN_WORKER_SECRET local-spike-secret
   env -u CONVEX_DEPLOY_KEY -u CONVEX_DEPLOYMENT npx convex env set LUMA_EVENT_ID evt-spike123
   ```

3. Start the mock site and sign in once with the persistent worker profile:

   ```sh
   node scripts/luma-spike/mock-luma.mjs
   CONVEX_URL=http://127.0.0.1:3210 CHECKIN_WORKER_SECRET=local-spike-secret LUMA_BASE_URL=http://localhost:4010 node scripts/luma-spike/worker.mjs --login
   ```

   Use any email and password in the mock form. Stop with Ctrl-C after login,
   then restart the same worker command without `--login`; the profile remains
   under `~/.luma-checkin-spike-profile`.

4. Start the Next app and open `/admin/checkin` as the configured owner. The
   mock tickets are `g-alice1`, `g-bob22`, and `t9x7k2` for `evt-spike123`.
   The mock also supports `/logout` for testing expired-session release.

Set a fresh secret in local Convex and the worker environment for each
throwaway test. Never copy production Convex credentials into this checkout.
