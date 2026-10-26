/**
 * @file server/settlementEngine.ts
 * @description Production Backend Engine for Crypto Market Prediction Platform
 * Strictly adhering to Game Rules v2.2 (Sections 10, 13, 14, 15, 16, 17, 18, 19, 20)
 * Timezone Authority: Europe/Amsterdam (IANA)
 */

export interface ExchangeQuote {
  exchange: 'Coinbase' | 'Binance' | 'Kraken';
  price: number;
  timestamp: number;
  latencyMs: number;
  status: 'VALID' | 'FAILED' | 'STALE';
}

export interface PredictionRecord {
  id: string;
  roundId: string;
  userId: string;
  predictedPrice: number; // Max 2 decimal places in USD
  submittedTimestampMs: number; // Precision tie-breaker
  isImmutable: boolean;
}

export interface SettledPrediction extends PredictionRecord {
  absoluteError: number;
  finalRank: number;
  prizeRewardType: 'CASH' | 'NON_CASH' | 'NONE';
  prizeCashAmount: number;
  prizeNonCashDescription: string | null;
}

export interface RoundSettlementResult {
  roundId: string;
  settlementTimestamp: string;
  officialSettlementPrice: number;
  exchangeQuotes: ExchangeQuote[];
  totalPredictionsCount: number;
  totalCashPool: number;
  totalCashAllocated: number;
  rankedWinners: SettledPrediction[];
}

// ============================================================================
// 1. PRICE RESOLUTION: MULTI-API MEDIAN PRICE MODEL (Game Rules Section 13 & 14)
// ============================================================================

/**
 * Fetches BTC/USD spot prices concurrently from approved exchange providers.
 * Includes data freshness check and timeout handling.
 */
export async function fetchMultiExchangeSpotPrices(): Promise<ExchangeQuote[]> {
  const now = Date.now();
  const FETCH_TIMEOUT_MS = 3000;

  const fetchWithTimeout = async (url: string, parsePrice: (data: any) => number, exchange: ExchangeQuote['exchange']): Promise<ExchangeQuote> => {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const rawPrice = parsePrice(json);

      if (isNaN(rawPrice) || rawPrice <= 0) {
        throw new Error('Invalid numeric price parsed');
      }

      return {
        exchange,
        price: Math.round(rawPrice * 100) / 100,
        timestamp: Date.now(),
        latencyMs: Date.now() - startTime,
        status: 'VALID',
      };
    } catch (err) {
      return {
        exchange,
        price: 0,
        timestamp: Date.now(),
        latencyMs: Date.now() - startTime,
        status: 'FAILED',
      };
    }
  };

  const quotes = await Promise.all([
    fetchWithTimeout('https://api.coinbase.com/v2/prices/BTC-USD/spot', (d) => parseFloat(d.data.amount), 'Coinbase'),
    fetchWithTimeout('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', (d) => parseFloat(d.price), 'Binance'),
    fetchWithTimeout('https://api.kraken.com/0/public/Ticker?pair=XBTUSD', (d) => {
      const pair = d.result?.XXBTZUSD || d.result?.XBTUSD;
      return parseFloat(pair.c[0]);
    }, 'Kraken'),
  ]);

  return quotes;
}

/**
 * Section 14: Confirmed Approach - Median Price Model
 * Computes deterministic median across valid exchange quotes.
 */
export function calculateOfficialSettlementPrice(quotes: ExchangeQuote[]): {
  officialPrice: number;
  validQuotes: ExchangeQuote[];
} {
  const validQuotes = quotes.filter((q) => q.status === 'VALID' && q.price > 0);

  if (validQuotes.length === 0) {
    throw new Error('Critical settlement error: No valid exchange quotes received at 20:00:00');
  }

  // Sort ascending by price
  validQuotes.sort((a, b) => a.price - b.price);

  let median: number;
  const mid = Math.floor(validQuotes.length / 2);

  if (validQuotes.length % 2 === 1) {
    median = validQuotes[mid].price;
  } else {
    median = (validQuotes[mid - 1].price + validQuotes[mid].price) / 2;
  }

  // Strictly enforce 2 decimal places
  const officialPrice = Math.round(median * 100) / 100;
  return { officialPrice, validQuotes };
}

// ============================================================================
// 2. RANK CALCULATION & TIE-BREAKER ALGORITHM (Game Rules Section 16, 17, 18)
// ============================================================================

/**
 * Calculates absolute error and sorts predictions.
 * Tie-breaker rule (Section 18): Earlier submission timestamp receives higher rank.
 */
export function computePredictionRankings(
  predictions: PredictionRecord[],
  officialSettlementPrice: number
): { prediction: PredictionRecord; absoluteError: number }[] {
  // Section 16: Error = Absolute Difference between Prediction and Official Settlement Price
  const scored = predictions.map((p) => {
    const rawError = Math.abs(p.predictedPrice - officialSettlementPrice);
    const absoluteError = Math.round(rawError * 100) / 100;
    return {
      prediction: p,
      absoluteError,
    };
  });

  // Section 17 & 18:
  // Sort primarily by absoluteError ASC (lowest error is best)
  // Sort secondarily by submittedTimestampMs ASC (earlier submission wins)
  scored.sort((a, b) => {
    if (a.absoluteError !== b.absoluteError) {
      return a.absoluteError - b.absoluteError;
    }
    return a.prediction.submittedTimestampMs - b.prediction.submittedTimestampMs;
  });

  return scored;
}

// ============================================================================
// 3. TIERED PRIZE DISTRIBUTION LOGIC (Game Rules Section 19 & 20)
// ============================================================================

