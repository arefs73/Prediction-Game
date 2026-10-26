import React from 'react';
import { PredictionEntry } from '../types/game';
import { AmsterdamClockDetails, formatUSD } from '../utils/amsterdamTime';
import { Eye, EyeOff, ShieldCheck, Users } from 'lucide-react';

interface SubmissionsListProps {
  submissions: PredictionEntry[];
  clock: AmsterdamClockDetails;
  currentUserId: string;
}

export const SubmissionsList: React.FC<SubmissionsListProps> = ({
  submissions,
  clock,
  currentUserId,
}) => {
  // If phase is OPEN or PRE_OPEN (before 20:00 Amsterdam time), prediction amounts are hidden ($•••••.••)
  // After 20:00 (LOCKED_LIVE or ANNOUNCED), exact predictions become visible (Section 9)
  const isPost2000 = clock.phase === 'LOCKED_LIVE' || clock.phase === 'ANNOUNCED';

  // Helper to format submission time relative/time
  const formatSubmitTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-US', {
        timeZone: 'Europe/Amsterdam',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' CEST';
    } catch {
      return 'Today';
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800/80 p-5 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-slate-200 tracking-wide">
            Box for showing people who submited their predictions
          </h2>
          <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full tabular-nums">
            {submissions.length} Total
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {isPost2000 ? (
            <span className="flex items-center gap-1 text-emerald-400 font-medium bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
              <Eye className="w-3.5 h-3.5" />
              <span>Visible (Post 20:00:00)</span>
            </span>
          ) : (
            <span
              className="flex items-center gap-1 text-amber-300 font-medium bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded"
              title="Predictions hidden until 20:00 to prevent herd copying"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Hidden until 20:00 (Anti-Herd)</span>
            </span>
          )}
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-500">
          No predictions submitted yet for this round. Be the first to predict!
        </div>
      ) : (
        <div className="divide-y divide-slate-800/70 max-h-[360px] overflow-y-auto pr-1">
          {submissions.map((sub) => {
            const isMe = sub.userId === currentUserId;
            // The user always can see their own prediction, or everyone after 20:00
            const canSeeExactValue = isMe || isPost2000;

            return (
              <div
                key={sub.id}
                className={`py-3 flex items-center justify-between gap-3 px-2 rounded-lg transition-colors ${
                  isMe ? 'bg-cyan-950/30 border border-cyan-800/30' : 'hover:bg-slate-800/30'
                }`}
              >
                {/* Left: Avatar & Username */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0 ring-1 ring-slate-700">
                    {sub.avatarUrl ? (
                      <img
                        src={sub.avatarUrl}
                        alt={sub.username}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to initial
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      sub.username.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <span>{sub.username}</span>
                      {isMe && (
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800/60">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {formatSubmitTime(sub.submittedAt)}
                    </div>
                  </div>
                </div>

                {/* Right: Predicted value (Blurred or Visible) */}
                <div className="text-right">
                  {canSeeExactValue ? (
                    <div>
                      <div className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                        Predicted {formatUSD(sub.predictedPrice)}
                      </div>
                      {isPost2000 && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          Tie-break: #{sub.id.slice(-3)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="font-mono text-xs font-bold text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800 tracking-wider select-none"
                      title="Hidden until 20:00:00 Europe/Amsterdam per Section 8"
                    >
                      $•••••.••
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer rule explanation note */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1 text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          Game Rules v2.2 Section 8 & 9
        </span>
        <span>Values unmask automatically at 20:00:00</span>
      </div>
    </div>
  );
};
