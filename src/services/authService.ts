import { UserProfile } from '../types/game';
import { INITIAL_USER } from './seedData';
import {
  auth,
  googleProvider,
  FIREBASE_PROJECT_ID,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  firebaseSignOut,
  reloadAndCheckEmailVerified,
  fetchFirestoreUserProfile,
  createFirestoreUserProfile,
  updateFirestoreProfileDetails,
  updateFirestoreTokenState,
  deleteFirestoreUserProfile,
  sanitizeUsername,
} from './firebase';

export interface StoredAccount {
  user: UserProfile;
  passwordHash: string;
  authProvider: 'email' | 'google';
  createdAt: string;
}

export interface PendingRegistrationMetadata {
  uid: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  referralCodeUsed?: string;
  createdAt: string;
}

const ACCOUNTS_STORAGE_KEY = 'apex_registered_accounts_v2';
const ACTIVE_SESSION_KEY = 'apex_active_session_uid_v2';
const PENDING_PROFILES_KEY = 'apex_pending_email_profiles_v2';

export const FIREBASE_AUTH_PROVIDERS_CONSOLE_URL = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`;

function hashPassword(password: string): string {
  let h1 = 0xdeadbeef ^ password.length;
  let h2 = 0x41c6ce57 ^ password.length;
  for (let i = 0, ch; i < password.length; i++) {
    ch = password.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `h_${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

export function getRegisteredAccounts(): Record<string, StoredAccount> {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }

  const seedAccounts: Record<string, StoredAccount> = {
    [INITIAL_USER.id]: {
      user: INITIAL_USER,
      passwordHash: hashPassword('Demo@2026'),
      authProvider: 'email',
      createdAt: '2026-10-01T12:00:00.000Z',
    },
  };
  localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(seedAccounts));
  return seedAccounts;
}

function saveRegisteredAccounts(accounts: Record<string, StoredAccount>): void {
  localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

function getPendingProfiles(): Record<string, PendingRegistrationMetadata> {
  try {
    const raw = localStorage.getItem(PENDING_PROFILES_KEY);
    if (raw) {
      return JSON.parse(raw) || {};
    }
  } catch {
    // ignore
  }
  return {};
}

function savePendingProfile(meta: PendingRegistrationMetadata): void {
  const all = getPendingProfiles();
  all[meta.uid] = meta;
  all[meta.email.toLowerCase()] = meta;
  localStorage.setItem(PENDING_PROFILES_KEY, JSON.stringify(all));
}

function removePendingProfile(uid: string, email?: string | null): void {
  const all = getPendingProfiles();
  delete all[uid];
  if (email) {
    delete all[email.toLowerCase()];
  }
  localStorage.setItem(PENDING_PROFILES_KEY, JSON.stringify(all));
}

export function getActiveSessionUser(): UserProfile | null {
  try {
    const activeUid = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!activeUid) return null;
    const accounts = getRegisteredAccounts();
    return accounts[activeUid]?.user || null;
  } catch {
    return null;
  }
}

