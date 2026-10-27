// All economic decisions use server time and integer cents.
export const TIME_ZONE = 'Europe/Amsterdam';
export const RULES_VERSION = '3.0-draft';
export class GameError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function requireThat(ok: unknown, message: string, status = 400): asserts ok {
  if (!ok) throw new GameError(status, message);
}
export function dayKey(now: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function addDays(day: string, count: number): string {
  return new Date(Date.parse(day + 'T12:00:00Z') + count * 86400000).toISOString().slice(0, 10);
}
export function weekKey(day: string): string {
  const weekday = new Date(day + 'T12:00:00Z').getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}
export function atAmsterdam(day: string, hour: number): number {
  const target = Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
  let result = target;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(result).map(p => [p.type, p.value]));
    const represented = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    result += target - represented;
  }
  return result;
}
export interface Round {
  id: string; date: string; openAt: number; lockAt: number; announceAt: number;
  status: 'OPEN' | 'LOCKED' | 'FROZEN' | 'ANNOUNCED' | 'SUSPENDED';
  rulesVersion: string; poolCents: number; predictionCap: number; entryCount: number;
  officialPriceCents?: number; frozenAt?: number; suspensionReason?: string;
  quotes?: Quote[]; auditHash?: string;
}
export function newRound(day: string, poolCents: number, predictionCap = 100): Round {
  requireThat(Number.isSafeInteger(poolCents) && poolCents >= 0, 'Invalid prize pool');
  requireThat(Number.isSafeInteger(predictionCap) && predictionCap > 0, 'Invalid prediction cap');
  return { id: 'round_' + day.replaceAll('-', ''), date: day, openAt: atAmsterdam(day, 12),
    lockAt: atAmsterdam(day, 20), announceAt: atAmsterdam(day, 22), status: 'OPEN',
    rulesVersion: RULES_VERSION, poolCents, predictionCap, entryCount: 0 };
}
export interface TokenState {
  tokenBalance: number; cycleStart: string; lastClaimDate: string | null;
  lastPredictionDate: string | null; streakDay: number;
}
export function normalizeTokens<T extends TokenState>(user: T, now: number): T {
  const today = dayKey(now), cycleStart = weekKey(today);
  const newWeek = user.cycleStart !== cycleStart;
  const broken = user.lastPredictionDate !== today && user.lastPredictionDate !== addDays(today, -1);
  return { ...user, cycleStart, tokenBalance: newWeek ? 0 : user.tokenBalance,
    streakDay: newWeek || broken ? 0 : user.streakDay };
}
export function claimDaily<T extends TokenState>(user: T, now: number): T {
  const current = normalizeTokens(user, now), today = dayKey(now);
  requireThat(current.lastClaimDate !== today, 'Daily tokens already claimed', 409);
  return { ...current, lastClaimDate: today, tokenBalance: current.tokenBalance + 2 };
}
export function spendPrediction<T extends TokenState>(user: T, now: number): T {
  const current = normalizeTokens(user, now), today = dayKey(now);
  requireThat(current.tokenBalance >= 1, 'Insufficient tokens', 409);
  const firstToday = current.lastPredictionDate !== today;
  const streakDay = firstToday ? Math.min(current.streakDay + 1, 7) : current.streakDay;
  return { ...current, streakDay, lastPredictionDate: today,
    tokenBalance: current.tokenBalance - 1 + (firstToday ? streakDay : 0) };
}
export function priceToCents(price: unknown): number {
  requireThat(typeof price === 'number' && Number.isFinite(price) && price >= 10000 && price <= 500000,
    'Prediction must be between $10,000 and $500,000');
  const cents = Math.round(price * 100);
  requireThat(Math.abs(price * 100 - cents) < 0.000001, 'Use no more than two decimals');
  return cents;
}
export interface Entry { id: string; userId: string; username: string; roundId: string; priceCents: number; submittedAtMs: number; }
export interface Result extends Entry { errorCents: number; rank: number; prizeCents: number; reward: string; }
export function rankEntries(entries: Entry[], round: Round): Result[] {
  requireThat(Number.isSafeInteger(round.officialPriceCents), 'No official price');
  const sorted = entries.filter(p => p.roundId === round.id && p.submittedAtMs >= round.openAt && p.submittedAtMs < round.lockAt)
    .map(p => ({ ...p, errorCents: Math.abs(p.priceCents - round.officialPriceCents!) }))
    .sort((a, b) => a.errorCents - b.errorCents || a.submittedAtMs - b.submittedAtMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const seen = new Set<string>();
  const unique = sorted.filter(p => { if (seen.has(p.userId)) return false; seen.add(p.userId); return true; });
  // Integer weights preserve 40/20/10/15/15 tiers. Missing places are proportionally redistributed.
  const weights = unique.slice(0, 30).map((_, i) => i === 0 ? 1120 : i === 1 ? 560 : i === 2 ? 280 : i < 10 ? 60 : 21);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const amounts = weights.map(w => Number(BigInt(round.poolCents) * BigInt(w) / BigInt(totalWeight)));
  let remaining = round.poolCents - amounts.reduce((a, b) => a + b, 0);
  // At most N-1 cents of rounding; earlier ranks receive the cents in order.
  for (let i = 0; i < amounts.length && remaining > 0; i++, remaining--) amounts[i]++;
  return unique.map((p, i) => ({ ...p, rank: i + 1, prizeCents: amounts[i] || 0,
    reward: i < 30 ? 'Cash prize' : i < 100 ? 'Non-cash reward pending fulfillment' : 'No prize' }));
}
export interface Quote { exchange: string; pair: 'BTC/USD'; priceCents: number; observedAt: number; latencyMs: number; }
export function officialPrice(quotes: Quote[], lockAt: number): number {
  const valid = quotes.filter(q => q.pair === 'BTC/USD' && Number.isSafeInteger(q.priceCents) && q.priceCents > 0 &&
    q.observedAt >= lockAt && q.observedAt <= lockAt + 3000);
  requireThat(new Set(valid.map(q => q.exchange)).size === 3 && valid.length === 3, 'Three timely USD quotes required', 503);
  valid.sort((a, b) => a.priceCents - b.priceCents);
  requireThat((valid[2].priceCents - valid[0].priceCents) / valid[1].priceCents <= 0.01, 'Sources disagree by more than 1%', 503);
  return valid[1].priceCents;
}
