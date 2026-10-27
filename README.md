# ApexPredict — secure round implementation (draft)

React/Vite frontend, Firebase Authentication, Firestore, and a Node/Express authoritative game service. This branch replaces the browser-controlled prototype. It is a reviewable implementation, not an already deployed cash-prize service.

## Product decisions

Confirmed by the owner:
- One prize per user, based on their best prediction.
- Unused tokens expire Monday at 00:00 Europe/Amsterdam for everyone.

Draft rules made explicit for review:
- Base reward: +2 once per Amsterdam calendar day after signup day; welcome grant: +5 once.
- First accepted prediction each day grants streak bonus 1–7. A missed participation day or Monday resets the streak. A player must have a token before this bonus can be earned.
- Default per-round cap: 100 entries/user, snapshotted before the round opens.
- Cash weights: 40/20/10/15/15 for places 1/2/3/4–10/11–30. With fewer winners, normalize existing weights proportionally; leftover integer cents go to earlier ranks. With zero entries, no payout is created and the pool remains unallocated.
- BTC/USD is sampled from Coinbase, Kraken and Bitstamp (replacing the old Binance USDT quote). All three responses must be received within the first three seconds after 20:00 and differ by no more than 1%. This is a bounded collection window, not a claim of perfectly simultaneous exchange trade timestamps. A late worker or invalid sources suspends the round without substituting a later price. Suspension/refund resolution requires operator policy before launch.
- The worker publishes results at/after 22:00. Rank ties use server timestamp, then prediction ID.
- No token sales, automated KYC approvals, cash transfers, or automatic non-cash fulfillment are enabled. Referral rewards remain visibly disabled pending verified-phone/device/IP fraud integration.

## Run locally

Node 22.18+ (24 tested), pnpm 11+, and Java 21+ for the Firestore emulator.

1. pnpm install --frozen-lockfile
2. Copy .env.example to .env.
3. pnpm exec firebase emulators:start --only firestore,auth --project demo-prediction-game
4. In a second terminal: pnpm dev:server
5. In a third terminal: pnpm dev
6. Open http://localhost:3000. Use the emulator verification link from its console for test users.

All integration tests enforce a demo project and emulator-only operation. No credentials or production database are needed for tests.

The scheduler only creates rounds with terms fixed before 12:00. Starting after noon schedules tomorrow's round; it does not open a late round. For deterministic test rounds, run the tests with their injected clock.

## Validation

- pnpm lint — strict TypeScript checking
- pnpm test — pure rules, precision, date/DST and prize allocation tests
- pnpm test:emulator — Firestore rules and transactional integration tests
- pnpm build — production frontend
- pnpm start — server (set NODE_ENV=production to serve dist)

## Deployment, still required

Use a staging Firebase project first. Configure the frontend Firebase web project and the server FIREBASE_PROJECT_ID/FIRESTORE_DATABASE_ID to the same intended database. The original repository uses a named Firestore database; firebase.json currently targets the default database for emulators. Set its firestore database field explicitly to the chosen named database before deploying rules/indexes there. Deploy rules and indexes before exposing this server.

Provide application-default credentials through the hosting platform's service account. Remove emulator environment variables and set VITE_USE_EMULATORS=false for production builds. Do not put Admin credentials in Vite variables or GitHub. Use HTTPS, restricted IAM, monitoring and backups.

Enable ENABLE_ROUND_WORKER=true only on continuously running instances with accurate clocks and CPU allocated at the deadline. Serverless scale-to-zero is unsuitable for this in-process worker. State transitions are transactional across instances; incomplete captures suspend for review. Publication retries can finish partial result writes safely.

Set ROUND_POOL_CENTS only to an approved funded amount; its default example is zero. Review the draft policies above before launch. Runtime configuration does not mutate existing round terms.

Review/reset legacy game records before enabling accounts. The old prototype let clients mint balances and self-verify KYC; those records are not trustworthy. Back up first. No automatic destructive migration is supplied.

KYC requests are stored privately for manual review. Select an identity/payout provider, wire verified webhooks and audited payout idempotency before accepting withdrawal requests as payable. Non-cash rewards require a fulfillment mechanism. Referral SMS verification, abuse monitoring and reward processing remain a separate integration.

Moderators can inspect moderationReports with restricted operator access and mark chatMessages.removed=true. There is no public moderation privilege. Account deletion removes the private/public profile and KYC request, disables access, and retains the game/audit ledger; agree a retention policy before launch.

## Architecture

- server/domain.ts: deterministic time, reward, price and ranking rules
- server/gameService.ts: transactional Firestore application service
- server/market.ts: bounded requests to three USD sources
- server/index.ts: verified HTTP API and recoverable round worker
- src/services/firebase.ts: Firebase Auth and authenticated API transport
- src/App.tsx: server snapshots; no local game authority or seeded contestants
- firestore.rules: denies direct game access

GET /api/rounds/:id/audit returns canonical JSON. SHA-256 over JSON.stringify of that object matches round.auditHash. Keep the original JSON/digest independently; a digest alone cannot prevent an administrator rewriting both.

## Known operating limits

The current round API paginates entries by 200. Settlement loads a round's entries in memory and writes per-user results; capacity/load testing and a batch-worker design are required before large events. Market sources need availability monitoring. There is no live broadcast or historical chart integration; fabricated analysis/history/winners were removed.
