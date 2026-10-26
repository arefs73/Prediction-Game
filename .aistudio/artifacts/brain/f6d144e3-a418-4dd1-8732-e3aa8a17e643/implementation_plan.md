# Crypto Market Prediction Platform (Game Rules v2.2)

A high-performance crypto market prediction platform built strictly to the **Game Rules v2.2** product specification and the design layout in `image.png`. The platform enables participants to predict Bitcoin's exact spot settlement price at 20:00:00 Europe/Amsterdam using daily streak-earned and welcome tokens, featuring multi-exchange median price settlement, a 20:00–22:00 live analysis studio, and deterministic top-100 prize distribution.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following key decisions were confirmed during requirements clarification:

- **Featured Asset**: Bitcoin (`BTC/USD`) with live multi-exchange pricing and a transparent 3-provider median resolution algorithm (Binance, Coinbase, Kraken).
- **Timezone & Round Phases**: Strictly anchored to real-time `Europe/Amsterdam` (IANA). Round is open for predictions 12:00–20:00:00; locked & settlement price frozen at 20:00:00; live analysis studio runs 20:00–22:00:00; winner announcements & prize claim verification open at 22:00:00. An unobtrusive compliance clock and phase indicator show live Amsterdam time.
- **Live Period Experience**: Interactive 20:00–22:00 Live Studio featuring price analytics, depth chart sentiment, expert commentary feed, sponsor showcase, and a synchronized countdown to the 22:00 announcement.
- **Prediction Visibility & Anti-Herding**: Predictions are strictly masked (`$•••••.••`) prior to 20:00:00 lock to prevent front-running, and revealed with exact submission timestamps at 20:00:00.
- **Token & Streak Economy**: 5 Welcome Tokens on registration, 2 Base Daily Tokens, plus Day 1–7 Streak bonus (1 to 7 tokens) requiring at least one daily prediction, with 7-day cycle expiration.

---

## 1. Overview & Core Concept

- **What It Does**: Participants enter daily BTC price predictions with two decimal places. At 20:00:00 Amsterdam time, the system samples real-time spot prices across multiple reputable exchanges and locks the median as the Official Settlement Price. From 20:00 to 22:00, the platform transitions into a live market studio while ranking predictions internally. At 22:00:00, official rankings are published for the Top 100 participants (Ranks 1–30 receive cash prizes, Ranks 31–100 receive non-cash rewards) with deterministic tie-breaking based on submission timestamp.
- **Target Audience / Persona**: Crypto enthusiasts, market forecasters, and daily traders seeking a provably fair, skill-based daily forecasting tournament without paying entry fees.
- **Key Value**: 100% transparent and deterministic rules, multi-exchange manipulation resistance, automated daily streak progression, and a community live event loop.

---

## 2. User Experience & Visual Design

### Layout & Structural Alignment with UI Wireframe
Matching the visual hierarchy in `image.png` set against a deep obsidian dark-slate palette (`#0B0F19`, `#111827`, `#1F2937`) with glassmorphism glow accents (`#00F2FE`, `#4FACFE`, `#10B981`):

1. **Header (Top Bar Contract)**:
   - *Left*: Platform wordmark ("ApexPredict // BTC Daily")
   - *Center*: Live Amsterdam Time Indicator (`Europe/Amsterdam` format: `HH:mm:ss`) & Active Round Phase (`Open 12:00–20:00`, `Locked & Live Studio`, `Settled & Results`)
   - *Right*: Token Balance Pill (Available tokens, Streak day count) & User Profile button (display name, KYC status, referral code).
2. **Sponsor Banner (Top Hero)**:
   - Premium glassmorphic showcase banner with subtle crypto badges (BTC, ETH, LTC), campaign title, copy, and trackable "Learn More" redirect button (Game Rules Section 12).
3. **Left Column — Previous Winners & Prize Pools**:
   - Ranked list of previous round winners (1st to 5th+ with prize allocations: e.g. 1st: $10,000, 2nd: $8,000, 3rd: $6,000).
   - Overview of the current round's 100% cash pool distribution (1st: 40%, 2nd: 20%, 3rd: 10%, 4th–10th: 15% equal, 11th–30th: 15% equal; 31st–100th non-cash catalog).
4. **Center Column — Core Prediction Engine & Market Visualizer**:
   - **Live 7-Day & Intraday Line Chart**: Interactive SVG/Canvas multi-series chart showing 7-day BTC price trend, current spot price, and 24h high/low range.
   - **Prediction Input & Immutability Modal**:
     - Price input box (two-decimal precision enforcement, formatted in USD `$`).
     - Required warning banner: *"Note: You are predicting the exact price of the asset at 20:00:00 Europe/Amsterdam, not the current market price!"*
     - Vibrant gradient Submit Button with token deduction indicator.
     - Final Confirmation Modal with irreversible commitment warning: *"Once confirmed, this prediction cannot be changed, edited, cancelled, or replaced."*
   - **Participants & Predictions Box**:
     - Real-time list of submitted predictions with user avatars and submission time deltas.
     - Before 20:00:00: Displays Display Name and obfuscated price (`$•••••.••`).
     - After 20:00:00: Automatically unmasks actual prediction amounts and submission timestamps.
5. **Right Column — Global Round Chat & Moderation**:
   - Real-time community discussion stream with user display names, timestamps, report/block actions, rate limiting, and spam filtering (Section 25).
