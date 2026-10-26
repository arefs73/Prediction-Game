import { PredictionEntry } from '../types/game';

export interface RankedPrediction extends PredictionEntry {
  error: number;
  rank: number;
  prize: {
    type: 'CASH' | 'NON_CASH';
    amount?: number;
    description: string;
  };
}

/**
 * Calculates error, tie-breakers, ranks, and prizes according to Game Rules v2.2 Sections 16, 17, 18, 19, 20.
 */
export function calculateRankingsAndPrizes(
  predictions: PredictionEntry[],
  officialSettlementPrice: number,
  totalCashPool = 30000 // e.g. $30,000 cash pool
): RankedPrediction[] {
  if (predictions.length === 0) return [];

  // Step 1: Calculate error for each prediction
  // Error = Absolute Difference between Prediction and Official Settlement Price
  const scored = predictions.map((p) => {
    const error = Math.abs(p.predictedPrice - officialSettlementPrice);
    // Round error to 2 decimal places
    const roundedError = Math.round(error * 100) / 100;
    return {
      ...p,
      error: roundedError,
    };
  });

  // Step 2: Sort by error ascending. Tie-breaker: Submission Timestamp (earlier submission wins)
  scored.sort((a, b) => {
    if (a.error !== b.error) {
      return a.error - b.error;
    }
    // Earlier submission timestamp receives higher rank (Section 18)
    return a.submittedTimestamp - b.submittedTimestamp;
  });

  // Step 3: Allocate prizes to Top 100
  // Ranks #1-#30: Cash prizes (100% of pool distributed deterministically)
  // Ranks #31-#100: Non-cash rewards
  const rank1Share = 0.40; // 40%
  const rank2Share = 0.20; // 20%
  const rank3Share = 0.10; // 10%
  const pool4to10Total = totalCashPool * 0.15; // 15% shared equally among 7 winners (ranks 4-10)
  const pool11to30Total = totalCashPool * 0.15; // 15% shared equally among 20 winners (ranks 11-30)

  const rank1Amount = Math.floor(totalCashPool * rank1Share * 100) / 100;
  const rank2Amount = Math.floor(totalCashPool * rank2Share * 100) / 100;
  const rank3Amount = Math.floor(totalCashPool * rank3Share * 100) / 100;

  const count4to10 = 7;
  const each4to10 = Math.floor((pool4to10Total / count4to10) * 100) / 100;

  const count11to30 = 20;
  const each11to30 = Math.floor((pool11to30Total / count11to30) * 100) / 100;

  // Track sum allocated to handle deterministic rounding per Section 20
  let allocatedSum = 0;

  const rankedResults: RankedPrediction[] = scored.map((item, index) => {
    const rank = index + 1;
    let prize: RankedPrediction['prize'];

    if (rank === 1) {
      prize = {
        type: 'CASH',
        amount: rank1Amount,
        description: `1st Place Cash Prize (${rank1Share * 100}%)`,
      };
      allocatedSum += rank1Amount;
    } else if (rank === 2) {
      prize = {
        type: 'CASH',
        amount: rank2Amount,
        description: `2nd Place Cash Prize (${rank2Share * 100}%)`,
      };
      allocatedSum += rank2Amount;
    } else if (rank === 3) {
      prize = {
        type: 'CASH',
        amount: rank3Amount,
        description: `3rd Place Cash Prize (${rank3Share * 100}%)`,
      };
      allocatedSum += rank3Amount;
    } else if (rank >= 4 && rank <= 10) {
      prize = {
        type: 'CASH',
        amount: each4to10,
        description: 'Top 10 Meaningful Cash Share',
      };
      allocatedSum += each4to10;
    } else if (rank >= 11 && rank <= 30) {
      prize = {
        type: 'CASH',
        amount: each11to30,
        description: 'Tier 3 Cash Prize Share',
      };
      allocatedSum += each11to30;
    } else if (rank >= 31 && rank <= 50) {
      prize = {
        type: 'NON_CASH',
        description: '60-Day Pro Market Intelligence & VIP Analytics Access',
      };
    } else if (rank >= 51 && rank <= 100) {
      prize = {
        type: 'NON_CASH',
        description: '10 Bonus Prediction Tokens & Special Event Tournament Pass',
      };
    } else {
      prize = {
        type: 'NON_CASH',
        description: 'Participant Recognition & Streak Multiplier Booster',
      };
    }

    return {
      ...item,
      rank,
      prize,
    };
  });

  // Section 20: 100% of defined Cash Prize Pool must be allocated. Add any rounding dust to Rank 1
  const remainingCents = Math.round((totalCashPool - allocatedSum) * 100) / 100;
  if (rankedResults.length > 0 && remainingCents > 0 && rankedResults[0].prize.amount) {
    rankedResults[0].prize.amount = Math.round((rankedResults[0].prize.amount + remainingCents) * 100) / 100;
  }

  return rankedResults;
}
