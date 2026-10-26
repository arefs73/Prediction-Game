import React, { useState } from 'react';
import { UserProfile } from '../types/game';
import { AmsterdamClockDetails, formatUSD } from '../utils/amsterdamTime';
import { AlertTriangle, CheckCircle2, Coins, Lock, LogIn, Sparkles, X } from 'lucide-react';
import { AuthModalMode } from './AuthModal';

interface PredictionBoxProps {
  currentSpotPrice: number;
  clock: AmsterdamClockDetails;
  user: UserProfile | null;
  unverifiedEmail?: string | null;
  onSubmitPrediction: (price: number) => { success: boolean; error?: string };
  onOpenAuth: (mode: AuthModalMode) => void;
}

export const PredictionBox: React.FC<PredictionBoxProps> = ({
  currentSpotPrice,
  clock,
  user,
  unverifiedEmail,
  onSubmitPrediction,
  onOpenAuth,
}) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Validate number format (max 2 decimals, positive)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputError(null);

    if (val === '') {
      setInputValue('');
      return;
    }

    const regex = /^\d*(\.\d{0,2})?$/;
    if (regex.test(val)) {
      setInputValue(val);
    }
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);

    if (!user) {
      onOpenAuth('login');
      return;
    }

    if (clock.phase !== 'OPEN') {
      setInputError('Prediction window is currently closed. Predictions are accepted 12:00 to 20:00 Amsterdam time.');
      return;
    }

    const parsed = parseFloat(inputValue);
    if (isNaN(parsed) || parsed <= 0) {
      setInputError('Please enter a valid target price greater than $0.00.');
      return;
    }

    if (parsed < 10000 || parsed > 500000) {
      setInputError('Please enter a realistic Bitcoin price between $10,000.00 and $500,000.00.');
      return;
    }

    if (user.tokenBalance < 1) {
      setInputError('Insufficient tokens. You need 1 Token to submit a prediction.');
      return;
    }

    // Open confirmation screen per Section 5
    setShowConfirmModal(true);
  };

  const handleFinalConfirm = () => {
    const parsed = Math.round(parseFloat(inputValue) * 100) / 100;
    const res = onSubmitPrediction(parsed);
    setShowConfirmModal(false);

    if (res.success) {
      setSuccessToast(`Prediction of ${formatUSD(parsed)} permanently locked! 1 Token consumed.`);
      setInputValue('');
      setTimeout(() => setSuccessToast(null), 5000);
    } else {
      setInputError(res.error || 'Failed to submit prediction.');
    }
  };

  const parsedVal = parseFloat(inputValue);
  const deltaFromSpot = !isNaN(parsedVal) && parsedVal > 0 ? parsedVal - currentSpotPrice : null;
  const deltaPct = deltaFromSpot !== null ? (deltaFromSpot / currentSpotPrice) * 100 : null;

  const isWindowOpen = clock.phase === 'OPEN';

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800/80 p-5 shadow-xl backdrop-blur-sm relative">
      {/* Critical UI Requirement Notice per Section 5 */}
      <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 leading-relaxed font-medium">
          <span className="font-bold text-amber-300">Critical Note: </span>
          You are predicting the exact price of the asset at <span className="underline decoration-amber-400 font-bold">20:00:00 Europe/Amsterdam</span>, not the current market price!
        </div>
      </div>

      <form onSubmit={handlePreSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Your 20:00:00 Price Prediction (USD)
            </label>
            <div className="text-xs text-slate-400 font-mono">
              Current Spot: <span className="text-cyan-400 font-semibold">{formatUSD(currentSpotPrice)}</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-mono text-base font-bold">
              $
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={handleInputChange}
              disabled={!isWindowOpen}
              placeholder={currentSpotPrice ? currentSpotPrice.toFixed(2) : '64800.00'}
              className="w-full pl-8 pr-28 py-3 rounded-xl bg-slate-950 border border-slate-700/80 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-lg font-mono font-bold text-white tracking-wide placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-xs font-mono font-medium text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                USD · 2 Decimals
              </span>
            </div>
          </div>

          {/* Quick Delta indicator */}
          {deltaFromSpot !== null && (
            <div className="mt-2 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Difference from current spot:</span>
              <span
                className={`font-semibold tabular-nums ${
                  deltaFromSpot >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {deltaFromSpot >= 0 ? '+' : ''}
                {formatUSD(deltaFromSpot)} ({deltaPct ? (deltaPct >= 0 ? '+' : '') + deltaPct.toFixed(2) : '0.00'}%)
              </span>
            </div>
          )}

          {inputError && (
            <div className="mt-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-900/60 p-2 rounded-lg font-medium">
              {inputError}
            </div>
          )}

          {successToast && (
            <div className="mt-2 text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-900/60 p-2.5 rounded-lg font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}
        </div>

        {/* Submit Button matching wireframe */}
        <div className="flex items-center gap-3">
          {!user && unverifiedEmail ? (
            <button
              type="button"
              onClick={() => onOpenAuth('verify_email')}
              className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-extrabold text-sm tracking-wide shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4 text-slate-950" />
              <span>Verify Email ({unverifiedEmail}) to Claim 5 Tokens & Predict</span>
            </button>
          ) : !user ? (
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-extrabold text-sm tracking-wide shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4 text-slate-950" />
              <span>Log In or Create Account to Predict (+5 Free Tokens)</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!isWindowOpen || !inputValue || user.tokenBalance < 1}
              className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-sm tracking-wide shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isWindowOpen ? (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>Submit Prediction (Costs 1 Token)</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span>Prediction Window Closed ({clock.phaseLabel})</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span className="flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            {user ? (
              <>
                Balance: <strong className="text-slate-300">{user.tokenBalance} Tokens</strong>
              </>
            ) : (
              <span className="text-slate-400">New accounts receive 5 Free Welcome Tokens</span>
            )}
          </span>
          <span>Core Rule: 1 Token = 1 Independent Guess</span>
        </div>
      </form>

      {/* Confirmation Screen per Game Rules Section 5 & 6 */}
      {showConfirmModal && user && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirm Immutable Prediction</h3>
                <p className="text-xs text-slate-400">Review your entry before locking</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Predicted Asset:</span>
                  <span className="font-bold text-white">Bitcoin (BTC/USD)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Target Settlement Time:</span>
                  <span className="font-mono text-cyan-300 font-semibold">20:00:00 Europe/Amsterdam</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                  <span className="text-slate-300 font-medium">Your Predicted Value:</span>
                  <span className="text-lg font-mono font-extrabold text-emerald-400">
                    {formatUSD(parseFloat(inputValue))}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>Token Cost:</span>
                  <span className="text-amber-400 font-semibold">1 Token (Remaining: {user.tokenBalance - 1})</span>
                </div>
              </div>

              {/* Mandatory Warning required by Section 5 */}
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-1">
                <div className="font-bold text-rose-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Final Confirmation Warning
                </div>
                <p className="text-[11px] leading-relaxed">
                  "Once confirmed, this prediction cannot be changed, edited, cancelled, or replaced."
                </p>
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed">
                By confirming, your prediction will be immutably recorded in the settlement ledger and your prediction will remain blurred to other participants until 20:00:00.
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Cancel / Edit
              </button>
              <button
                type="button"
                onClick={handleFinalConfirm}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 cursor-pointer"
              >
                Confirm & Lock In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
