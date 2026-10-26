import React, { useState } from 'react';
import { PreviousWinner } from '../types/game';
import { formatUSD } from '../utils/amsterdamTime';
import { Award, ChevronRight, Gift, HelpCircle, Trophy } from 'lucide-react';

interface PreviousWinnersProps {
  winners: PreviousWinner[];
  totalPoolCash: number;
}

export const PreviousWinners: React.FC<PreviousWinnersProps> = ({
  winners,
  totalPoolCash,
}) => {
  const [showPrizeTable, setShowPrizeTable] = useState(false);

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800/80 p-5 shadow-xl backdrop-blur-sm flex flex-col justify-between h-full">
      <div>
        {/* Title matching wireframe: "Previous winners" */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-slate-200 tracking-wide">
              Previous winners
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500">Yesterday</span>
        </div>

        {/* Winners List formatted like the wireframe: "1st: Alice - $10k" */}
        <div className="space-y-2.5">
          {winners.map((winner) => {
            let rankColor = 'text-slate-300';
            let badgeBg = 'bg-slate-800 text-slate-300';

            if (winner.rank === 1) {
              rankColor = 'text-amber-300 font-bold';
              badgeBg = 'bg-amber-500/20 text-amber-300 border border-amber-500/40';
            } else if (winner.rank === 2) {
              rankColor = 'text-slate-200 font-bold';
              badgeBg = 'bg-slate-300/20 text-slate-200 border border-slate-300/40';
            } else if (winner.rank === 3) {
              rankColor = 'text-amber-600 font-bold';
              badgeBg = 'bg-amber-700/20 text-amber-500 border border-amber-600/40';
            }

            return (
              <div
                key={winner.rank}
                className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 flex items-center justify-between hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${badgeBg}`}>
                    {winner.rank === 1 && '1st'}
                    {winner.rank === 2 && '2nd'}
                    {winner.rank === 3 && '3rd'}
                    {winner.rank > 3 && `${winner.rank}th`}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block truncate max-w-[90px] sm:max-w-[110px]">
                      {winner.username}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Err: ±${winner.error.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-xs font-mono font-bold ${rankColor} tabular-nums`}>
                    {formatUSD(winner.prizeAmount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Cash Prize Pool & Structure (Section 19 & 20) */}
      <div className="mt-6 pt-4 border-t border-slate-800/80">
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-950 border border-amber-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              Today's Cash Pool
            </span>
            <span className="text-sm font-mono font-extrabold text-amber-400 tabular-nums">
              {formatUSD(totalPoolCash)}
            </span>
          </div>

          <div className="text-[11px] text-slate-400 leading-tight">
            Top 100 Rewarded: <strong className="text-slate-200">Ranks #1–#30</strong> receive cash prizes; <strong className="text-slate-200">#31–#100</strong> receive non-cash rewards.
          </div>

          <button
            type="button"
            onClick={() => setShowPrizeTable(!showPrizeTable)}
            className="w-full mt-1 pt-1.5 border-t border-slate-800 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center justify-between cursor-pointer"
          >
            <span>{showPrizeTable ? 'Hide' : 'View'} Tiered Distribution Matrix</span>
            <ChevronRight className={`w-3 h-3 transition-transform ${showPrizeTable ? 'rotate-90' : ''}`} />
          </button>

          {showPrizeTable && (
            <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] font-mono space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span>Rank #1 (40%):</span>
                <span className="font-bold text-amber-400">{formatUSD(totalPoolCash * 0.40)}</span>
              </div>
              <div className="flex justify-between">
                <span>Rank #2 (20%):</span>
                <span className="font-bold text-slate-200">{formatUSD(totalPoolCash * 0.20)}</span>
              </div>
              <div className="flex justify-between">
                <span>Rank #3 (10%):</span>
                <span className="font-bold text-amber-500">{formatUSD(totalPoolCash * 0.10)}</span>
              </div>
              <div className="flex justify-between">
                <span>Ranks #4–#10 (15% pool):</span>
                <span className="text-emerald-400">{formatUSD((totalPoolCash * 0.15) / 7)} each</span>
              </div>
              <div className="flex justify-between">
                <span>Ranks #11–#30 (15% pool):</span>
                <span className="text-emerald-400">{formatUSD((totalPoolCash * 0.15) / 20)} each</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800/60 text-slate-400">
                <span>Ranks #31–#100:</span>
                <span className="text-cyan-400">Pro Subscriptions & VIP Passes</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
