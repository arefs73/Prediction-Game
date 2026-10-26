import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types/game';
import { changeAccountPassword, deleteCurrentUserAccount } from '../services/authService';
import { auth } from '../services/firebase';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Coins,
  Copy,
  Edit3,
  Flame,
  KeyRound,
  Lock,
  LogOut,
  Save,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onClaimDailyTokens: () => void;
  onLogout: () => void;
  onAccountDeleted: (deletedUsername: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  onClaimDailyTokens,
  onLogout,
  onAccountDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'streak' | 'referrals' | 'kyc'>('profile');
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [kycDoc, setKycDoc] = useState(user.kycDocumentType || 'EU Passport');
  const [walletAddr, setWalletAddr] = useState(user.walletAddress || 'NL91 ABNA 0417 1643 00');

  // Edit profile state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState(user.username);
  const [editFirstName, setEditFirstName] = useState(user.firstName);
  const [editLastName, setEditLastName] = useState(user.lastName);
  const [editPhone, setEditPhone] = useState(user.phone);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwdFeedback, setPwdFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delete Account Verification Modal state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setEditUsername(user.username);
    setEditFirstName(user.firstName);
    setEditLastName(user.lastName);
    setEditPhone(user.phone);
  }, [user]);

  useEffect(() => {
    if (!isOpen) {
      setIsDeleteConfirmOpen(false);
      setDeleteConfirmText('');
      setDeletePassword('');
      setDeleteError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isGoogleOnlyUser =
    auth.currentUser &&
    auth.currentUser.uid === user.id &&
    auth.currentUser.providerData.some((p) => p.providerId === 'google.com') &&
    !auth.currentUser.providerData.some((p) => p.providerId === 'password');

  const referralLink = `https://apexpredict.io/ref/${user.referralCode}`;

  const copyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 3000);
  };

  const handleSaveProfileEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileFeedback(null);

    const cleanUser = editUsername.trim();
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(cleanUser)) {
      setProfileFeedback({
        type: 'error',
        text: 'Public Display Name must be 3–30 characters (letters, numbers, underscores, hyphens).',
      });
      return;
    }

    onUpdateUser({
      username: cleanUser,
      firstName: editFirstName.trim() || user.firstName,
      lastName: editLastName.trim() || user.lastName,
      phone: editPhone.trim() || user.phone,
    });

    setIsEditingProfile(false);
    setProfileFeedback({ type: 'success', text: 'Account profile details saved.' });
    setTimeout(() => setProfileFeedback(null), 4000);
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdFeedback(null);

    if (newPassword !== confirmNewPassword) {
      setPwdFeedback({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    const res = await changeAccountPassword(user.id, currentPassword, newPassword);
    if (!res.success) {
      setPwdFeedback({ type: 'error', text: res.error || 'Could not update password.' });
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPwdFeedback({ type: 'success', text: 'Your password has been updated.' });
  };

  const handleKycSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      kycStatus: 'VERIFIED',
      kycDocumentType: kycDoc,
      walletAddress: walletAddr,
    });
  };

  const openDeleteVerificationDialog = () => {
    setDeleteConfirmText('');
    setDeletePassword('');
    setDeleteError(null);
    setIsDeleteConfirmOpen(true);
  };

  const handleVerifiedDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    setIsDeleting(true);

    try {
      const res = await deleteCurrentUserAccount({
        user,
        confirmationText: deleteConfirmText,
        password: deletePassword,
      });

      if (!res.success) {
        setDeleteError(res.error || 'Account deletion failed. Please verify your details.');
        return;
      }

      const deletedName = user.username;
      setIsDeleteConfirmOpen(false);
      onClose();
      onAccountDeleted(deletedName);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0e1626] border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* User Card Header (shown immediately when clicking user's name) */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800 pr-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-cyan-500/20">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{user.username}</h2>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/70 border border-cyan-800/60 px-2 py-0.5 rounded font-semibold">
                  Official Participant
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {user.email} · Real identity protected (Section 1)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Modal Navigation */}
        <div className="mt-4 flex flex-wrap border-b border-slate-800 text-xs font-semibold gap-5">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'text-cyan-400 border-b-2 border-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Account & Profile
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'security'
                ? 'text-cyan-400 border-b-2 border-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Password & Security
          </button>
          <button
            onClick={() => setActiveTab('streak')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'streak'
                ? 'text-rose-400 border-b-2 border-rose-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Daily Streak ({user.streakDay}/7)
          </button>
          <button
            onClick={() => setActiveTab('referrals')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'referrals'
                ? 'text-amber-400 border-b-2 border-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Referrals (+5 Tokens)
          </button>
          <button
            onClick={() => setActiveTab('kyc')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'kyc'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Prize Claim KYC ({user.kycStatus})
          </button>
        </div>

        <div className="mt-4">
          {/* TAB 1: Profile & Tokens */}
          {activeTab === 'profile' && (
            <div className="space-y-4 text-xs">
              {profileFeedback && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 ${
                    profileFeedback.type === 'success'
                      ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/50 border-rose-800 text-rose-300'
                  }`}
                >
                  {profileFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{profileFeedback.text}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block mb-1">Available Tokens</span>
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-400" />
                    <span className="text-xl font-mono font-bold text-white tabular-nums">
                      {user.tokenBalance}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    1 Token = 1 Submitted Prediction
                  </span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block mb-1">Current Gaming Cycle</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-mono font-bold text-cyan-400">
                      Week {user.gamingCycleWeek}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Unused tokens reset every 7 days (Sec. 22)
                  </span>
                </div>
              </div>

              {/* Private Fields Information & Edit Form per Section 1 */}
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-slate-300 font-semibold pb-2 border-b border-slate-800/80">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    Participant Identity & Display Name (Section 1)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isEditingProfile ? 'Cancel Edit' : 'Edit Profile'}</span>
                  </button>
                </div>

                {!isEditingProfile ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-slate-400 text-[11px]">
                    <div>
                      Public Display Name:{' '}
                      <strong className="text-cyan-300 font-mono">{user.username}</strong>
                    </div>
                    <div>
                      Email Address: <strong className="text-white">{user.email}</strong>
                    </div>
                    <div>
                      First Name (Private): <strong className="text-white">{user.firstName}</strong>
                    </div>
                    <div>
                      Last Name (Private): <strong className="text-white">{user.lastName}</strong>
                    </div>
                    <div>
                      Phone Number (Private):{' '}
                      <strong className="text-white font-mono">{user.phone}</strong>
                    </div>
                    <div>
                      Participant UID:{' '}
                      <strong className="text-slate-300 font-mono">{user.id.slice(0, 14)}</strong>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveProfileEdit} className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 text-[11px] mb-1">
                          Public Display Name / Username
                        </label>
                        <input
                          type="text"
                          required
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[11px] mb-1">
                          Phone Number (Private)
                        </label>
                        <input
                          type="tel"
                          required
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[11px] mb-1">
                          Legal First Name (Private)
                        </label>
                        <input
                          type="text"
                          required
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[11px] mb-1">
                          Legal Last Name (Private)
                        </label>
                        <input
                          type="text"
                          required
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Profile Changes</span>
                      </button>
                    </div>
                  </form>
                )}

                <p className="text-[10px] text-slate-500 pt-1">
                  Your legal first and last name remain strictly private in the system. Only your Display Name (<strong>{user.username}</strong>) is shown publicly on leaderboards and chat.
                </p>
              </div>

              {/* Daily Token Claim Button */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-950 to-slate-950 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <div className="font-bold text-amber-300">Daily Base Reward (Section 4)</div>
                  <div className="text-[11px] text-slate-400">+2 Free Tokens credited every 24 hours</div>
                </div>
                <button
                  onClick={onClaimDailyTokens}
                  disabled={user.streakClaimedToday}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs cursor-pointer disabled:cursor-not-allowed transition-all"
                >
                  {user.streakClaimedToday ? 'Claimed Today' : 'Claim +2 Tokens'}
                </button>
              </div>

              {/* Danger Zone: Delete Account */}
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-rose-300 flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Delete Participant Account</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Permanently remove your profile, personal data, and remaining token balance. Verification required.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openDeleteVerificationDialog}
                  className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/50 text-rose-200 font-bold text-xs cursor-pointer transition-colors whitespace-nowrap"
                >
                  Delete Account...
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Password & Security */}
          {activeTab === 'security' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-cyan-400" />
                  <span>Change Account Password</span>
                </div>

                {pwdFeedback && (
                  <div
                    className={`p-3 rounded-xl border flex items-center gap-2 ${
                      pwdFeedback.type === 'success'
                        ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/50 border-rose-800 text-rose-300'
                    }`}
                  >
                    {pwdFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{pwdFeedback.text}</span>
                  </div>
                )}

                <form onSubmit={handlePasswordChangeSubmit} className="space-y-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Current Password</label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">New Password</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        required
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Update Password
                  </button>
                </form>
              </div>

              {/* Danger Zone in Security Tab */}
              <div className="p-4 bg-rose-950/30 rounded-xl border border-rose-800/50 space-y-2.5">
                <div className="font-bold text-rose-300 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Danger Zone — Permanent Account Deletion</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Deleting your account permanently removes your private profile, public display name, and remaining prediction tokens ({user.tokenBalance} Tokens). You will be asked to verify your identity before deletion completes.
                </p>
                <button
                  type="button"
                  onClick={openDeleteVerificationDialog}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  Delete My Account
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Daily Streak (Section 21 & 22) */}
          {activeTab === 'streak' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-rose-400" />
                    7-Day Retention Streak Cycle (Section 21)
                  </span>
                  <span className="font-mono text-rose-400 font-bold">
                    Active: Day {user.streakDay}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Submit at least one valid prediction during the day to preserve your streak. Day 1 gives 1 bonus token, scaling up to 7 bonus tokens on Day 7!
                </p>

                <div className="grid grid-cols-7 gap-1.5 pt-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                    const isCompleted = day < user.streakDay;
                    const isCurrent = day === user.streakDay;

                    return (
                      <div
                        key={day}
                        className={`p-2 rounded-xl text-center border font-mono transition-all ${
                          isCompleted
                            ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                            : isCurrent
                            ? 'bg-rose-950/60 border-rose-500 text-rose-200 ring-1 ring-rose-500'
                            : 'bg-slate-900 border-slate-800 text-slate-500'
                        }`}
                      >
                        <div className="text-[10px] uppercase">Day {day}</div>
                        <div className="text-xs font-bold mt-1">+{day}</div>
                        <div className="text-[9px] opacity-75">Tkn</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-200">
                  Weekly Token Reset Rule (Section 22)
                </div>
                <p>
                  Unused tokens may be saved during the current 7-day gaming cycle. At the start of the next weekly cycle, all unused tokens from the previous cycle reset/expire to prevent unlimited long-term accumulation.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: Referrals (Section 23 & 24) */}
          {activeTab === 'referrals' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-400" />
                    Referral Program (Section 23)
                  </span>
                  <span className="font-mono text-amber-400 font-bold">
                    {user.referralCount} Verified Referrals
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Earn <strong>5 Bonus Tokens</strong> for each invited trader. The referred person must complete account creation and submit at least one valid prediction (Section 23 & 24 anti-abuse rule).
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={referralLink}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                  <button
                    onClick={copyReferral}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedReferral ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400">
                <strong className="text-slate-300 block mb-1">Referral Fraud Protections (Section 24)</strong>
                Unique verified email/phone checks, IP abuse monitoring, and mandatory participation prevent multi-accounting.
              </div>
            </div>
          )}

          {/* TAB 5: Prize Claim KYC (Section 1) */}
          {activeTab === 'kyc' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Prize Claim Verification / KYC (Section 1)
                  </span>
                  <span
                    className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                      user.kycStatus === 'VERIFIED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {user.kycStatus}
                  </span>
                </div>

                <p className="text-slate-400 text-[11px] leading-relaxed">
                  "Participation in the game does not require identity verification by default. Before receiving or withdrawing a cash prize (Ranks #1–#30), a user may be required to complete identity verification/KYC, subject to applicable law, payment-provider requirements, prize value and fraud controls."
                </p>

                {user.kycStatus === 'VERIFIED' ? (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Identity verified ({user.kycDocumentType || 'EU ID'}). Payout destination ({user.walletAddress || walletAddr}) active.</span>
                  </div>
                ) : (
                  <form onSubmit={handleKycSubmit} className="space-y-3 pt-2">
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">
                        Identification Document
                      </label>
                      <select
                        value={kycDoc}
                        onChange={(e) => setKycDoc(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                      >
                        <option value="EU Passport">EU Passport</option>
                        <option value="Dutch National ID Card">Dutch National ID Card</option>
                        <option value="Driver's License">Driver's License</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">
                        Payout Wallet / IBAN
                      </label>
                      <input
                        type="text"
                        value={walletAddr}
                        onChange={(e) => setWalletAddr(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-white"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer transition-colors shadow-lg shadow-emerald-500/20"
                    >
                      Complete KYC Identity Verification
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* ================================================================ */}
        {/* ACCOUNT DELETION VERIFICATION DIALOG */}
        {/* ================================================================ */}
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#111827] border border-rose-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Verify Permanent Account Deletion
                  </h3>
                  <p className="text-xs text-rose-300">
                    This action is irreversible and cannot be undone
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}

              <form onSubmit={handleVerifiedDeleteAccount} className="space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 space-y-1.5 text-[11px] leading-relaxed">
                  <p>
                    You are about to permanently delete participant account{' '}
                    <strong className="text-white font-mono">{user.username}</strong> ({user.email}).
                  </p>
                  <ul className="list-disc pl-4 text-slate-400 space-y-1">
                    <li>
                      Your private identity record, public profile, and{' '}
                      <strong className="text-amber-300">{user.tokenBalance} Tokens</strong> will be permanently erased.
                    </li>
                    <li>
                      Per Game Rules v2.2 Section 6, any predictions already locked into the active round ledger remain immutable.
                    </li>
                  </ul>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Step 1: Type <span className="font-mono text-rose-300 font-bold">{user.username}</span> or{' '}
                    <span className="font-mono text-rose-300 font-bold">DELETE</span> to verify
                  </label>
                  <input
                    type="text"
                    required
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={`Type "${user.username}" or "DELETE"`}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-rose-500 focus:outline-none text-white font-mono"
                  />
                </div>

                {!isGoogleOnlyUser ? (
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">
                      Step 2: Enter your current password to verify ownership
                    </label>
                    <input
                      type="password"
                      required
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder={
                        user.username === 'ArefS'
                          ? 'Enter password (Demo: Demo@2026)'
                          : 'Enter your account password'
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-rose-500 focus:outline-none text-white"
                    />
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                    Step 2: Because you signed in with Google, clicking the button below will ask Google to verify your session before deleting your account.
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(false)}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeleting || !deleteConfirmText.trim()}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-extrabold shadow-lg shadow-rose-600/25 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {isDeleting ? 'Verifying & Deleting...' : 'Verify & Delete Account'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
