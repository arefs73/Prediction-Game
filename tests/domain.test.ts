import test from 'node:test';
import assert from 'node:assert/strict';
import { atAmsterdam, dayKey, weekKey, newRound, normalizeTokens, claimDaily, spendPrediction, priceToCents, rankEntries, officialPrice } from '../server/domain.ts';
import type { Entry, Quote } from '../server/domain.ts';

test('Amsterdam deadlines follow summer/winter and DST boundaries', () => {
  assert.equal(new Date(atAmsterdam('2026-07-01', 20)).toISOString(), '2026-07-01T18:00:00.000Z');
  assert.equal(new Date(atAmsterdam('2026-10-27', 20)).toISOString(), '2026-10-27T19:00:00.000Z');
  assert.equal(new Date(atAmsterdam('2026-03-29', 20)).toISOString(), '2026-03-29T18:00:00.000Z');
  assert.equal(new Date(atAmsterdam('2026-10-25', 20)).toISOString(), '2026-10-25T19:00:00.000Z');
  assert.equal(dayKey(Date.parse('2026-10-25T23:00:00Z')), '2026-10-26');
  assert.equal(weekKey('2027-01-01'), '2026-12-28');
});
const tokenState = { tokenBalance: 20, cycleStart: '2026-10-19', lastClaimDate: null, lastPredictionDate: '2026-10-25', streakDay: 7 };
test('all saved tokens expire at Monday midnight, including after DST switch', () => {
  assert.equal(normalizeTokens(tokenState, Date.parse('2026-10-25T22:59:59Z')).tokenBalance, 20);
  const reset = normalizeTokens(tokenState, Date.parse('2026-10-25T23:00:00Z'));
  assert.equal(reset.tokenBalance, 0); assert.equal(reset.streakDay, 0);
  const claimed = claimDaily(reset, atAmsterdam('2026-10-26', 12));
  assert.equal(claimed.tokenBalance, 2);
  assert.throws(() => claimDaily(claimed, atAmsterdam('2026-10-26', 13)), /already claimed/);
});
test('one daily participation bonus, missing days reset streak, zero balance cannot enter', () => {
  const now = atAmsterdam('2026-10-27', 13);
  const first = spendPrediction({ ...tokenState, cycleStart: '2026-10-26', lastPredictionDate: '2026-10-26', streakDay: 1 }, now);
  assert.equal(first.streakDay, 2); assert.equal(first.tokenBalance, 21);
  assert.equal(spendPrediction(first, now).tokenBalance, 20);
  const missed = spendPrediction({ ...first, lastPredictionDate: '2026-10-24' }, now);
  assert.equal(missed.streakDay, 1);
  assert.throws(() => spendPrediction({ ...first, tokenBalance: 0 }, now), /Insufficient/);
});
test('price input rejects non-finite, out-of-range and sub-cent values', () => {
  for (const p of [NaN, Infinity, -1, 9999, 500001, 64000.001, '64000']) assert.throws(() => priceToCents(p));
  assert.equal(priceToCents(64000.29), 6400029);
});
test('one prize per user, round isolation, deterministic total tie-break and cent conservation', () => {
  const round = { ...newRound('2026-10-27', 3000000), officialPriceCents: 6400000 };
  const entry = (id: string, userId: string, cents: number, time = round.openAt): Entry => ({ id, userId, username: userId, roundId: round.id, priceCents: cents, submittedAtMs: time });
  const input = [entry('z','alice',6400000), entry('a','alice',6400000), entry('b','bob',6400000), entry('c','chris',6400001),
    { ...entry('d','old',6400000), roundId: 'round_20261026' }, entry('late','late',6400000,round.lockAt)];
  const results = rankEntries(input, round);
  assert.deepEqual(results.map(p => p.id), ['a','b','c']);
  assert.equal(results.reduce((s,p) => s+p.prizeCents,0),3000000);
  assert.deepEqual(rankEntries([...input].reverse(),round), results);
  assert.deepEqual(rankEntries([],round), []);
  for (const count of [1,2,3,10,29,30,31,100,101]) {
    const ranked = rankEntries(Array.from({length:count},(_,i)=>entry(String(i).padStart(3,'0'),'u'+i,6400000+i)), {...round,poolCents:10001});
    assert.equal(ranked.reduce((s,p)=>s+p.prizeCents,0),10001);
    assert.equal(ranked.filter(p=>p.prizeCents>0).length,Math.min(count,30));
  }
});
test('settlement rejects failed, stale, duplicate or divergent sources', () => {
  const lock = atAmsterdam('2026-10-27',20);
  const quotes: Quote[] = ['Coinbase','Kraken','Bitstamp'].map((exchange,i)=>({exchange,pair:'BTC/USD',priceCents:6400000+i,observedAt:lock+100,latencyMs:100}));
  assert.equal(officialPrice(quotes,lock),6400001);
  assert.throws(()=>officialPrice(quotes.slice(0,2),lock));
  assert.throws(()=>officialPrice([...quotes.slice(0,2),quotes[0]],lock));
  assert.throws(()=>officialPrice(quotes.map(q=>({...q,observedAt:lock+3001})),lock));
  assert.throws(()=>officialPrice(quotes.map(q=>({...q,observedAt:lock-1})),lock));
  assert.throws(()=>officialPrice([quotes[0],quotes[1],{...quotes[2],priceCents:8000000}],lock));
});
