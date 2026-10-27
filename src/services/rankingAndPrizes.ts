import type { PredictionEntry } from '../types/game';
// Results are calculated only by server/domain.ts. The browser never allocates prizes.
export interface RankedPrediction extends PredictionEntry {
  error: number; rank: number;
  prize: { type: 'CASH' | 'NON_CASH'; amount?: number; description: string };
}
