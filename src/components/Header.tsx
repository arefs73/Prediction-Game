import React from 'react';
import { UserProfile } from '../types/game';
import { AmsterdamClockDetails } from '../utils/amsterdamTime';
import { Coins, Flame, ShieldCheck, User } from 'lucide-react';

interface HeaderProps {
  clock: AmsterdamClockDetails;
  user: UserProfile;
  onOpenProfile: () => void;
  onOpenRules: () => void;
  onOpenStudio: () => void;
  onOpenResults: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  clock,
  user,
  onOpenProfile,
  onOpenRules,
  onOpenStudio,
  onOpenResults,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-[#0b0f19]/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <span className="font-mono font-black text-slate-950 text-lg">₿</span>
          </div>
          <div>
            <div className="font-bold text-base text-slate-100 tracking-tight leading-none whitespace-nowrap">
              ApexPredict
            </div>
            <div className="text-[10px] font-mono text-cyan-400 font-medium tracking-wider">
              BTC DAILY · 20:00 CEST
            </div>
          </div>
        </div>


        {/* Zone 3: Time Clock + User Profile & Tokens */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Europe/Amsterdam Clock Indicator */}
          <div className="hidden lg:flex flex-col items-end pr-2 border-r border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Amsterdam</span>
              <span className="font-mono font-semibold text-xs text-cyan-300 tabular-nums">
                {clock.timeString}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 tabular-nums">
              {clock.phase === 'OPEN' && `Locks in ${Math.floor(clock.secondsUntilNextMilestone / 3600)}h ${Math.floor((clock.secondsUntilNextMilestone % 3600) / 60)}m`}
              {clock.phase === 'LOCKED_LIVE' && `Results in ${Math.floor(clock.secondsUntilNextMilestone / 60)}m`}
              {clock.phase === 'ANNOUNCED' && `Round Settled`}
              {clock.phase === 'PRE_OPEN' && `Opens at 12:00`}
            </div>
          </div>

          {/* Tokens & Streak Pills */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg p-1">
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 text-xs font-semibold"
              title="Available Prediction Tokens (1 Token = 1 Prediction)"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono tabular-nums">{user.tokenBalance}</span>
              <span className="text-[10px] text-amber-400/80 hidden sm:inline">Tokens</span>
            </div>

            <div
              className="flex items-center gap-1 px-2 py-1 rounded bg-rose-500/10 text-rose-300 text-xs font-semibold"
              title={`Daily Streak: Day ${user.streakDay} of 7`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-mono tabular-nums">Day {user.streakDay}</span>
            </div>
          </div>

          {/* User Profile Pill button */}
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-bold text-xs ring-1 ring-cyan-400/30">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">
                {user.username}
              </div>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