export function setActiveSessionUser(
  user: UserProfile | null,
  authProvider: 'email' | 'google' = 'email'
): void {
  if (!user) {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    return;
  }
  const accounts = getRegisteredAccounts();
  const existing = accounts[user.id];
  accounts[user.id] = {
    user,
    passwordHash: existing?.passwordHash || hashPassword('firebase_auth'),
    authProvider: existing?.authProvider || authProvider,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  saveRegisteredAccounts(accounts);
  localStorage.setItem(ACTIVE_SESSION_KEY, user.id);
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  referralCodeUsed?: string;
}

export interface RegisterResult {
  status: 'VERIFICATION_EMAIL_SENT' | 'PROVIDER_NOT_ENABLED' | 'ERROR';
  pendingEmail?: string;
  uid?: string;
  consoleUrl?: string;
  error?: string;
}

function mapFirebaseAuthError(err: unknown): { code: string; message: string } {
  const anyErr = err as { code?: string; message?: string };
  const code = anyErr?.code || '';
  if (code === 'auth/operation-not-allowed') {
    return {
      code,
      message:
        'Email/Password Sign-In is not yet enabled in your Firebase Console. Please enable the Email/Password provider in Firebase Authentication to send real confirmation links.',
    };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      code,
      message: 'This email address is already registered. Please sign in or check your inbox for the verification link.',
    };
  }
  if (code === 'auth/invalid-email') {
    return { code, message: 'Please enter a valid email address.' };
  }
  if (code === 'auth/weak-password') {
    return { code, message: 'Password is too weak. Please use at least 6 characters.' };
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return { code, message: 'Invalid email or password. Please verify your credentials.' };
  }
  if (code === 'auth/too-many-requests') {
    return {
      code,
      message: 'Too many requests from this device. Please wait a minute before requesting another email.',
    };
  }
  return {
    code,
    message: anyErr?.message || 'Authentication failed. Please try again.',
  };
}

/**
 * Registers a new user via Firebase Auth (`createUserWithEmailAndPassword`)
 * and immediately dispatches a real email verification link (`sendEmailVerification`).
 * Does NOT grant the 5 Welcome Tokens until the user verifies their email link.
 */
export async function registerWithFirebaseEmail(input: RegisterInput): Promise<RegisterResult> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const password = input.password;

  // Game Rules v2.2 Section 1 Validation
  if (!firstName || firstName.length < 2) {
    return { status: 'ERROR', error: 'Please enter your legal first name (minimum 2 characters).' };
  }
  if (!lastName || lastName.length < 2) {
    return { status: 'ERROR', error: 'Please enter your legal last name (minimum 2 characters).' };
  }
  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
    return {
      status: 'ERROR',
      error: 'Public Display Name must be 3–30 characters using only letters, numbers, underscores, or hyphens.',
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'ERROR', error: 'Please enter a valid email address.' };
  }
  if (phone.replace(/[^0-9]/g, '').length < 7) {
    return { status: 'ERROR', error: 'Please enter a valid phone number (minimum 7 digits).' };
  }
  if (password.length < 6) {
    return { status: 'ERROR', error: 'Password must be at least 6 characters long.' };
  }

  try {
    // 1. Create account in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const fbUser = userCredential.user;

    // 2. Cache pending registration metadata until email verification completes
    savePendingProfile({
      uid: fbUser.uid,
      firstName,
      lastName,
      username: sanitizeUsername(username),
      email,
      phone,
      referralCodeUsed: input.referralCodeUsed?.trim(),
      createdAt: new Date().toISOString(),
    });

    // 3. Dispatch real confirmation / verification link to the user's email inbox
    await sendEmailVerification(fbUser);

    // 4. Do NOT grant active session or 5 tokens until email is verified
    setActiveSessionUser(null);

    return {
      status: 'VERIFICATION_EMAIL_SENT',
      pendingEmail: email,
      uid: fbUser.uid,
    };
  } catch (err: unknown) {
    const mapped = mapFirebaseAuthError(err);
    if (mapped.code === 'auth/operation-not-allowed') {
      return {
        status: 'PROVIDER_NOT_ENABLED',
        consoleUrl: FIREBASE_AUTH_PROVIDERS_CONSOLE_URL,
        error: mapped.message,
      };
    }
    return { status: 'ERROR', error: mapped.message };
  }
}

/**
 * Provisions the verified Firestore profile with 5 Free Welcome Tokens once `emailVerified === true`.
 */
