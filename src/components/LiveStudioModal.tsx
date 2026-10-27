import React from 'react';
import type { ExchangeQuote } from '../types/game';
import { formatUSD } from '../utils/amsterdamTime';
import type { AmsterdamClockDetails } from '../utils/amsterdamTime';
interface Props {
 isOpen: boolean; onClose: () => void; clock: AmsterdamClockDetails;
 officialSettlementPrice: number | null; exchangeQuotes: ExchangeQuote[]; totalPredictionsCount: number;
}
export const LiveStudioModal: React.FC<Props> = ({ isOpen, onClose, officialSettlementPrice, exchangeQuotes, totalPredictionsCount }) => {
 if (!isOpen) return null;
 return <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
  <section role="dialog" aria-modal="true" aria-label="Official price and sources" className="bg-slate-900 rounded-2xl p-6 max-w-2xl w-full space-y-4">
   <div className="flex justify-between"><h2 className="text-lg font-bold">Official price & sources</h2><button onClick={onClose}>Close</button></div>
   <p>Official frozen price: <strong>{formatUSD(officialSettlementPrice)}</strong></p>
   <p>{totalPredictionsCount} accepted predictions. Winners are published at or after 22:00 Amsterdam.</p>
   <p className="text-sm text-slate-400">{officialSettlementPrice === null ? 'These are current indicative quotes. A shared official price will be recorded at the deadline.' : 'These observations were saved with the official settlement.'}</p>
   <ul>{exchangeQuotes.map(q => <li key={q.exchange} className="p-2 border-b border-slate-800">{q.exchange} BTC/USD: {formatUSD(q.price)} · received {new Date(q.timestamp).toISOString()}</li>)}</ul>
   <p className="text-sm text-slate-400">The server requests three USD quotes at 20:00. Responses must arrive within 3 seconds and agree within 1%. Otherwise the round is suspended for review. Receipt times are recorded; they are not exchange trade timestamps.</p>
  </section>
 </div>;
};