6. **Live Studio Overlay & Results Modal (Phase Transitions)**:
   - **20:00–22:00 Live Studio**: Embeds live market commentary, frozen Official Settlement Price banner, multi-exchange breakdown (Binance, Coinbase, Kraken), and announcement countdown.
   - **22:00:00 Results & Audit Modal**: Full transparent breakdown of participant's prediction, absolute error calculation, submission tie-break rank, prize allocation, and audit proof (Section 26 & 28).

---

## 3. Key Product Decisions & Trade-Offs

- **Timezone Authority**:
  - *Approach*: Built-in IANA `Europe/Amsterdam` time resolution using standard JavaScript `Intl.DateTimeFormat` with `timeZone: 'Europe/Amsterdam'`.
  - *Why*: Eliminates DST bugs (CET vs CEST switchovers) strictly as required by Game Rules v2.2 Section 15.
- **Settlement Formula & Multi-Exchange Aggregation**:
  - *Approach*: Concurrent polling of public spot tickers from Coinbase, Binance, and Kraken. At 20:00:00, the median of the three valid prints is frozen as the Official Settlement Price.
  - *Why*: Prevents single-exchange flash crashes or wick manipulation from altering game results (Section 14).
- **Tie-Breaking Rule**:
  - *Approach*: Error calculated as `|Prediction - SettlementPrice|`. Predictions with identical error are ordered by `submissionTimestamp` ascending (earlier submission wins higher rank) (Section 18).
- **Token Economy & Reset Enforcement**:
  - *Approach*: Welcome bonus (5 tokens), daily login reward (2 tokens), and streak accumulation (1 to 7 tokens) requiring $\ge 1$ prediction per day to maintain streak. All unused tokens expire at the end of the 7-day gaming cycle (Section 21–22).
- **Privacy & KYC**:
  - *Approach*: Real names and phone numbers stored in private profile only; public leaderboard and chat display sanitized Usernames. Cash prize claims flag a simulated KYC / verified payout flow (Section 1).

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Top Navigation & Amsterdam Clock                     │
│      [Logo / Wordmark]    [Time: Europe/Amsterdam]    [Tokens: 5]      │
├────────────────────────────────────────────────────────────────────────┤
│                       Sponsor Hero Banner (12)                         │
├───────────────┬────────────────────────────────────────┬───────────────┤
│               │   7-Day Interactive Bitcoin Chart (11)  │               │
│   Previous    ├────────────────────────────────────────┤    Global     │
│    Winners    │   Prediction Input Box ($XX,XXX.XX)    │  Round Chat   │
│       &       │   [Two-Decimal & Amsterdam Warnings]   │  (Spam filter │
│  Prize Pool   │   [Submit Button] -> [Confirm Modal]   │   & report)   │
│  Allocation   ├────────────────────────────────────────┤     (25)      │
│  (19, 20)     │   Submissions List (8, 9)              │               │
│               │   Before 20:00: Masked ($•••••.••)     │               │
│               │   After 20:00: Unmasked + Median Price │               │
├───────────────┴────────────────────────────────────────┴───────────────┤
│      Live Studio Panel (20:00–22:00) / Official Announcement (22:00)   │
│      Audit Log & Provable Settlement Inspection Modal (27, 28)         │
└────────────────────────────────────────────────────────────────────────┘
```

### Core State & Data Models

- **User**: `id`, `username`, `firstName`, `lastName`, `email`, `phone`, `tokenBalance`, `streakDay`, `lastPredictedDate`, `kycVerified`, `referralCode`.
- **Prediction**: `id`, `userId`, `username`, `avatarUrl`, `predictedPrice`, `roundId`, `submittedAt` (ISO timestamp), `errorMargin`, `rank`, `prizeAllocated`.
- **RoundState**: `roundId`, `date`, `status` (`OPEN`, `LOCKED_LIVE`, `ANNOUNCED`), `scheduledOpenTime` (12:00:00), `scheduledFreezeTime` (20:00:00), `scheduledAnnounceTime` (22:00:00), `officialSettlementPrice`, `exchangePrices` (Coinbase, Binance, Kraken), `totalPoolCash`.
- **ChatMessage**: `id`, `userId`, `username`, `text`, `timestamp`, `flagged`.

### Key User Flows & Handlers
1. **User Registration / Profile**: Form with first name, last name, email, phone, and public username; instantly credits 5 welcome tokens.
2. **Prediction Submission**:
   - Validates input format (numeric, max 2 decimals, within realistic BTC range).
   - Shows Critical UI Warning: *"Note: You are predicting the exact price of the asset at 20:00:00 Europe/Amsterdam, not the current market price!"*
   - Shows Final Confirmation dialog: *"Once confirmed, this prediction cannot be changed, edited, cancelled, or replaced."*
   - On confirmation: Deducts 1 token, inserts immutable record with high-precision timestamp, and updates user's daily streak.
3. **20:00 Price Freeze**:
   - At 20:00:00 Amsterdam time, system captures prices across exchange feeds, computes median, freezes `Official Settlement Price`, unmasks all submitted prediction numbers, and activates Live Studio mode.
4. **22:00 Announcement & Audit**:
   - Calculates ranking by error ascending, applies timestamp tie-breaker, distributes 100% of cash prize pool to ranks 1–30 and non-cash rewards to ranks 31–100.