export async function finalizeVerifiedEmailProfile(uid: string, email: string): Promise<UserProfile> {
  // Check if profile already exists in Firestore
  const existing = await fetchFirestoreUserProfile(uid);
  if (existing) {
    removePendingProfile(uid, email);
    setActiveSessionUser(existing, 'email');
    return existing;
  }

  // Retrieve cached registration details from signup step
  const pendingMap = getPendingProfiles();
  const pending = pendingMap[uid] || pendingMap[email.toLowerCase()];

  const username = pending?.username || sanitizeUsername(email.split('@')[0] || 'Trader');
  const firstName = pending?.firstName || 'Participant';
  const lastName = pending?.lastName || 'Trader';
  const phone = pending?.phone || '+31 6 00000000';
  const refCode = `${username.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}-BTC-${Math.floor(100 + Math.random() * 899)}`;

  const created = await createFirestoreUserProfile(uid, {
    username,
    firstName,
    lastName,
    email,
    phone,
    tokenBalance: 5, // 5 Free Welcome Tokens granted ONLY after email verification!
    streakDay: 1,
    streakClaimedToday: false,
    lastPredictionDate: null,
    gamingCycleWeek: 38,
    kycStatus: 'UNVERIFIED',
    referralCode: refCode,
    referralCount: 0,
    referredByCode: pending?.referralCodeUsed,
  });

  removePendingProfile(uid, email);
  setActiveSessionUser(created, 'email');
  return created;
}

/**
 * Checks if the current Firebase user has clicked the verification link in their email.
 * If verified, refreshes the JWT token and activates their account with 5 Free Welcome Tokens.
 */
export async function verifyAndActivateEmailAccount(): Promise<{
  verified: boolean;
  user?: UserProfile;
  error?: string;
}> {
  if (!auth.currentUser) {
    return {
      verified: false,
      error: 'No pending authentication session found. Please sign in with your email and password first.',
    };
  }

  try {
    const isVerified = await reloadAndCheckEmailVerified();
    if (!isVerified) {
      return {
        verified: false,
        error:
          'Your email has not been verified yet. Please click the verification link sent to your email inbox (check your Spam/Promotions folder), then click this button again.',
      };
    }

    const fbUser = auth.currentUser;
    const activatedProfile = await finalizeVerifiedEmailProfile(
      fbUser.uid,
      fbUser.email || 'participant@apexpredict.io'
    );

    return {
      verified: true,
      user: activatedProfile,
    };
  } catch (err: unknown) {
    const mapped = mapFirebaseAuthError(err);
    return {
      verified: false,
      error: mapped.message,
    };
  }
}

/**
 * Resends the Firebase verification email link to the currently signed-in unverified user.
 */
export async function resendVerificationEmailLink(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!auth.currentUser) {
    return { success: false, error: 'Please sign in with your email and password to resend the verification link.' };
  }

  try {
    await sendEmailVerification(auth.currentUser);
    return { success: true };
  } catch (err: unknown) {
    const mapped = mapFirebaseAuthError(err);
    return { success: false, error: mapped.message };
  }
}

export interface LoginResult {
  status: 'SUCCESS' | 'UNVERIFIED_EMAIL' | 'PROVIDER_NOT_ENABLED' | 'ERROR';
  user?: UserProfile;
  pendingEmail?: string;
  isNewActivation?: boolean;
  consoleUrl?: string;
  error?: string;
}

/**
 * Signs in a participant.
 * - Supports the built-in Demo account (`ArefS` / `Demo@2026`)
 * - Uses Firebase `signInWithEmailAndPassword` for email accounts and strictly enforces `emailVerified === true`
 */
