# Security model

All game mutations pass through the Express API. Firebase Admin verifies ID tokens, including revocation and verified email, before protected endpoints. Clients cannot write any Firestore documents; private profile reads are owner-only. The server derives identity from the token, never from the request body.

## Enforced invariants

- Prediction creation, token debit, first-participation bonus, per-round counter and ledger entry commit in one Firestore transaction.
- A prediction is accepted only when the server's transaction clock is within [openAt, lockAt) and the persisted round remains OPEN. Round writes serialize submissions against the lock transition.
- Idempotency keys are scoped to authenticated users. Same key and payload return the original entry; changed payload is rejected.
- Values of other participants are omitted from API responses before lockAt. No direct reads of guesses, rounds or results are allowed.
- Official price and quotes are persisted once. Missing, delayed or divergent sources suspend the round. Retries cannot replace the captured price.
- Results are gated by both ANNOUNCED state and announceAt. Partial result writes are never published.
- All currency arithmetic and prize allocation use integer cents. Each participant wins at most once.
- Weekly expiry uses the Monday date in Europe/Amsterdam, including DST/year boundaries.
- KYC requests become PENDING only. There is no public approval or payout endpoint.
- Chat is rate-limited server-side; reports and blocks are persisted.

## Limits

Firestore rules do not constrain Admin SDK/IAM administrators. Restrict the runtime service account and production operator access; enable cloud audit logging. The SHA-256 audit digest detects inconsistencies relative to a retained digest, but is not a third-party timestamp or immutable ledger. Independently archive audit JSON and its digest for stronger evidence.

The API has a per-process IP limiter and a persistent per-user chat limiter. Multi-instance IP throttling/WAF, phone verification and device/IP referral fraud checks need deployment integration. Referrals are explicitly disabled until those checks exist.

The API intentionally fails for legacy client-writable profiles without cycleStart. Do not trust historical balances, KYC statuses or client timestamps. Stage and review migration from a backup, or start a new game database with user consent.

## Verification

Run pnpm test and pnpm test:emulator. Emulator tests reject direct balance/KYC writes, private data reads, late predictions and double spending, then check persisted settlement, publication gating, idempotency, weekly expiry and moderation.
