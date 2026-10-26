import React, { useState } from 'react';
import { ExternalLink, ShieldCheck, Sparkles, X } from 'lucide-react';

export const SponsorBanner: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <>
      <div
        style={{ marginTop: '0px', marginBottom: '23px', paddingTop: '22px', paddingBottom: '14px' }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900/90 via-[#0e172a] to-slate-900/90 border border-slate-800/80 px-6 sm:px-8 shadow-xl shadow-cyan-950/20 backdrop-blur-sm"
      >
        {/* Subtle Crypto Watermark Coins in background matching image.png */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-6 opacity-15 pointer-events-none select-none">
          <div className="w-16 h-16 rounded-full border border-amber-400 flex items-center justify-center text-2xl text-amber-400 font-bold">
            ₿
          </div>
          <div className="w-12 h-12 rounded-full border border-slate-300 flex items-center justify-center text-xl text-slate-300 font-bold">
            Ł
          </div>
          <div className="w-14 h-14 rounded-full border border-purple-400 flex items-center justify-center text-xl text-purple-400 font-bold">
            Ξ
          </div>
        </div>

        {/* Ambient glow accent */}
        <div className="absolute -left-20 -top-20 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                Official Competition Sponsor
              </span>
              <span className="text-xs text-slate-400">Section 12 Compliance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              NexusPrime Institutional Crypto Exchange
            </h1>
            <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
              Tier-1 European institutional spot liquidity and ultra-low latency infrastructure. Supporting transparent, manipulation-free algorithmic price settlement.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowDetails(true)}
              style={{ marginTop: '150px', paddingTop: '10px' }}
              className="px-5 pb-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs tracking-wide transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Learn More</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Sponsor modal / disclosure */}
      {showDetails && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowDetails(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">NexusPrime Exchange</h3>
                <p className="text-xs text-slate-400">Sponsor Disclosure & Partner Terms</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                NexusPrime is the proud sponsor of today's European daily prediction tournament.
              </p>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Strict Independence Guarantee (Game Rules v2.2 Section 12)
                </div>
                <p className="text-[11px] text-slate-400">
                  Sponsors must have no influence over predictions, market price collection, ranking calculations, settlement algorithms, or prize distributions.
                </p>
              </div>
              <p>
                To learn more about Institutional Liquidity APIs or explore European compliance solutions, visit the NexusPrime portal.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <a
                href="https://bitcoin.org"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
              >
                <span>Visit Partner Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
