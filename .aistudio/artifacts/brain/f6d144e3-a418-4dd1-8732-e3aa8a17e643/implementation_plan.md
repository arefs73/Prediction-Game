# Real Firebase Email Verification & Account Activation Plan

Integrates real **Firebase Email/Password Authentication** and **Email Verification Link (`sendEmailVerification`)** into the account registration and login pipeline, strictly enforcing email verification before granting the **5 Free Welcome Tokens** and allowing predictions per **Game Rules v2.2 (Sections 1, 3, and 24)**.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed for the email verification workflow:

- ** Confirmed Decision 1 — Verification Mechanism**: Send a real verification/approval link to the user's inbox via **Firebase Authentication (`createUserWithEmailAndPassword` + `sendEmailVerification`)**, plus real password reset emails via `sendPasswordResetEmail`.
- ** Confirmed Decision 2 — Strict Token & Prediction Gate**: Newly registered email users are placed in a **Pending Email Verification** state (`0 Tokens`, predictions locked). Only after clicking the verification link in their email and confirming verification (`user.reload()` -> `emailVerified === true`) does the system create their verified Firestore participant record, credit their **5 Free Welcome Tokens**, and unlock prediction submissions.
- ** One-Time Firebase Console Step Required**: Because automated provisioning only enables Google Sign-In by default, you will need to toggle **Email/Password** to **Enabled** in your Firebase Console (`https://console.firebase.google.com/project/even-phenomenon-t1ttq/authentication/providers`). If not yet toggled on, the UI will display a direct link and 3-step instructions right inside the modal.

---

## 1. Overview & Core Concept

- **What It Does**: When a participant registers with their First Name, Last Name, Public Display Name, Email, Phone Number, and Password, Firebase creates their authentication account and immediately sends an official verification link to their email address. The modal transitions to a dedicated **Verify Your Email Address** screen with live verification polling, a **"I've Clicked the Link — Verify & Claim 5 Tokens"** button, and a **"Resend Verification Email"** button with cooldown timer.
- **Target Audience / Persona**: Crypto forecast participants registering for daily BTC rounds who require verified, sybil-resistant accounts under Game Rules v2.2 Section 24.
- **Key Value**: Eliminates fake/unverified email signups, enforces Firestore's `request.auth.token.email_verified == true` security rule natively for email accounts, and ensures only verified participants receive the 5 Welcome Tokens.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Registration & Automatic Email Dispatch**:
   - User fills out the registration form (`First Name`, `Last Name`, `Public Display Name`, `Email`, `Phone Number`, `Password`).
   - System calls Firebase `createUserWithEmailAndPassword(auth, email, password)` and `sendEmailVerification(user)` and caches the pending registration metadata (`firstName`, `lastName`, `username`, `phone`, `referralCodeUsed`) for that UID.
   - Modal immediately transitions to the **Email Verification Pending (`verify_email`)** view.
2. **Email Verification Pending View**:
   - Displays the target email address where the confirmation link was sent.
   - Shows a clear status checklist:
     - *Step 1*: Account credentials created
     - *Step 2*: Click the confirmation link sent to your inbox (check Spam/Promotions folder)
     - *Step 3*: Confirm verification to unlock **5 Free Welcome Tokens**
   - **Primary CTA**: `"I've Verified My Email — Claim 5 Free Tokens"` (calls `auth.currentUser.reload()`, refreshes the ID token via `getIdToken(true)`, checks `emailVerified === true`, and provisions the `/users/{uid}` and `/publicProfiles/{uid}` Firestore documents with `tokenBalance: 5`).
   - **Secondary Actions**: `"Resend Confirmation Link"` (with 60-second rate-limit countdown) and `"Sign Out / Use Different Email"`.
3. **Unverified Login Interception**:
   - If a user closes the browser before clicking the link and later logs in with their email and password, the system checks `fbUser.emailVerified`.
   - If `false`, it intercepts login and routes them directly to the **Email Verification Pending** screen so they can verify or resend the link.
   - If `true`, it completes Firestore profile initialization (if not yet finalized) and signs them into the arena with their 5 Welcome Tokens.
4. **Real Password Reset Email**:
   - In the **Forgot Password** tab, entering a registered email dispatches a real password reset link via Firebase `sendPasswordResetEmail(auth, email)`.

### Visual Identity & Theme
- Matches the existing deep obsidian dark-slate theme (`#0B0F19`, `#0E1626`) with cyan (`#06B6D4`), emerald (`#10B981`), and amber (`#F59E0B`) status accents and `JetBrains Mono` tabular figures for countdown timers.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Token Refresh Before Firestore Creation (`getIdToken(true)`)**
  - *Chosen Approach*: After `auth.currentUser.reload()` confirms `emailVerified === true`, explicitly call `await auth.currentUser.getIdToken(true)` before writing to Firestore.
  - *Why*: Firestore security rules evaluate the JWT claim `request.auth.token.email_verified == true`. Forcing a token refresh ensures the updated `email_verified: true` claim is immediately present in the token sent to Firestore, preventing false `PERMISSION_DENIED` errors right after clicking the email link.
- **Decision 2: Graceful Console Configuration Guidance**
  - *Chosen Approach*: Detect Firebase error code `auth/operation-not-allowed` during Email/Password signup or login and render a helpful interactive setup card with a direct link to the project's Firebase Console Authentication Providers page.
  - *Why*: Gives the project owner a 1-click path to enable the Email/Password provider in Firebase Console without cryptic error messages.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Registration Form (AuthModal)                       │
│     [First/Last Name, Public Username, Email, Phone, Password]             │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│        Firebase Auth: createUserWithEmailAndPassword + sendEmailVerification│
│        Cache pending profile metadata in localStorage by UID               │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  Verification Gate Screen (mode: 'verify_email')           │
│     • Polls / checks auth.currentUser.reload()                             │
│     • Blocks 5 Welcome Tokens & Prediction Box until emailVerified == true │
│     • Allows "Resend Verification Email" (60s cooldown)                    │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │ (emailVerified === true)
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│        Force JWT Refresh: auth.currentUser.getIdToken(true)                │
│        Write to Firestore: /users/{uid} (5 Tokens) & /publicProfiles/{uid} │
└────────────────────────────────────────────────────────────────────────────┘
```

### Interactive Component & State Mapping
- **Firebase Service (`firebase.ts`)**:
  - Exports `createUserWithEmailAndPassword`, `signInWithEmailAndPassword`, `sendEmailVerification`, `sendPasswordResetEmail`, and `reloadUserAndCheckVerified`.
- **Auth Service (`authService.ts`)**:
  - Stores pending registration metadata (`firstName`, `lastName`, `username`, `phone`, `referralCodeUsed`) keyed by Firebase `uid` until email verification completes.
  - Exposes `registerWithFirebaseEmail`, `loginWithFirebaseEmail`, `verifyAndActivateEmailAccount`, `resendVerificationEmailLink`, and `sendFirebasePasswordReset`.
- **Auth Modal (`AuthModal.tsx`)**:
  - Adds `'verify_email'` mode with real-time verification check, 60-second resend cooldown timer, and direct Firebase Console provider activation instructions if `auth/operation-not-allowed` is encountered.
- **Header & Prediction Box (`Header.tsx`, `PredictionBox.tsx`)**:
  - If an authenticated Firebase user has `emailVerified === false`, displays a prominent **"Verify Email to Claim 5 Tokens"** badge in the header and blocks prediction submissions until verified.