export async function loginWithFirebaseEmail(
  identifier: string,
  password: string
): Promise<LoginResult> {
  const cleanId = identifier.trim();
  if (!cleanId || !password) {
    return { status: 'ERROR', error: 'Please enter both your email/username and password.' };
  }

  // Allow instant login for the built-in Demo account ('ArefS' or 'aref.s.1373@gmail.com' with 'Demo@2026')
  if (
    (cleanId.toLowerCase() === 'arefs' || cleanId.toLowerCase() === INITIAL_USER.email.toLowerCase()) &&
    password === 'Demo@2026'
  ) {
    const accounts = getRegisteredAccounts();
    const demoUser = accounts[INITIAL_USER.id]?.user || INITIAL_USER;
    setActiveSessionUser(demoUser, 'email');
    return { status: 'SUCCESS', user: demoUser, isNewActivation: false };
  }

  // Resolve username to email if user typed their username and it's in pending/local records
  let emailToUse = cleanId.toLowerCase();
  if (!emailToUse.includes('@')) {
    const pendingAll = Object.values(getPendingProfiles());
    const foundPending = pendingAll.find((p) => p.username.toLowerCase() === emailToUse);
    if (foundPending) {
      emailToUse = foundPending.email.toLowerCase();
    } else {
      const accounts = Object.values(getRegisteredAccounts());
      const foundLocal = accounts.find((a) => a.user.username.toLowerCase() === emailToUse);
      if (foundLocal) {
        emailToUse = foundLocal.user.email.toLowerCase();
      }
    }
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, emailToUse, password);
    const fbUser = cred.user;
    await fbUser.reload();

    // Enforce strict email verification before granting 5 tokens or allowing predictions
    if (!fbUser.emailVerified) {
      setActiveSessionUser(null);
      return {
        status: 'UNVERIFIED_EMAIL',
        pendingEmail: fbUser.email || emailToUse,
      };
    }

    // Refresh JWT token so Firestore sees email_verified == true
    await fbUser.getIdToken(true);

    const existing = await fetchFirestoreUserProfile(fbUser.uid);
    if (existing) {
      setActiveSessionUser(existing, 'email');
      return { status: 'SUCCESS', user: existing, isNewActivation: false };
    }

    // First login after clicking email verification link -> provision Firestore profile & 5 Free Tokens
    const newlyActivated = await finalizeVerifiedEmailProfile(
      fbUser.uid,
      fbUser.email || emailToUse
    );
    return { status: 'SUCCESS', user: newlyActivated, isNewActivation: true };
  } catch (err: unknown) {
    const mapped = mapFirebaseAuthError(err);
    if (mapped.code === 'auth/operation-not-allowed') {
      return {
        status: 'PROVIDER_NOT_ENABLED',
        consoleUrl: FIREBASE_AUTH_PROVIDERS_CONSOLE_URL,
        error: mapped.message,
      };
    }
    return { status: 'ERROR', error: mapped.message };
  }
}

/**
 * Dispatches a real password reset link email via Firebase Auth (`sendPasswordResetEmail`).
 */
export async function sendFirebasePasswordReset(email: string): Promise<{
  success: boolean;
  consoleUrl?: string;
  error?: string;
}> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid registered email address.' };
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    return { success: true };
  } catch (err: unknown) {
    const mapped = mapFirebaseAuthError(err);
    if (mapped.code === 'auth/operation-not-allowed') {
      return {
        success: false,
        consoleUrl: FIREBASE_AUTH_PROVIDERS_CONSOLE_URL,
        error: mapped.message,
      };
    }
    return { success: false, error: mapped.message };
  }
}

export async function changeAccountPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (newPassword.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters.' };
  }

  // If authenticated via Firebase Email/Password, reauthenticate and update password in Firebase Auth
  if (auth.currentUser && auth.currentUser.uid === userId && auth.currentUser.email) {
    const isGoogleOnly = auth.currentUser.providerData.every((p) => p.providerId === 'google.com');
    if (isGoogleOnly) {
      return { success: false, error: 'Your account uses Google Sign-In and is managed through your Google Account.' };
    }
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      return { success: true };
    } catch (err: unknown) {
      const mapped = mapFirebaseAuthError(err);
      return { success: false, error: mapped.message };
    }
  }

  const accounts = getRegisteredAccounts();
  const acc = accounts[userId];
  if (!acc) {
    return { success: false, error: 'Account record not found.' };
  }
  if (acc.passwordHash !== hashPassword(currentPassword)) {
    return { success: false, error: 'Your current password is incorrect.' };
  }
  acc.passwordHash = hashPassword(newPassword);
  saveRegisteredAccounts(accounts);
  return { success: true };
}

