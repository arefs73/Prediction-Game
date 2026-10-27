import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types/game';
import {
  registerWithFirebaseEmail,
  loginWithFirebaseEmail,
  verifyAndActivateEmailAccount,
  resendVerificationEmailLink,
  sendFirebasePasswordReset,
  signInWithGooglePopup,
  completeGoogleOnboarding,
  logoutCurrentUser,
  FIREBASE_AUTH_PROVIDERS_CONSOLE_URL,
} from '../services/authService';
import { auth, reloadAndCheckEmailVerified } from '../services/firebase';
import {
  AlertCircle,
  CheckCircle2,
  Coins,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  MailCheck,
  Phone,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  User,
  UserPlus,
  X,
} from 'lucide-react';

export type AuthModalMode =
  | 'login'
  | 'signup'
  | 'forgot'
  | 'google_onboarding'
  | 'verify_email';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: AuthModalMode;
  initialPendingEmail?: string | null;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile, isNewRegistration?: boolean) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  initialPendingEmail = null,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [providerConsoleUrl, setProviderConsoleUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Sign Up Form State (Game Rules v2.2 Section 1)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCodeUsed, setReferralCodeUsed] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Email Verification State
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string>(
    initialPendingEmail || ''
  );
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Forgot Password State
  const [resetEmail, setResetEmail] = useState('');

  // Pending Google Onboarding State
  const [pendingGoogle, setPendingGoogle] = useState<{
    uid: string;
    email: string;
    firstName: string;
    lastName: string;
    suggestedUsername: string;
    avatarUrl: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setSuccessMessage(null);
      setProviderConsoleUrl(null);
      if (initialPendingEmail) {
        setPendingVerificationEmail(initialPendingEmail);
      } else if (auth.currentUser?.email && !auth.currentUser.emailVerified) {
        setPendingVerificationEmail(auth.currentUser.email);
      }
    }
  }, [isOpen, initialMode, initialPendingEmail]);

  // Cooldown timer for resending verification email
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-poll every 4 seconds while user is on the "verify_email" screen
  useEffect(() => {
    if (!isOpen || mode !== 'verify_email') return;

    let active = true;
    const interval = setInterval(async () => {
      if (!auth.currentUser || !active) return;
      try {
        const isNowVerified = await reloadAndCheckEmailVerified();
        if (isNowVerified && active) {
          const res = await verifyAndActivateEmailAccount();
          if (res.verified && res.user && active) {
            onAuthSuccess(res.user, true);
            onClose();
          }
        }
      } catch {
        // Ignore transient network errors during background polling
      }
    }, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isOpen, mode, onAuthSuccess, onClose]);

  if (!isOpen) return null;

  // Compute password strength (0 to 4)
  const getPasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: 'Enter password', color: 'bg-slate-800' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    if (score === 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-cyan-500' };
    return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
  };

  const pwdStrength = getPasswordStrength(password);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setProviderConsoleUrl(null);
    setIsLoading(true);

    try {
      const res = await loginWithFirebaseEmail(loginIdentifier, loginPassword);

      if (res.status === 'UNVERIFIED_EMAIL') {
        setPendingVerificationEmail(res.pendingEmail || loginIdentifier);
        setMode('verify_email');
        setSuccessMessage(
          'Your account exists, but your email address has not been verified yet. Please click the confirmation link in your email to unlock your 5 Free Tokens.'
        );
        return;
      }

      if (res.status === 'PROVIDER_NOT_ENABLED') {
        setProviderConsoleUrl(res.consoleUrl || FIREBASE_AUTH_PROVIDERS_CONSOLE_URL);
        setError(res.error || 'Email/Password sign-in must be enabled in Firebase Console.');
        return;
      }

      if (res.status !== 'SUCCESS' || !res.user) {
        setError(res.error || 'Login failed.');
        return;
      }

      onAuthSuccess(res.user, Boolean(res.isNewActivation));
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setProviderConsoleUrl(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    if (!agreeTerms) {
      setError('You must agree to the Game Rules v2.2 & Participant Terms to register.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerWithFirebaseEmail({
        firstName,
        lastName,
        username,
        email,
        phone,
        password,
        referralCodeUsed,
      });

      if (res.status === 'PROVIDER_NOT_ENABLED') {
        setProviderConsoleUrl(res.consoleUrl || FIREBASE_AUTH_PROVIDERS_CONSOLE_URL);
        setError(res.error || 'Email/Password provider is not enabled in Firebase Console.');
        return;
      }

      if (res.status !== 'VERIFICATION_EMAIL_SENT') {
        setError(res.error || 'Registration failed.');
        return;
      }

      setPendingVerificationEmail(res.pendingEmail || email.trim().toLowerCase());
      setResendCooldown(60);
      setMode('verify_email');
      setSuccessMessage(
        `A real verification link has been sent to ${res.pendingEmail || email}. Click the link in your email to verify your account and claim your 5 Free Welcome Tokens!`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualVerifyCheck = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      const res = await verifyAndActivateEmailAccount();
      if (!res.verified || !res.user) {
        setError(
          res.error ||
            'Email verification not detected yet. Please click the confirmation link in your email inbox first.'
        );
        return;
      }

      onAuthSuccess(res.user, true);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      const res = await resendVerificationEmailLink();
      if (!res.success) {
        setError(res.error || 'Failed to resend verification email.');
        return;
      }
      setResendCooldown(60);
      setSuccessMessage(
        `A fresh confirmation link has been sent to ${pendingVerificationEmail || 'your email'}. Please check your Inbox and Spam folder.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setProviderConsoleUrl(null);
    setIsLoading(true);
    try {
      const res = await signInWithGooglePopup();
      if (res.status === 'EXISTING_USER' && res.user) {
        onAuthSuccess(res.user, false);
        onClose();
      } else if (res.status === 'NEEDS_ONBOARDING' && res.pendingGoogleData) {
        setPendingGoogle(res.pendingGoogleData);
        setFirstName(res.pendingGoogleData.firstName);
        setLastName(res.pendingGoogleData.lastName);
        setUsername(res.pendingGoogleData.suggestedUsername);
        setEmail(res.pendingGoogleData.email);
        setPhone('+31 6 ');
        setMode('google_onboarding');
      } else if (res.status === 'ERROR') {
        setError(res.error || 'Google Sign-In could not be completed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteGoogleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogle) return;
    setError(null);
    setIsLoading(true);

    try {
      const res = await completeGoogleOnboarding({
        uid: pendingGoogle.uid,
        email: pendingGoogle.email,
        firstName,
        lastName,
        username,
        phone,
        referralCodeUsed,
        avatarUrl: pendingGoogle.avatarUrl,
      });

      if (!res.success || !res.user) {
        setError(res.error || 'Could not complete registration.');
        return;
      }

      onAuthSuccess(res.user, true);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setProviderConsoleUrl(null);
    setIsLoading(true);

    try {
      const res = await sendFirebasePasswordReset(resetEmail);
      if (!res.success) {
        if (res.consoleUrl) {
          setProviderConsoleUrl(res.consoleUrl);
        }
        setError(res.error || 'Password reset email could not be sent.');
        return;
      }

      setSuccessMessage(
        `A password reset link has been sent to ${resetEmail.trim()}. Check your inbox to set a new password.`
      );
      setLoginIdentifier(resetEmail.trim());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0e1626] border border-slate-700/90 rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Brand & Mode Switcher */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-cyan-500/20">
            ₿
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              {mode === 'login' && 'Sign In to ApexPredict'}
              {mode === 'signup' && 'Create Official Participant Account'}
              {mode === 'verify_email' && 'Verify Your Email Address'}
              {mode === 'forgot' && 'Reset Your Account Password'}
              {mode === 'google_onboarding' && 'Complete Participant Registration'}
            </h2>
            <p className="text-xs text-slate-400">
              {mode === 'login' && 'Access your prediction tokens, daily streak, and round history'}
              {mode === 'signup' && 'Game Rules v2.2 Section 1 · 5 Free Tokens after Email Verification'}
              {mode === 'verify_email' && 'Confirm your email link to unlock 5 Free Tokens & predicting'}
              {mode === 'forgot' && 'Receive an official Firebase password reset link via email'}
              {mode === 'google_onboarding' && 'Choose your public Display Name & verify phone for 5 Free Tokens'}
            </p>
          </div>
        </div>

        {/* Mode Tabs for Login / Sign Up */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMessage(null);
                setProviderConsoleUrl(null);
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setSuccessMessage(null);
                setProviderConsoleUrl(null);
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'signup'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account (+5 Tokens)</span>
            </button>
          </div>
        )}

        {/* Error / Success Alerts */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Firebase Console Setup Walkthrough when Email/Password Provider is not yet enabled */}
        {providerConsoleUrl && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>One-Time Firebase Setup Required (Email/Password Provider)</span>
            </div>
            <p className="text-[11px] text-amber-100/90 leading-relaxed">
              Automated Firebase provisioning enables Google Sign-In by default. To allow users to register with an email address and receive real confirmation links:
            </p>
            <ol className="list-decimal list-inside text-[11px] text-slate-200 space-y-1 font-medium">
              <li>Open your Firebase Authentication Sign-in providers page below.</li>
              <li>Click <strong>Add new provider</strong> (or select <strong>Email/Password</strong>).</li>
              <li>Toggle <strong>Enable</strong> on and click <strong>Save</strong>, then click Submit again here.</li>
            </ol>
            <a
              href={providerConsoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] transition-colors"
            >
              <span>Open Firebase Auth Providers Console</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODE 1: LOG IN */}
        {/* ================================================================ */}
        {mode === 'login' && (
          <div className="space-y-4">
            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-2.5 shadow transition-all cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>{isLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[11px] text-slate-500 uppercase font-mono">
                or sign in with verified email
              </span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Email Address or Public Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. you@example.com or ArefS"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 focus:outline-none text-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 focus:outline-none text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500"
                  />
                  <span>Keep me signed in on this device</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-60 text-slate-950 font-extrabold text-xs tracking-wide shadow-lg shadow-cyan-500/20 cursor-pointer transition-all"
              >
                {isLoading ? 'Verifying Credentials...' : 'Sign In to Account'}
              </button>
            </form>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODE 2: CREATE ACCOUNT (SIGN UP WITH EMAIL VERIFICATION) */}
        {/* ================================================================ */}
        {mode === 'signup' && (
          <div className="space-y-4">
            {/* Section 3 Welcome Reward Banner */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Coins className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-amber-300">
                    Welcome Reward: 5 Free Prediction Tokens
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Sent via confirmation link to your email & unlocked upon verification (Section 3)
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-2.5 shadow transition-all cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Fast Sign Up with Google (Instant Verified Email)</span>
            </button>

            <div className="relative flex py-0.5 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase font-mono">
                or register with email confirmation link
              </span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <form onSubmit={handleSignUpSubmit} className="space-y-3 text-xs">
              {/* First & Last Name (Private per Section 1) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    First Name <span className="text-[10px] text-emerald-400 font-normal">(Private)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Aref"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 focus:outline-none text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Last Name <span className="text-[10px] text-emerald-400 font-normal">(Private)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Soleimani"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 focus:outline-none text-white"
                  />
                </div>
              </div>

              {/* Public Username / Display Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">
                    Public Display Name / Username
                  </label>
                  <span className="text-[10px] text-cyan-400 font-mono">Shown on Leaderboards & Chat</span>
                </div>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. CryptoEagle_NL"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 focus:outline-none text-white font-mono"
                  />
                </div>
              </div>

              {/* Email & Phone Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 focus:outline-none text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+31 6 12345678"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 focus:outline-none text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 focus:outline-none text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 focus:outline-none text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Password Strength Meter */}
              {password.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3, 4].map((idx) => (
                      <div
                        key={idx}
                        className={`flex-1 rounded-full transition-colors ${
                          idx <= pwdStrength.score ? pwdStrength.color : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Password security</span>
                    <span className="font-mono font-semibold text-slate-300">{pwdStrength.label}</span>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400">Referral rewards are not active yet.</p>

              {/* Privacy & Terms Checkbox */}
              <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-1.5">
                <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500"
                  />
                  <span className="text-[11px] leading-relaxed">
                    I agree to the <strong>Game Rules v2.2</strong>. I understand a confirmation link will be sent to my email address and must be verified before my 5 Free Welcome Tokens are granted.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-60 text-slate-950 font-extrabold text-xs tracking-wide shadow-lg shadow-emerald-500/20 cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                <span>
                  {isLoading
                    ? 'Creating Account & Sending Verification Link...'
                    : 'Register & Send Email Confirmation Link'}
                </span>
              </button>
            </form>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODE 3: VERIFY EMAIL INTERSTITIAL (Pending Confirmation Link) */}
        {/* ================================================================ */}
        {mode === 'verify_email' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <MailCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">
                    Confirmation Link Sent to Your Inbox
                  </div>
                  <div className="text-xs font-mono text-cyan-300 break-all">
                    {pendingVerificationEmail || auth.currentUser?.email || 'your email address'}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-[11px] leading-relaxed">
                <strong className="text-amber-300 block mb-0.5">
                  Action Required Before Predicting (Game Rules v2.2 Section 2 & 3):
                </strong>
                We have sent an official verification link via Firebase Auth to your email address. Your <strong>5 Free Welcome Tokens</strong> and prediction access remain locked (0 Tokens) until you click that confirmation link.
              </div>

              <ul className="text-[11px] text-slate-400 space-y-1.5 pl-4 list-disc">
                <li>Open the email from <strong>noreply@even-phenomenon-t1ttq.firebaseapp.com</strong> and click the verification link.</li>
                <li>If you don't see it within 30 seconds, check your <strong>Spam</strong> or <strong>Promotions</strong> folder.</li>
                <li>This screen automatically checks every 4 seconds, or you can click the button below as soon as you've verified.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleManualVerifyCheck}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-60 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isLoading
                  ? 'Checking Verification Status...'
                  : "I've Clicked the Link — Verify & Claim 5 Free Tokens"}
              </span>
            </button>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isLoading || resendCooldown > 0}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {resendCooldown > 0
                    ? `Resend Link (${resendCooldown}s)`
                    : 'Resend Confirmation Email'}
                </span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await logoutCurrentUser();
                  setError(null);
                  setSuccessMessage(null);
                  setMode('signup');
                }}
                className="py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-300 font-semibold text-xs cursor-pointer transition-colors"
              >
                Change Email
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODE 4: GOOGLE ONBOARDING (Complete Section 1 Fields) */}
        {/* ================================================================ */}
        {mode === 'google_onboarding' && pendingGoogle && (
          <form onSubmit={handleCompleteGoogleOnboarding} className="space-y-3.5 text-xs">
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/50 text-cyan-200 text-[11px] leading-relaxed">
              Authenticated with Google as <strong>{pendingGoogle.email}</strong> (Verified Email). Please confirm your private legal name, phone number, and public Display Name to receive your <strong>5 Free Welcome Tokens</strong>.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  First Name <span className="text-[10px] text-emerald-400">(Private)</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Last Name <span className="text-[10px] text-emerald-400">(Private)</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Public Display Name / Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Phone Number (Required by Section 1)
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+31 6 12345678"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold text-xs cursor-pointer"
            >
              {isLoading ? 'Saving Profile...' : 'Finish Setup & Claim 5 Free Tokens'}
            </button>
          </form>
        )}

        {/* ================================================================ */}
        {/* MODE 5: FORGOT / RESET PASSWORD VIA FIREBASE EMAIL */}
        {/* ================================================================ */}
        {mode === 'forgot' && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-[11px] leading-relaxed">
              Enter your registered email address below. Firebase Authentication will send a real password reset link directly to your inbox.
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Registered Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Back to Login
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold cursor-pointer"
              >
                {isLoading ? 'Sending Link...' : 'Send Password Reset Email'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
