export interface UserProfile {
  id: string;
  username: string; // Public display name (e.g., "ArefS")
  firstName: string; // Private
  lastName: string; // Private
  email: string;
  phone: string;
  tokenBalance: number;
  streakDay: number; // 1 to 7
  streakClaimedToday: boolean;
  lastPredictionDate: string | null;
  gamingCycleWeek: number; // For weekly reset tracking
  kycStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
  kycDocumentType?: string;
  walletAddress?: string;
  referralCode: string;
  referralCount: number;
}

export interface ExchangeQuote {
  exchange: 'Coinbase' | 'Binance' | 'Kraken';
  price: number;
  timestamp: number;
  latencyMs: number;
  status: 'VALID' | 'OFFLINE';
}

export type RoundPhase = 'PRE_OPEN' | 'OPEN' | 'LOCKED_LIVE' | 'ANNOUNCED';

export interface PredictionEntry {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string;
  predictedPrice: number;
  submittedAt: string; // ISO string
  submittedTimestamp: number;
  roundId: string;
  // Resolved at 20:00 / 22:00
  error?: number;
  rank?: number;
  prize?: {
    type: 'CASH' | 'NON_CASH';
    amount?: number;
    description: string;
  };
}

export interface RoundState {
  roundId: string;
  dateString: string; // YYYY-MM-DD
  assetSymbol: 'BTC/USD';
  currentSpotPrice: number;
  exchangeQuotes: ExchangeQuote[];
  officialSettlementPrice: number | null;
  settlementTimestamp: string | null;
  totalCashPrizePool: number;
  status: RoundPhase;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string;
  message: string;
  timestamp: string;
  isSystem?: boolean;
}

export interface PreviousWinner {
  roundDate: string;
  rank: number;
  username: string;
  predictedPrice: number;
  officialPrice: number;
  error: number;
  prizeAmount: number;
}