export interface GoogleSignInResult {
  status: 'EXISTING_USER' | 'NEEDS_ONBOARDING' | 'ERROR';
  user?: UserProfile;
  pendingGoogleData?: {
    uid: string;
    email: string;
    firstName: string;
    lastName: string;
    suggestedUsername: string;
    avatarUrl: string;
  };
  error?: string;
}

export async function signInWithGooglePopup(): Promise<GoogleSignInResult> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const fbUser = cred.user;

    const existingProfile = await fetchFirestoreUserProfile(fbUser.uid);
    if (existingProfile) {
      setActiveSessionUser(existingProfile, 'google');
      return { status: 'EXISTING_USER', user: existingProfile };
    }

    const displayName = fbUser.displayName || 'Crypto Trader';
    const parts = displayName.trim().split(/\s+/);
    const firstName = parts[0] || 'Participant';
    const lastName = parts.slice(1).join(' ') || 'Trader';
    const emailPrefix = (fbUser.email || 'trader').split('@')[0];
    const suggestedUsername = sanitizeUsername(emailPrefix);

    return {
      status: 'NEEDS_ONBOARDING',
      pendingGoogleData: {
        uid: fbUser.uid,
        email: fbUser.email || '',
        firstName,
        lastName,
        suggestedUsername,
        avatarUrl: fbUser.photoURL || '',
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Google Sign-In was cancelled or failed.';
    return { status: 'ERROR', error: message };
  }
}

export async function completeGoogleOnboarding(params: {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  phone: string;
  referralCodeUsed?: string;
  avatarUrl?: string;
}): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();
  const username = params.username.trim();
  const phone = params.phone.trim();

  if (!firstName || firstName.length < 2) {
    return { success: false, error: 'Please provide your legal first name.' };
  }
  if (!lastName || lastName.length < 2) {
    return { success: false, error: 'Please provide your legal last name.' };
  }
  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
    return {
      success: false,
      error: 'Public Display Name must be 3–30 characters (letters, numbers, underscores, hyphens).',
    };
  }
  if (phone.replace(/[^0-9]/g, '').length < 7) {
    return { success: false, error: 'Please provide a valid phone number (minimum 7 digits).' };
  }

  const refCode = `${username.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}-BTC-${Math.floor(100 + Math.random() * 899)}`;

  try {
    const created = await createFirestoreUserProfile(params.uid, {
      username,
      firstName,
      lastName,
      email: params.email,
      phone,
      tokenBalance: 5,
      streakDay: 1,
      streakClaimedToday: false,
      lastPredictionDate: null,
      gamingCycleWeek: 38,
      kycStatus: 'UNVERIFIED',
      referralCode: refCode,
      referralCount: 0,
      referredByCode: params.referralCodeUsed,
      avatarUrl: params.avatarUrl,
    });

    setActiveSessionUser(created, 'google');
    return { success: true, user: created };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create profile in database.',
    };
  }
}

export async function syncUserUpdate(
  currentUser: UserProfile,
  updates: Partial<UserProfile>
): Promise<UserProfile> {
  const updatedUser: UserProfile = {
    ...currentUser,
    ...updates,
  };

  setActiveSessionUser(updatedUser);

  if (auth.currentUser && auth.currentUser.uid === currentUser.id && auth.currentUser.emailVerified) {
    const profileFieldKeys = [
      'username',
      'firstName',
      'lastName',
      'phone',
      'kycStatus',
      'kycDocumentType',
      'walletAddress',
    ] as const;
    const tokenFieldKeys = [
      'tokenBalance',
      'streakDay',
      'streakClaimedToday',
      'lastPredictionDate',
      'gamingCycleWeek',
      'referralCount',
    ] as const;

    const hasProfileUpdates = profileFieldKeys.some((k) => k in updates);
    const hasTokenUpdates = tokenFieldKeys.some((k) => k in updates);

    if (hasProfileUpdates) {
      await updateFirestoreProfileDetails(currentUser.id, {
        username: updatedUser.username,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone,
        kycStatus: updatedUser.kycStatus,
        kycDocumentType: updatedUser.kycDocumentType,
        walletAddress: updatedUser.walletAddress,
      });
    }

    if (hasTokenUpdates) {
      await updateFirestoreTokenState(currentUser.id, {
        tokenBalance: updatedUser.tokenBalance,
        streakDay: updatedUser.streakDay,
        streakClaimedToday: updatedUser.streakClaimedToday,
        lastPredictionDate: updatedUser.lastPredictionDate || undefined,
        gamingCycleWeek: updatedUser.gamingCycleWeek,
        referralCount: updatedUser.referralCount,
      });
    }
  }

  return updatedUser;
}

