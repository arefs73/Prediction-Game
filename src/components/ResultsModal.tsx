import React, { useState } from 'react';
import { RankedPrediction } from '../services/rankingAndPrizes';
import { UserProfile } from '../types/game';
import { AmsterdamClockDetails, formatUSD } from '../utils/amsterdamTime';
import { Award, CheckCircle2, ChevronRight, Copy, ExternalLink, FileText, Hash, ShieldCheck, Trophy, X } from 'lucide-react';

interface ResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clock: AmsterdamClockDetails;
  officialSettlementPrice: number | null;
  published?: boolean;
  auditHash?: string;
  roundId?: string;
  rankedPredictions: RankedPrediction[];
  currentUser: UserProfile | null;
  totalCashPool: number;
  onStartKycClaim: () => void;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  isOpen,
  onClose,
  clock,
  officialSettlementPrice,
  rankedPredictions,
  currentUser,
  totalCashPool,
  onStartKycClaim,
  published = false, auditHash, roundId,
}) => {
  const [activeTab, setActiveTab] = useState<'myResult' | 'leaderboard' | 'audit'>('myResult');
  const [copiedHash, setCopiedHash] = useState(false);

  if (!isOpen) return null;
  if (!published) return <div className="fixed inset-0 z-50 bg-slate-950 p-8 text-white"><p>Official results are published by the server at or after 22:00 Amsterdam. A suspended round requires review.</p><button onClick={onClose}>Close</button></div>;

  // Find current user's prediction result
  const myResult = currentUser
    ? rankedPredictions.find((p) => p.userId === currentUser.id)
    : undefined;

  // Top 100 leaderboard
  const top100 = rankedPredictions.slice(0, 100);

  const recordedAuditHash = auditHash || 'Not available';

  const copyAuditTrail = () => {
    navigator.clipboard.writeText(recordedAuditHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0e1626] border border-emerald-500/30 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative shadow-emerald-950/50">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-lg">Official Tournament Results</span>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded uppercase">
                  Published after 22:00 Amsterdam
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official Settlement Price: <strong className="text-emerald-400 font-mono">{formatUSD(officialSettlementPrice)}</strong> · Top 100 Rewarded
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-400 block">Total Cash Distributed</span>
            <span className="text-base font-mono font-extrabold text-amber-400 tabular-nums">
              {formatUSD(totalCashPool)}
            </span>
          </div>
        </div>

        {/* Tabs: My Result / Full Leaderboard / Audit Trail */}
        <div className="mt-4 flex border-b border-slate-800 text-xs font-semibold gap-6">
          <button
            onClick={() => setActiveTab('myResult')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'myResult'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            My Round Result (Section 26)
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Top 100 Leaderboard (Sections 17–19)
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Settlement Audit (Section 28)
          </button>
        </div>

        <div className="mt-4">
          {/* TAB 1: My Result (Section 26) */}
          {activeTab === 'myResult' && (
            <div>
              {myResult ? (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-[#101b2b] to-slate-950 border border-emerald-500/30 shadow-lg">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-400" />
                        <span className="font-bold text-white text-base">Your Official Performance</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-cyan-300 bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
                        Final Rank: #{myResult.rank}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs font-mono">
                      <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase block mb-1">Your Prediction</span>
                        <span className="text-base font-extrabold text-white">
                          {formatUSD(myResult.predictedPrice)}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase block mb-1">Official Price</span>
                        <span className="text-base font-extrabold text-emerald-400">
                          {formatUSD(officialSettlementPrice)}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase block mb-1">Absolute Error</span>
                        <span className="text-base font-extrabold text-cyan-300">
                          ±${myResult.error.toFixed(2)}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase block mb-1">Submission Time</span>
                        <span className="text-xs text-slate-200 mt-1 block">
                          {new Date(myResult.submittedAt).toLocaleTimeString('en-US', {
                            timeZone: 'Europe/Amsterdam',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Prize Won Banner */}
                    <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                          Reward Earned (Rank #{myResult.rank})
                        </div>
                        <div className="text-sm font-semibold text-white mt-0.5">
                          {myResult.prize.type === 'CASH'
                            ? `Cash Prize Allocation: ${formatUSD(myResult.prize.amount || 0)}`
                            : myResult.prize.description}
                        </div>
                      </div>

                      {myResult.prize.type === 'CASH' && (
                        <button
                          onClick={onStartKycClaim}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 cursor-pointer flex items-center gap-1.5 shrink-0"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Verify & Claim Cash Payout</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
                  You did not submit a prediction for this specific round. Predictions are open daily between 12:00 and 20:00 Europe/Amsterdam!
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Full Leaderboard (Top 100) */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Ordered by Lowest Error. Tie-Breaker: Earlier Submission Timestamp (Section 18).</span>
                <span className="text-cyan-400 font-mono">Showing Top {top100.length} Participants</span>
              </div>

              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950 max-h-[380px] overflow-y-auto">
                {top100.map((entry) => {
                  const isMe = currentUser ? entry.userId === currentUser.id : false;
                  const isCashWinner = entry.rank <= 30;

                  return (
                    <div
                      key={entry.id}
                      className={`p-3 flex items-center justify-between text-xs transition-colors ${
                        isMe ? 'bg-cyan-950/40' : 'hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 text-center font-mono font-bold ${
                            entry.rank === 1
                              ? 'text-amber-400 text-sm'
                              : entry.rank === 2
                              ? 'text-slate-300'
                              : entry.rank === 3
                              ? 'text-amber-600'
                              : 'text-slate-500'
                          }`}
                        >
                          #{entry.rank}
                        </span>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <span>{entry.username}</span>
                            {isMe && (
                              <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950 px-1 py-0.2 rounded border border-cyan-800">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Pred: {formatUSD(entry.predictedPrice)} · Sub: {new Date(entry.submittedAt).toLocaleTimeString('en-US', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono text-emerald-400 font-semibold tabular-nums">
                          ±${entry.error.toFixed(2)} error
                        </div>
                        <div className="text-[10px] font-medium">
                          {isCashWinner ? (
                            <span className="text-amber-400 font-mono font-bold">
                              {formatUSD(entry.prize.amount || 0)} Cash
                            </span>
                          ) : (
                            <span className="text-slate-400 truncate max-w-[140px] inline-block">
                              Non-Cash Reward
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Audit Ledger (Section 28) */}
          {activeTab === 'audit' && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-400 font-bold">
                  <Hash className="w-4 h-4" />
                  <span>Settlement Audit (Section 28)</span>
                </div>
                <button
                  onClick={copyAuditTrail}
                  className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:text-white text-slate-400 font-mono text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedHash ? 'Copied Hash!' : 'Copy SHA-256'}</span>
                </button>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/90 font-mono text-[11px] text-slate-300 space-y-1.5 border border-slate-800">
                <div><span className="text-slate-500">Round ID:</span> {roundId}</div>
                <div><span className="text-slate-500">Timezone Authority:</span> Europe/Amsterdam (IANA)</div>
                <div><span className="text-slate-500">Price Collection Freeze:</span> 20:00 Amsterdam; collection window up to 3 seconds</div>
                <div><span className="text-slate-500">Winner Publication:</span> 22:00 Amsterdam</div>
                <div><span className="text-slate-500">Settlement Formula:</span> Median(Coinbase, Bitstamp, Kraken)</div>
                <div><span className="text-slate-500">Deterministic Price:</span> {formatUSD(officialSettlementPrice)}</div>
                <div><a href={'/api/rounds/' + roundId + '/audit'} target="_blank" rel="noreferrer">Download audit JSON</a></div>
                <div><span className="text-slate-500">Audit SHA-256:</span> <span className="text-cyan-400 break-all">{recordedAuditHash}</span></div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                The SHA-256 digest identifies the published audit JSON. It is a consistency check, not proof that a database administrator cannot change records.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
