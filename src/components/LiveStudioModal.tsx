import React, { useState } from 'react';
import { ExchangeQuote } from '../types/game';
import { AmsterdamClockDetails, formatDuration, formatUSD } from '../utils/amsterdamTime';
import { BarChart3, Clock, Eye, Radio, ShieldCheck, Sparkles, TrendingUp, X } from 'lucide-react';

interface LiveStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  clock: AmsterdamClockDetails;
  officialSettlementPrice: number;
  exchangeQuotes: ExchangeQuote[];
  totalPredictionsCount: number;
}

export const LiveStudioModal: React.FC<LiveStudioModalProps> = ({
  isOpen,
  onClose,
  clock,
  officialSettlementPrice,
  exchangeQuotes,
  totalPredictionsCount,
}) => {
  const [activeTab, setActiveTab] = useState<'analysis' | 'orderbook' | 'safeguards'>('analysis');

  if (!isOpen) return null;

  // Sorted quotes for median visualization
  const sortedQuotes = [...exchangeQuotes].sort((a, b) => a.price - b.price);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0e1626] border border-cyan-500/30 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative shadow-cyan-950/50">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Studio Live Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-lg">ApexPredict Live Studio</span>
                <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-950/70 border border-rose-800/60 px-2 py-0.5 rounded uppercase">
                  Live Period (20:00 → 22:00)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official market analysis, algorithmic price freeze & countdown to 22:00 announcement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
            <Clock className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-mono">
                Official Announcement In
              </div>
              <div className="text-sm font-mono font-bold text-cyan-300 tabular-nums">
                {clock.phase === 'LOCKED_LIVE'
                  ? formatDuration(clock.secondsUntilNextMilestone)
                  : clock.phase === 'ANNOUNCED'
                  ? '00:00:00 (Published)'
                  : 'Begins at 20:00'}
              </div>
            </div>
          </div>
        </div>

        {/* Section 14: Confirmed Approach: Median Price Model */}
        <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-slate-950 via-[#10192e] to-slate-950 border border-cyan-500/20">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Frozen 20:00:00 Official Settlement Price (Section 14)
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Method: <span className="text-cyan-300 font-semibold">3-Exchange Median Resolution</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 tracking-tight">
                {formatUSD(officialSettlementPrice)}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Permanently locked for Round #{clock.dateString.replace(/-/g, '')}. Winner ranks remain confidential until 22:00.
              </div>
            </div>

            {/* Visual breakdown of the 3 exchanges */}
            <div className="flex items-center gap-2 text-xs font-mono">
              {sortedQuotes.map((q, idx) => {
                const isMedian = idx === Math.floor(sortedQuotes.length / 2);
                return (
                  <div
                    key={q.exchange}
                    className={`px-3 py-2 rounded-lg border text-center ${
                      isMedian
                        ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/40'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-semibold text-slate-400">
                      {q.exchange} {isMedian && '★ MEDIAN'}
                    </div>
                    <div className="font-bold tabular-nums">{formatUSD(q.price)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Studio Content Tabs */}
        <div className="mt-6 flex border-b border-slate-800 text-xs font-medium gap-6">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'analysis'
                ? 'text-cyan-400 border-b-2 border-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Studio Expert Commentary
          </button>
          <button
            onClick={() => setActiveTab('orderbook')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'orderbook'
                ? 'text-cyan-400 border-b-2 border-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Prediction Distribution ({totalPredictionsCount} Entries)
          </button>
          <button
            onClick={() => setActiveTab('safeguards')}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === 'safeguards'
                ? 'text-cyan-400 border-b-2 border-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Settlement Safeguards
          </button>
        </div>

        <div className="mt-4">
          {activeTab === 'analysis' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3 text-xs text-slate-300">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold">
                  <Sparkles className="w-4 h-4" />
                  <span>Lead Analyst Broadcast: 20:00 Market Dynamics Overview</span>
                </div>
                <p className="leading-relaxed">
                  "Good evening, Amsterdam! The 20:00:00 Europe/Amsterdam prediction deadline is now in effect. Bitcoin exhibited tight consolidation into the freeze window with Coinbase pricing at ${sortedQuotes[0]?.price.toFixed(2)} and Kraken at ${sortedQuotes[2]?.price.toFixed(2)}. The algorithmic median cleanly resolved at <strong>{formatUSD(officialSettlementPrice)}</strong>, isolating individual exchange outliers."
                </p>
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400">Total Valid Community Predictions:</span>{' '}
                    <strong className="text-white font-mono">{totalPredictionsCount} entries</strong>
                  </div>
                  <div className="text-amber-400 font-medium">
                    Strict Confidentiality: Winner identities withheld until 22:00
                  </div>
                </div>
              </div>

              {/* Guest Expert Quotes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span>Dr. Lars Van Der Meer</span>
                    <span className="text-[10px] text-slate-500 font-normal">· Macro Strategist</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    "Predicting within cents on a high-volatility spot asset highlights true probabilistic forecasting skills. Tie-breaking by timestamp rewards those who took convictions earlier."
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span>Sophie Dubois</span>
                    <span className="text-[10px] text-slate-500 font-normal">· Quantitative Analyst</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    "The Median Price resolution algorithm guarantees immunity against single-node exchange outage or sudden spread anomalies."
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orderbook' && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Community Prediction Cluster Spread</span>
                <span className="font-mono text-cyan-400 text-[11px]">Center: {formatUSD(officialSettlementPrice)}</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Predictions range between $64,750 and $64,850. After 20:00:00, all submitted values are transparently visible in the main feed to verify public fairness.
              </p>
              <div className="h-4 bg-slate-900 rounded-full overflow-hidden flex">
                <div className="w-[32%] bg-rose-500/80" title="Bearish predictions (< Median)"></div>
                <div className="w-[18%] bg-emerald-400" title="Close to Median (±$5.00)"></div>
                <div className="w-[50%] bg-cyan-500/80" title="Bullish predictions (> Median)"></div>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>32% Lower than Median</span>
                <span className="text-emerald-400 font-bold">Median Settlement Anchor</span>
                <span>50% Higher than Median</span>
              </div>
            </div>
          )}

          {activeTab === 'safeguards' && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3 text-xs text-slate-300">
              <h4 className="font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Game Rules v2.2 Market-Data Safeguards (Section 13 & 14)
              </h4>
              <ul className="space-y-2 list-disc list-inside text-slate-400 text-[11px] leading-relaxed">
                <li>Deterministic collection timestamp: exactly 20:00:00 Europe/Amsterdam.</li>
                <li>Equal-weight quote sampling across Coinbase Spot, Binance USDT Spot, and Kraken USD Spot.</li>
                <li>Single abnormal wick or flash crash on any single exchange is filtered out by median logic.</li>
                <li>All submissions become fully viewable post-20:00 to prevent front-running.</li>
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Return to Arena
          </button>
        </div>
      </div>
    </div>
  );
};
