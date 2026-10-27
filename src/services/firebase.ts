import { initializeApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, GoogleAuthProvider, EmailAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, updatePassword, deleteUser, reauthenticateWithCredential,
  reauthenticateWithPopup, signOut as firebaseSignOut, onAuthStateChanged,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type { UserProfile } from '../types/game';

const emulated = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true';
const app = initializeApp(emulated ? { ...firebaseConfig, projectId: 'demo-prediction-game', apiKey: 'demo-key' } : firebaseConfig);
export const auth = getAuth(app);
if (emulated) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
export const googleProvider = new GoogleAuthProvider();
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = auth.currentUser?.emailVerified ? await auth.currentUser.getIdToken() : null;
  const response = await fetch('/api' + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Server request failed');
  return data as T;
}
export function sanitizeId(input: string) { return input.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0,128); }
export function sanitizeUsername(input: string) {
  const cleaned = input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0,30);
  return cleaned.length >= 3 ? cleaned : 'Trader_' + crypto.randomUUID().slice(0,8);
}
export async function reloadAndCheckEmailVerified() {
  if (!auth.currentUser) return false;
  await auth.currentUser.reload();
  if (auth.currentUser.emailVerified) { await auth.currentUser.getIdToken(true); return true; }
  return false;
}
export async function fetchFirestoreUserProfile(_uid: string): Promise<UserProfile | null> { return api('/me'); }
export async function createFirestoreUserProfile(_uid: string, profile: Omit<UserProfile, 'id'> & { referredByCode?: string; avatarUrl?: string }): Promise<UserProfile> {
  return api('/me', 'POST', { username: profile.username, firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone });
}
export async function updateFirestoreProfileDetails(_uid: string, updates: Partial<UserProfile>): Promise<void> {
  if (updates.kycStatus === 'PENDING') {
    await api('/kyc', 'POST', { kycDocumentType: updates.kycDocumentType, walletAddress: updates.walletAddress });
  } else {
    const allowed = Object.fromEntries(Object.entries(updates).filter(([key]) => ['username','firstName','lastName','phone'].includes(key)));
    await api('/me', 'PATCH', allowed);
  }
}
export async function deleteFirestoreUserProfile(_uid: string): Promise<void> {
  await auth.currentUser?.getIdToken(true);
  await api('/me', 'DELETE');
}
export { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, updatePassword, deleteUser, EmailAuthProvider, reauthenticateWithCredential,
  reauthenticateWithPopup, firebaseSignOut, onAuthStateChanged };
export type { FirebaseUser };