export async function logoutCurrentUser(): Promise<void> {
  setActiveSessionUser(null);
  try {
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    }
  } catch {
    // ignore signout error
  }
}

export interface DeleteAccountParams {
  user: UserProfile;
  confirmationText: string;
  password?: string;
}

/**
 * Verifies the user's confirmation input and credentials, then permanently deletes:
 * 1. Their Firestore `/users/{uid}` and `/publicProfiles/{uid}` records
 * 2. Their Firebase Authentication account (`deleteUser`)
 * 3. Their local account cache and active session
 */
export async function deleteCurrentUserAccount(params: DeleteAccountParams): Promise<{
  success: boolean;
  error?: string;
}> {
  const { user, confirmationText, password } = params;
  const trimmedConfirm = confirmationText.trim();

  // Step 1: Verify the user typed their exact Display Name or "DELETE"
  if (
    trimmedConfirm.toLowerCase() !== user.username.toLowerCase() &&
    trimmedConfirm.toUpperCase() !== 'DELETE'
  ) {
    return {
      success: false,
      error: `Verification failed: Please type "${user.username}" or "DELETE" exactly to confirm account deletion.`,
    };
  }

  // Step 2: Check if authenticated with Firebase Auth
  if (auth.currentUser && auth.currentUser.uid === user.id) {
    const fbUser = auth.currentUser;
    const isGoogleOnly = fbUser.providerData.some((p) => p.providerId === 'google.com') &&
      !fbUser.providerData.some((p) => p.providerId === 'password');

    try {
      if (isGoogleOnly) {
        // Re-verify Google identity via popup before permanent deletion
        await reauthenticateWithPopup(fbUser, googleProvider);
      } else if (fbUser.email) {
        if (!password) {
          return {
            success: false,
            error: 'Please enter your current account password to verify your identity.',
          };
        }
        const credential = EmailAuthProvider.credential(fbUser.email, password);
        await reauthenticateWithCredential(fbUser, credential);
      }

      // Delete Firestore documents first while auth token is still valid
      if (fbUser.emailVerified) {
        await deleteFirestoreUserProfile(fbUser.uid);
      }

      // Delete Firebase Auth user record
      await deleteUser(fbUser);
    } catch (err: unknown) {
      const mapped = mapFirebaseAuthError(err);
      return {
        success: false,
        error: mapped.message,
      };
    }
  } else {
    // Local / Demo account password verification
    const accounts = getRegisteredAccounts();
    const acc = accounts[user.id];
    if (acc && acc.authProvider === 'email') {
      if (!password) {
        return {
          success: false,
          error: 'Please enter your current password to verify account deletion.',
        };
      }
      if (acc.passwordHash !== hashPassword(password)) {
        return {
          success: false,
          error: 'Incorrect password. Account deletion could not be verified.',
        };
      }
    }
  }

  // Step 3: Remove from local storage and clear session
  const accounts = getRegisteredAccounts();
  delete accounts[user.id];
  saveRegisteredAccounts(accounts);
  removePendingProfile(user.id, user.email);
  setActiveSessionUser(null);

  return { success: true };
}

