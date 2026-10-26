import React from 'react';
import { BookOpen, CheckCircle, FileText, Scale, Shield, X } from 'lucide-react';

interface RulesTransparencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesTransparencyModal: React.FC<RulesTransparencyModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0e1626] border border-cyan-500/30 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative shadow-cyan-950/50">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Game Rules v2.2 - Product Baseline</h2>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded font-bold">
                September 2026 Baseline
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Core rules for product, legal, UX and technical implementation
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4 text-xs text-slate-300 leading-relaxed">
          {/* Confirmed Rules Checklist */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="font-bold text-white flex items-center gap-1.5 text-sm">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Confirmed Core Rules (Page 12)
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-slate-300">
              <li><strong className="text-white">Precision:</strong> Predictions use strictly two decimal places (USD).</li>
              <li><strong className="text-white">Token Cost:</strong> Exactly 1 Token required for each submitted prediction.</li>
              <li><strong className="text-white">Immutability:</strong> Predictions are permanently irreversible once confirmed.</li>
              <li><strong className="text-white">Prediction Window:</strong> Open daily from 12:00 to 20:00 Europe/Amsterdam.</li>
              <li><strong className="text-white">Anti-Herding Rule:</strong> Values remain hidden ($•••••.••) until 20:00:00 and unmask when the round locks.</li>
              <li><strong className="text-white">Settlement Model:</strong> 3-provider Median Price Model (Coinbase, Binance, Kraken) calculated and frozen at 20:00:00.</li>
              <li><strong className="text-white">Tie-Breaker:</strong> Submission Timestamp is the tie-breaker for equal prediction error. Earlier submission wins.</li>
              <li><strong className="text-white">Prize Tiers:</strong> Ranks #1–#30 receive cash prizes (100% of cash pool allocated); Ranks #31–#100 receive non-cash rewards.</li>
              <li><strong className="text-white">Streak System:</strong> Days 1–7 grant 1 to 7 bonus tokens; requires at least 1 valid prediction per day to maintain.</li>
              <li><strong className="text-white">Weekly Reset:</strong> Unused tokens expire at the end of each 7-day cycle.</li>
            </ul>
          </div>

          {/* Timezone & Sequence */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="font-bold text-white flex items-center gap-1.5 text-sm">
              <Scale className="w-4 h-4 text-cyan-400" />
              Operational Timezone & Daily Milestones (Section 15)
            </div>
            <p className="text-slate-400">
              All times use the IANA timezone <code>Europe/Amsterdam</code> rather than hard-coded CET/CEST to handle daylight-saving changes automatically.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] pt-1">
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-cyan-400 font-bold block">12:00:00 CEST</span>
                <span className="text-slate-400">Prediction Window Opens</span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-amber-400 font-bold block">20:00:00 CEST</span>
                <span className="text-slate-400">Price Freeze & Unmask</span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-emerald-400 font-bold block">22:00:00 CEST</span>
                <span className="text-slate-400">Official Announcement</span>
              </div>
            </div>
          </div>

          {/* Revenue Model Rule (Section 29) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="font-bold text-white flex items-center gap-1.5 text-sm">
              <Shield className="w-4 h-4 text-amber-400" />
              Compliance & Legal Classification Notice (Section 29)
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              "Until legal classification is confirmed, no paid or advertising-linked mechanism may be assumed to lawfully increase a user's number of cash-prize prediction entries. The MVP will not include direct sale of prediction tokens."
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