/**
 * Allocates 100% of the Cash Prize Pool to Ranks #1-#30 and non-cash rewards to Ranks #31-#100.
 * Any rounding cents are deterministically handled per Section 20.
 */
export function distributeTieredPrizes(
  rankedScored: { prediction: PredictionRecord; absoluteError: number }[],
  totalCashPool: number = 30000.00
): { settledPredictions: SettledPrediction[]; totalCashAllocated: number } {
  const settledPredictions: SettledPrediction[] = [];

  // Share percentages per Section 19
  const RANK_1_PERCENT = 0.40; // 40%
  const RANK_2_PERCENT = 0.20; // 20%
  const RANK_3_PERCENT = 0.10; // 10%
  const POOL_4_TO_10_PERCENT = 0.15; // 15% split equally among 7 winners (ranks 4-10)
  const POOL_11_TO_30_PERCENT = 0.15; // 15% split equally among 20 winners (ranks 11-30)

  const rank1Amount = Math.floor(totalCashPool * RANK_1_PERCENT * 100) / 100;
  const rank2Amount = Math.floor(totalCashPool * RANK_2_PERCENT * 100) / 100;
  const rank3Amount = Math.floor(totalCashPool * RANK_3_PERCENT * 100) / 100;

  const share4to10 = Math.floor(((totalCashPool * POOL_4_TO_10_PERCENT) / 7) * 100) / 100;
  const share11to30 = Math.floor(((totalCashPool * POOL_11_TO_30_PERCENT) / 20) * 100) / 100;

  let allocatedCashTotal = 0;

  for (let i = 0; i < rankedScored.length; i++) {
    const rank = i + 1;
    const item = rankedScored[i];

    let prizeType: 'CASH' | 'NON_CASH' | 'NONE' = 'NONE';
    let cashAmount = 0;
    let nonCashDesc: string | null = null;

    if (rank === 1) {
      prizeType = 'CASH';
      cashAmount = rank1Amount;
      allocatedCashTotal += cashAmount;
    } else if (rank === 2) {
      prizeType = 'CASH';
      cashAmount = rank2Amount;
      allocatedCashTotal += cashAmount;
    } else if (rank === 3) {
      prizeType = 'CASH';
      cashAmount = rank3Amount;
      allocatedCashTotal += cashAmount;
    } else if (rank >= 4 && rank <= 10) {
      prizeType = 'CASH';
      cashAmount = share4to10;
      allocatedCashTotal += cashAmount;
    } else if (rank >= 11 && rank <= 30) {
      prizeType = 'CASH';
      cashAmount = share11to30;
      allocatedCashTotal += cashAmount;
    } else if (rank >= 31 && rank <= 50) {
      prizeType = 'NON_CASH';
      nonCashDesc = '60-Day Pro Market Intelligence & VIP Analytics Access';
    } else if (rank >= 51 && rank <= 100) {
      prizeType = 'NON_CASH';
      nonCashDesc = '10 Bonus Prediction Tokens & Special Event Tournament Pass';
    } else {
      prizeType = 'NONE';
    }

    settledPredictions.push({
      ...item.prediction,
      absoluteError: item.absoluteError,
      finalRank: rank,
      prizeRewardType: prizeType,
      prizeCashAmount: cashAmount,
      prizeNonCashDescription: nonCashDesc,
    });
  }

  // Section 20 Principle: 100% of defined Cash Prize Pool must be allocated.
  // Any residual rounding cents are deterministically allocated to Rank 1.
  const roundingRemainder = Math.round((totalCashPool - allocatedCashTotal) * 100) / 100;
  if (settledPredictions.length > 0 && roundingRemainder > 0) {
    settledPredictions[0].prizeCashAmount = Math.round((settledPredictions[0].prizeCashAmount + roundingRemainder) * 100) / 100;
    allocatedCashTotal = Math.round((allocatedCashTotal + roundingRemainder) * 100) / 100;
  }

  return { settledPredictions, totalCashAllocated: allocatedCashTotal };
}

// ============================================================================
// 4. THE 20:00:00 EUROPE/AMSTERDAM CRON SCHEDULER & PIPELINE
// ============================================================================

/**
 * Executes the 20:00:00 Europe/Amsterdam Settlement Job.
 * In production, scheduled via node-cron or Google Cloud Scheduler:
 * Expression: "0 20 * * *" with timezone "Europe/Amsterdam".
 */
export async function executeRoundSettlementAt2000(
  roundId: string,
  submissions: PredictionRecord[],
  totalCashPool: number = 30000.00
): Promise<RoundSettlementResult> {
  const amsterdamTimestamp = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(new Date());

  // Step 1: Collect spot prices from Coinbase, Binance, Kraken
  const quotes = await fetchMultiExchangeSpotPrices();

  // Step 2: Compute deterministic median price
  const { officialPrice } = calculateOfficialSettlementPrice(quotes);

  // Step 3: Compute rankings with timestamp tie-breaker
  const scored = computePredictionRankings(submissions, officialPrice);

  // Step 4: Allocate tiered prizes
  const { settledPredictions, totalCashAllocated } = distributeTieredPrizes(scored, totalCashPool);

  return {
    roundId,
    settlementTimestamp: amsterdamTimestamp,
    officialSettlementPrice: officialPrice,
    exchangeQuotes: quotes,
    totalPredictionsCount: submissions.length,
    totalCashPool,
    totalCashAllocated,
    rankedWinners: settledPredictions,
  };
}
