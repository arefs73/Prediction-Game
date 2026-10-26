# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **PII Isolation Invariant (Game Rules v2.2 Section 1 & Pillar 6)**: `/users/{userId}` contains sensitive PII (`firstName`, `lastName`, `email`, `phone`, `walletAddress`). Only the authenticated owner (`request.auth.uid == userId`) with a verified email (`request.auth.token.email_verified == true`) can `get`, `create`, or `update` their own document. Blanket `list` is strictly forbidden (`allow list: if false;`).
2. **Public Profile Synchronization Invariant (Pillar 7)**: `/publicProfiles/{userId}` exposes only non-PII fields (`userId`, `username`, `avatarUrl`, `createdAt`) and requires `userId == request.auth.uid`.
3. **Prediction Immutability Invariant (Game Rules v2.2 Section 6)**: Once a prediction document is created in `/predictions/{predictionId}`, it is permanently immutable (`allow update, delete: if false;`). Neither the user nor any administrator can edit, cancel, or delete a prediction.
4. **Temporal & Server Timestamp Invariant**: All `createdAt` fields must equal `request.time`, and `updatedAt` on updates must equal `request.time`. `createdAt` and `userId` are immortal and cannot be mutated on update.
5. **Strict Key & Volumetric Boundaries (Pillar 2 & 3)**: Every path variable (`userId`, `predictionId`, `messageId`) must satisfy `isValidId()` (`size() <= 128` and regex `^[a-zA-Z0-9_\-]+$`). Every document write must strictly validate required keys (`hasAll`) and allowed keys (`hasOnly`) to block shadow fields.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Payload 1 (Identity Spoofing on User Profile)**: Authenticated `uid_attacker` creates `/users/uid_victim` with `userId: "uid_victim"`. -> `PERMISSION_DENIED`.
2. **Payload 2 (Unverified Email Write)**: Authenticated user with `email_verified: false` attempts to create `/users/uid_1`. -> `PERMISSION_DENIED`.
3. **Payload 3 (Shadow Field Injection)**: Authenticated user creates `/users/uid_1` with an unauthorized field `"isAdmin": true`. -> `PERMISSION_DENIED`.
4. **Payload 4 (Cross-User PII Read)**: Authenticated `uid_attacker` attempts `get` on `/users/uid_victim`. -> `PERMISSION_DENIED`.
5. **Payload 5 (User Collection Scraping)**: Authenticated user attempts `list` on `/users`. -> `PERMISSION_DENIED`.
6. **Payload 6 (Prediction Mutation / Cancellation)**: User attempts `update` on `/predictions/pred_123` to change `predictedPrice`. -> `PERMISSION_DENIED`.
7. **Payload 7 (Prediction Deletion)**: User attempts `delete` on `/predictions/pred_123`. -> `PERMISSION_DENIED`.
8. **Payload 8 (Spoofed Prediction Author)**: `uid_attacker` creates `/predictions/pred_123` with `userId: "uid_victim"`. -> `PERMISSION_DENIED`.
9. **Payload 9 (Denial of Wallet Oversized String)**: User submits a `/chatMessages/msg_1` with a 10,000-character `message` string (exceeding `maxLength: 280`). -> `PERMISSION_DENIED`.
10. **Payload 10 (ID Poisoning Attack)**: User attempts to create `/predictions/invalid$id!with*bad^chars`. -> `PERMISSION_DENIED`.
11. **Payload 11 (Forged Client Timestamp)**: User creates `/users/uid_1` with `createdAt` set to a past timestamp instead of `request.time`. -> `PERMISSION_DENIED`.
12. **Payload 12 (Immortal Field Tampering)**: User updates `/users/uid_1` and modifies `createdAt` or `userId`. -> `PERMISSION_DENIED`.
