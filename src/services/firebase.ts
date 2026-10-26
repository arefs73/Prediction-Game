import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { ChatMessage, PredictionEntry, UserProfile } from '../types/game';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export function sanitizeId(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || 'user_default';
}

export function sanitizeUsername(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);
  return cleaned.length >= 3 ? cleaned : `Trader_${Math.floor(100 + Math.random() * 900)}`;
}

/**
 * Reloads the current Firebase user and forces an ID token refresh if verified,
 * ensuring Firestore rules immediately see `request.auth.token.email_verified == true`.
 */
export async function reloadAndCheckEmailVerified(): Promise<boolean> {
  if (!auth.currentUser) return false;
  await auth.currentUser.reload();
  if (auth.currentUser.emailVerified) {
    await auth.currentUser.getIdToken(true);
    return true;
  }
  return false;
}

export async function fetchFirestoreUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: data.userId,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      tokenBalance: data.tokenBalance,
      streakDay: data.streakDay,
      streakClaimedToday: data.streakClaimedToday,
      lastPredictionDate: data.lastPredictionDate || null,
      gamingCycleWeek: data.gamingCycleWeek,
      kycStatus: data.kycStatus,
      kycDocumentType: data.kycDocumentType,
      walletAddress: data.walletAddress,
      referralCode: data.referralCode,
      referralCount: data.referralCount,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createFirestoreUserProfile(
  uid: string,
  profile: Omit<UserProfile, 'id'> & { referredByCode?: string; avatarUrl?: string }
): Promise<UserProfile> {
  const userPath = `users/${uid}`;
  const publicPath = `publicProfiles/${uid}`;
  const safeUsername = sanitizeUsername(profile.username);
  const safeReferralCode = sanitizeId(
    profile.referralCode || `${safeUsername.toUpperCase().slice(0, 8)}-BTC-${Math.floor(100 + Math.random() * 899)}`
  ).slice(0, 32);

  const payload: Record<string, unknown> = {
    userId: uid,
    username: safeUsername,
    firstName: profile.firstName.trim().slice(0, 80) || 'Participant',
    lastName: profile.lastName.trim().slice(0, 80) || 'Trader',
    email: profile.email.trim().slice(0, 150),
    phone: profile.phone.trim().slice(0, 30) || '+31 6 00000000',
    tokenBalance: Math.max(0, Math.min(10000, Math.floor(profile.tokenBalance))),
    streakDay: Math.max(1, Math.min(7, Math.floor(profile.streakDay))),
    streakClaimedToday: Boolean(profile.streakClaimedToday),
    gamingCycleWeek: Math.max(1, Math.min(53, Math.floor(profile.gamingCycleWeek || 38))),
    kycStatus: profile.kycStatus || 'UNVERIFIED',
    referralCode: safeReferralCode,
    referralCount: Math.max(0, Math.floor(profile.referralCount || 0)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (profile.lastPredictionDate) {
    payload.lastPredictionDate = profile.lastPredictionDate.slice(0, 20);
  }
  if (profile.kycDocumentType) {
    payload.kycDocumentType = profile.kycDocumentType.slice(0, 60);
  }
  if (profile.walletAddress) {
    payload.walletAddress = profile.walletAddress.slice(0, 120);
  }
  if (profile.referredByCode) {
    payload.referredByCode = profile.referredByCode.trim().slice(0, 32);
  }

  try {
    await setDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

  try {
    const publicPayload: Record<string, unknown> = {
      userId: uid,
      username: safeUsername,
      createdAt: serverTimestamp(),
    };
    if (profile.avatarUrl) {
      publicPayload.avatarUrl = profile.avatarUrl.slice(0, 500);
    }
    await setDoc(doc(db, 'publicProfiles', uid), publicPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, publicPath);
  }

  return {
    id: uid,
    username: safeUsername,
    firstName: String(payload.firstName),
    lastName: String(payload.lastName),
    email: String(payload.email),
    phone: String(payload.phone),
    tokenBalance: Number(payload.tokenBalance),
    streakDay: Number(payload.streakDay),
    streakClaimedToday: Boolean(payload.streakClaimedToday),
    lastPredictionDate: profile.lastPredictionDate || null,
    gamingCycleWeek: Number(payload.gamingCycleWeek),
    kycStatus: (payload.kycStatus as UserProfile['kycStatus']) || 'UNVERIFIED',
    kycDocumentType: profile.kycDocumentType,
    walletAddress: profile.walletAddress,
    referralCode: safeReferralCode,
    referralCount: Number(payload.referralCount),
  };
}

export async function updateFirestoreProfileDetails(
  uid: string,
  updates: {
    username?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    kycStatus?: 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
    kycDocumentType?: string;
    walletAddress?: string;
  }
): Promise<void> {
  const path = `users/${uid}`;
  const cleanUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.username !== undefined) {
    cleanUpdates.username = sanitizeUsername(updates.username);
  }
  if (updates.firstName !== undefined) {
    cleanUpdates.firstName = updates.firstName.trim().slice(0, 80);
  }
  if (updates.lastName !== undefined) {
    cleanUpdates.lastName = updates.lastName.trim().slice(0, 80);
  }
  if (updates.phone !== undefined) {
    cleanUpdates.phone = updates.phone.trim().slice(0, 30);
  }
  if (updates.kycStatus !== undefined) {
    cleanUpdates.kycStatus = updates.kycStatus;
  }
  if (updates.kycDocumentType !== undefined) {
    cleanUpdates.kycDocumentType = updates.kycDocumentType.slice(0, 60);
  }
  if (updates.walletAddress !== undefined) {
    cleanUpdates.walletAddress = updates.walletAddress.slice(0, 120);
  }

  try {
    await updateDoc(doc(db, 'users', uid), cleanUpdates);
    if (cleanUpdates.username) {
      await updateDoc(doc(db, 'publicProfiles', uid), {
        username: cleanUpdates.username,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateFirestoreTokenState(
  uid: string,
  tokenUpdates: {
    tokenBalance?: number;
    streakDay?: number;
    streakClaimedToday?: boolean;
    lastPredictionDate?: string;
    gamingCycleWeek?: number;
    referralCount?: number;
  }
): Promise<void> {
  const path = `users/${uid}`;
  const cleanUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (tokenUpdates.tokenBalance !== undefined) {
    cleanUpdates.tokenBalance = Math.max(0, Math.min(10000, Math.floor(tokenUpdates.tokenBalance)));
  }
  if (tokenUpdates.streakDay !== undefined) {
    cleanUpdates.streakDay = Math.max(1, Math.min(7, Math.floor(tokenUpdates.streakDay)));
  }
  if (tokenUpdates.streakClaimedToday !== undefined) {
    cleanUpdates.streakClaimedToday = Boolean(tokenUpdates.streakClaimedToday);
  }
  if (tokenUpdates.lastPredictionDate !== undefined) {
    cleanUpdates.lastPredictionDate = tokenUpdates.lastPredictionDate.slice(0, 20);
  }
  if (tokenUpdates.gamingCycleWeek !== undefined) {
    cleanUpdates.gamingCycleWeek = Math.max(1, Math.min(53, Math.floor(tokenUpdates.gamingCycleWeek)));
  }
  if (tokenUpdates.referralCount !== undefined) {
    cleanUpdates.referralCount = Math.max(0, Math.min(10000, Math.floor(tokenUpdates.referralCount)));
  }

  try {
    await updateDoc(doc(db, 'users', uid), cleanUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveFirestorePrediction(entry: PredictionEntry): Promise<void> {
  const safeId = sanitizeId(entry.id);
  const path = `predictions/${safeId}`;
  const payload: Record<string, unknown> = {
    id: safeId,
    userId: entry.userId,
    username: sanitizeUsername(entry.username),
    predictedPrice: Math.round(entry.predictedPrice * 100) / 100,
    submittedAt: entry.submittedAt.slice(0, 40),
    submittedTimestamp: Math.floor(entry.submittedTimestamp),
    roundId: sanitizeId(entry.roundId).slice(0, 40),
    createdAt: serverTimestamp(),
  };
  if (entry.avatarUrl) {
    payload.avatarUrl = entry.avatarUrl.slice(0, 500);
  }

  try {
    await setDoc(doc(db, 'predictions', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveFirestoreChatMessage(msg: ChatMessage, roundId: string): Promise<void> {
  const safeId = sanitizeId(msg.id);
  const path = `chatMessages/${safeId}`;
  const payload: Record<string, unknown> = {
    id: safeId,
    userId: msg.userId,
    username: sanitizeUsername(msg.username),
    message: msg.message.trim().slice(0, 280),
    timestamp: msg.timestamp.slice(0, 16),
    roundId: sanitizeId(roundId).slice(0, 40),
    createdAt: serverTimestamp(),
  };
  if (msg.avatarUrl) {
    payload.avatarUrl = msg.avatarUrl.slice(0, 500);
  }

  try {
    await setDoc(doc(db, 'chatMessages', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteFirestoreUserProfile(uid: string): Promise<void> {
  const userPath = `users/${uid}`;
  const publicPath = `publicProfiles/${uid}`;
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, userPath);
  }
  try {
    await deleteDoc(doc(db, 'publicProfiles', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, publicPath);
  }
}

export {
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
  onAuthStateChanged,
};
export type { FirebaseUser };
