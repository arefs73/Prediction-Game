import React, { useState } from 'react';
import { UserProfile } from '../types/game';
import { CheckCircle2, Coins, Copy, Flame, Lock, ShieldCheck, Sparkles, User, Users, X } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onClaimDailyTokens: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  onClaimDailyTokens,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'streak' | 'referrals' | 'kyc'>('profile');
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [kycDoc, setKycDoc] = useState('Passport / National ID');
  const [kycSuccess, setKycSuccess] = useState(false);

  if (!isOpen) return null;

  const referralLink = `https://apexpredict.io/ref/${user.referralCode}`;

  const copyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 3000);
  };

  const handleKycSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      kycStatus: 'VERIFIED',
      kycDocumentType: kycDoc,
    });
    setKycSuccess(true);
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

        {/* User Card Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
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
              Real identity protected (Section 1) · Public Display Name active
            </p>
          </div>
        </div>

        {/* Modal Navigation */}
        <div className="mt-4 flex border-b border-slate-800 text-xs font-semibold gap-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'text-cyan-400 border-b-2 border-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Account & Tokens
          </button>
          <button
            onClick={() => setActiveTab('streak')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'streak'
                ? 'text-rose-400 border-b-2 border-rose-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Daily Streak (Day {user.streakDay}/7)
          </button>
          <button
            onClick={() => setActiveTab('referrals')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'referrals'
                ? 'text-amber-400 border-b-2 border-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Referrals (5 Tokens)
          </button>
          <button
            onClick={() => setActiveTab('kyc')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'kyc'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cash Prize KYC ({user.kycStatus})
          </button>
        </div>

        <div className="mt-4">
          {/* TAB 1: Profile & Tokens */}
          {activeTab === 'profile' && (
            <div className="space-y-4 text-xs">
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

              {/* Private Fields Information per Section 1 */}
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-300 font-semibold pb-2 border-b border-slate-800/80">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    Confidential Participant Identity (Section 1)
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">Private to System</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-400 text-[11px]">
                  <div>First Name: <strong className="text-white">{user.firstName}</strong></div>
                  <div>Last Name: <strong className="text-white">{user.lastName}</strong></div>
                  <div>Email: <strong className="text-white">{user.email}</strong></div>
                  <div>Phone: <strong className="text-white">{user.phone}</strong></div>
                </div>
                <p className="text-[10px] text-slate-500 pt-1">
                  Your first and last name remain strictly private. Only your Display Name (<strong>{user.username}</strong>) is shown on leaderboards and chat.
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
            </div>
          )}

          {/* TAB 2: Daily Streak (Section 21 & 22) */}
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

                {/* 7 Day visual track */}
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

              {/* Section 22 Weekly Reset Rule */}
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

          {/* TAB 3: Referrals (Section 23 & 24) */}
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

          {/* TAB 4: Prize Claim KYC (Section 1) */}
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
                    <span>Identity verified for cash prize disbursement. Payout destination active.</span>
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
                        defaultValue="NL91 ABNA 0417 1643 00"
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
      </div>
    </div>
  );
};
