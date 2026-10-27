import { createHash, randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { GameError, requireThat, dayKey, weekKey, newRound, normalizeTokens, claimDaily, spendPrediction, priceToCents, rankEntries, officialPrice } from './domain.ts';
import type { Round, Entry, TokenState, Quote, Result } from './domain.ts';
import { fetchQuotes } from './market.ts';

type Profile = TokenState & { userId: string; username: string; firstName: string; lastName: string; email: string; phone: string;
  kycStatus: string; referralCode: string; referralCount: number; createdAt: number; updatedAt: number; disabled?: boolean };
function text(value: unknown, max: number, min = 1): string {
  requireThat(typeof value === 'string' && value.trim().length >= min && value.trim().length <= max, 'Invalid text field');
  return value.trim();
}
export function publicProfile(p: Profile, now: number) {
  const state = normalizeTokens(p, now);
  return { ...state, id: p.userId, streakClaimedToday: state.lastClaimDate === dayKey(now), gamingCycleWeek: 1 };
}
export function entryView(p: Entry, reveal: boolean) {
  return { id: p.id, userId: p.userId, username: p.username, roundId: p.roundId, avatarUrl: '',
    submittedAt: new Date(p.submittedAtMs).toISOString(), submittedTimestamp: p.submittedAtMs,
    predictedPrice: reveal ? p.priceCents / 100 : null };
}
export function resultView(p: Result) {
  return { ...entryView(p, true), error: p.errorCents / 100, rank: p.rank,
    prize: { type: p.rank <= 30 ? 'CASH' : 'NON_CASH', amount: p.prizeCents / 100, description: p.reward } };
}
export class GameService {
  constructor(public db: Firestore, public now = () => Date.now(), public quotes = fetchQuotes) {}
  roundRef(id: string) { requireThat(/^round_\d{8}$/.test(id), 'Invalid round ID'); return this.db.collection('rounds').doc(id); }
  async profile(uid: string) {
    return this.db.runTransaction(async tx => {
      const ref = this.db.collection('users').doc(uid), snap = await tx.get(ref);
      if (!snap.exists) return null;
      const current = snap.data() as Profile;
      requireThat(!current.disabled, 'Account disabled', 403);
      requireThat(typeof current.cycleStart === 'string', 'Legacy profile requires operator migration', 409);
      const normalized = normalizeTokens(current, this.now());
      if (current.cycleStart !== normalized.cycleStart || current.streakDay !== normalized.streakDay) tx.update(ref, { ...normalized, updatedAt: this.now() });
      return publicProfile(normalized, this.now());
    });
  }
  async register(uid: string, email: string, data: Record<string, unknown>) {
    const username = text(data.username, 30, 3);
    requireThat(/^[a-zA-Z0-9_-]+$/.test(username), 'Invalid display name');
    const firstName = text(data.firstName, 80), lastName = text(data.lastName, 80), phone = text(data.phone, 30, 7);
    return this.db.runTransaction(async tx => {
      const ref = this.db.collection('users').doc(uid), existing = await tx.get(ref);
      if (existing.exists) {
        requireThat(!existing.get('disabled'), 'Account disabled', 403);
        requireThat(existing.get('cycleStart'), 'Legacy profile requires operator migration', 409);
        return publicProfile(existing.data() as Profile, this.now());
      }
      const now = this.now(), today = dayKey(now);
      const p: Profile = { userId: uid, username, firstName, lastName, phone, email, tokenBalance: 5,
        streakDay: 0, lastPredictionDate: null, lastClaimDate: today, cycleStart: weekKey(today),
        kycStatus: 'UNVERIFIED', referralCode: createHash('sha256').update(uid).digest('hex').slice(0, 16),
        referralCount: 0, createdAt: now, updatedAt: now };
      tx.create(ref, p);
      tx.create(this.db.collection('publicProfiles').doc(uid), { userId: uid, username });
      tx.create(this.db.collection('tokenLedger').doc(`welcome_${uid}`), { userId: uid, delta: 5, reason: 'WELCOME', at: now, cycleStart: p.cycleStart });
      return publicProfile(p, now);
    });
  }
  async updateProfile(uid: string, data: Record<string, unknown>) {
    const allowed = ['username', 'firstName', 'lastName', 'phone'];
    requireThat(Object.keys(data).every(k => allowed.includes(k)), 'Protected profile field', 403);
    const updates: Record<string, unknown> = {};
    for (const key of allowed) if (key in data) updates[key] = text(data[key], key === 'username' || key === 'phone' ? 30 : 80, key === 'username' ? 3 : 1);
    if ('username' in updates) requireThat(/^[a-zA-Z0-9_-]{3,30}$/.test(String(updates.username)), 'Invalid display name');
    await this.db.runTransaction(async tx => {
      const ref = this.db.collection('users').doc(uid), snap = await tx.get(ref);
      requireThat(snap.exists && !snap.get('disabled'), 'Profile required', 403);
      tx.update(ref, { ...updates, updatedAt: this.now() });
      if (updates.username) tx.set(this.db.collection('publicProfiles').doc(uid), { userId: uid, username: updates.username });
    });
    return this.profile(uid);
  }
  async claim(uid: string) {
    return this.db.runTransaction(async tx => {
      const ref = this.db.collection('users').doc(uid), snap = await tx.get(ref);
      requireThat(snap.exists && !snap.get('disabled') && snap.get('cycleStart'), 'Active profile required', 403);
      const now = this.now(), p = claimDaily(snap.data() as Profile, now);
      tx.update(ref, { ...p, updatedAt: now });
      tx.create(this.db.collection('tokenLedger').doc(`daily_${uid}_${dayKey(now)}`), { userId: uid, delta: 2, reason: 'DAILY', at: now, cycleStart: p.cycleStart });
      return publicProfile(p, now);
    });
  }
  async submit(uid: string, roundId: string, price: unknown, requestId: string) {
    requireThat(/^[a-zA-Z0-9_-]{16,80}$/.test(requestId || ''), 'An idempotency key is required');
    const cents = priceToCents(price), roundRef = this.roundRef(roundId);
    const id = createHash('sha256').update(`${uid}:${requestId}`).digest('hex');
    const predictionRef = this.db.collection('predictions').doc(id), userRef = this.db.collection('users').doc(uid);
    const countRef = roundRef.collection('counts').doc(uid);
    return this.db.runTransaction(async tx => {
      const [prior, user, roundSnap, count] = await Promise.all([tx.get(predictionRef), tx.get(userRef), tx.get(roundRef), tx.get(countRef)]);
      requireThat(user.exists && !user.get('disabled') && user.get('cycleStart'), 'Active profile required', 403);
      if (prior.exists) {
        requireThat(prior.get('priceCents') === cents && prior.get('roundId') === roundId, 'Idempotency key already used', 409);
        return { entry: entryView(prior.data() as Entry, true), user: publicProfile(user.data() as Profile, this.now()) };
      }
      requireThat(roundSnap.exists, 'Round not available', 409);
      const round = roundSnap.data() as Round, now = this.now();
      requireThat(round.status === 'OPEN' && now >= round.openAt && now < round.lockAt, 'Prediction window is closed', 409);
      requireThat((count.get('value') || 0) < round.predictionCap, 'Per-round prediction limit reached', 409);
      const old = normalizeTokens(user.data() as Profile, now), p = spendPrediction(old, now);
      const entry: Entry = { id, userId: uid, username: p.username, roundId, priceCents: cents, submittedAtMs: now };
      tx.create(predictionRef, entry);
      tx.update(userRef, { ...p, updatedAt: now });
      tx.update(roundRef, { entryCount: round.entryCount + 1 });
      tx.set(countRef, { value: (count.get('value') || 0) + 1 });
      tx.create(this.db.collection('tokenLedger').doc(id), { userId: uid, delta: p.tokenBalance - old.tokenBalance, reason: 'PREDICTION_AND_STREAK', predictionId: id, at: now, cycleStart: p.cycleStart });
      return { entry: entryView(entry, true), user: publicProfile(p, now) };
    });
  }
  async createRound(day: string, poolCents: number, cap = 100) {
    const round = newRound(day, poolCents, cap), ref = this.roundRef(round.id);
    await this.db.runTransaction(async tx => {
      if ((await tx.get(ref)).exists) return;
      requireThat(this.now() < round.openAt, 'Round terms must be fixed before opening', 409);
      tx.create(ref, round);
    });
    return round.id;
  }
  async snapshot(roundId: string, uid?: string, after?: string) {
    const snap = await this.roundRef(roundId).get();
    requireThat(snap.exists, 'Round not scheduled yet', 404);
    const round = snap.data() as Round;
    let query = this.db.collection('predictions').where('roundId', '==', roundId).orderBy('__name__').limit(200);
    if (after) { requireThat(/^[a-f0-9]{64}$/.test(after), 'Invalid page cursor'); query = query.startAfter(after); }
    const entries = await query.get(), now = this.now();
    const published = round.status === 'ANNOUNCED' && now >= round.announceAt;
    const results = published ? await this.roundRef(roundId).collection('results').orderBy('rank').limit(100).get() : null;
    const mine = published && uid ? await this.roundRef(roundId).collection('results').doc(uid).get() : null;
    return { serverNow: now, round, entries: entries.docs.map(d => entryView(d.data() as Entry, now >= round.lockAt || d.get('userId') === uid)),
      nextCursor: entries.size === 200 ? entries.docs.at(-1)!.id : null,
      results: results?.docs.map(d => resultView(d.data() as Result)) || [], myResult: mine?.exists ? resultView(mine.data() as Result) : null };
  }
  async freeze(roundId: string) {
    const ref = this.roundRef(roundId);
    const round = await this.db.runTransaction(async tx => {
      const snap = await tx.get(ref); if (!snap.exists) return null;
      const r = snap.data() as Round, now = this.now();
      if (r.status !== 'OPEN' || now < r.lockAt) return null;
      if (now > r.lockAt + 1000) { tx.update(ref, { status: 'SUSPENDED', suspensionReason: 'Settlement window missed; no substitute price used.' }); return null; }
      tx.update(ref, { status: 'LOCKED' }); return r;
    });
    if (!round) return;
    try {
      const quotes = await this.quotes();
      const price = officialPrice(quotes, round.lockAt);
      await this.db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (snap.get('status') === 'LOCKED') tx.update(ref, { status: 'FROZEN', officialPriceCents: price, quotes, frozenAt: this.now() });
      });
    } catch (error) {
      await ref.update({ status: 'SUSPENDED', suspensionReason: error instanceof GameError ? error.message : 'Market sources unavailable; no substitute price used.' });
    }
  }
  async publish(roundId: string) {
    const ref = this.roundRef(roundId), snap = await ref.get();
    const round = snap.data() as Round | undefined;
    if (!round || round.status !== 'FROZEN' || this.now() < round.announceAt) return;
    const entries = (await this.db.collection('predictions').where('roundId', '==', roundId).get()).docs.map(d => d.data() as Entry);
    const ranked = rankEntries(entries, round);
    const audit = { rulesVersion: round.rulesVersion, roundId, lockAt: round.lockAt, announceAt: round.announceAt,
      officialPriceCents: round.officialPriceCents, poolCents: round.poolCents, quotes: round.quotes,
      entries: entries.sort((a, b) => a.id < b.id ? -1 : 1), results: ranked };
    const hash = createHash('sha256').update(JSON.stringify(audit)).digest('hex');
    const writer = this.db.bulkWriter();
    const writes = ranked.map(result => writer.set(ref.collection('results').doc(result.userId), result));
    await writer.close(); await Promise.all(writes);
    // No partial results are public: the round gate changes only after all writes succeed.
    await this.db.runTransaction(async tx => {
      const current = await tx.get(ref);
      if (current.get('status') !== 'FROZEN') return;
      tx.update(ref, { status: 'ANNOUNCED', auditHash: hash, publishedAt: this.now(), winnerCount: Math.min(ranked.length, 100),
        allocatedCents: ranked.reduce((sum, p) => sum + p.prizeCents, 0), unallocatedCents: entries.length ? 0 : round.poolCents });
    });
  }
  async audit(roundId: string) {
    const ref = this.roundRef(roundId), round = (await ref.get()).data() as Round | undefined;
    requireThat(round?.status === 'ANNOUNCED' && this.now() >= round.announceAt, 'Audit not published', 409);
    const entries = (await this.db.collection('predictions').where('roundId', '==', roundId).get()).docs.map(d => d.data() as Entry);
    return { rulesVersion: round.rulesVersion, roundId, lockAt: round.lockAt, announceAt: round.announceAt,
      officialPriceCents: round.officialPriceCents, poolCents: round.poolCents, quotes: round.quotes,
      entries: entries.sort((a, b) => a.id < b.id ? -1 : 1), results: rankEntries(entries, round) };
  }
  async kyc(uid: string, data: Record<string, unknown>) {
    const p = await this.profile(uid); requireThat(p, 'Profile required', 403);
    const request = { userId: uid, documentType: text(data.kycDocumentType, 60), destination: text(data.walletAddress, 120), status: 'PENDING', requestedAt: this.now() };
    const batch = this.db.batch();
    batch.set(this.db.collection('kycRequests').doc(uid), request);
    batch.update(this.db.collection('users').doc(uid), { kycStatus: 'PENDING', kycDocumentType: request.documentType, walletAddress: request.destination });
    await batch.commit(); return this.profile(uid);
  }
  async sendChat(uid: string, roundId: string, message: unknown) {
    const content = text(message, 280);
    requireThat(!/(https?:\/\/|www\.)/i.test(content), 'Links are not allowed');
    const roundRef = this.roundRef(roundId), userRef = this.db.collection('users').doc(uid), id = randomUUID();
    return this.db.runTransaction(async tx => {
      const [user, round] = await Promise.all([tx.get(userRef), tx.get(roundRef)]);
      requireThat(user.exists && !user.get('disabled') && round.exists, 'Active account and round required', 403);
      const now = this.now(); requireThat(now - (user.get('lastChatAt') || 0) >= 3000, 'Wait three seconds between messages', 429);
      const msg = { id, userId: uid, username: user.get('username'), roundId, message: content, createdAt: now,
        timestamp: new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }).format(now), avatarUrl: '' };
      tx.create(this.db.collection('chatMessages').doc(id), msg); tx.update(userRef, { lastChatAt: now }); return msg;
    });
  }
  async chat(roundId: string, uid: string) {
    this.roundRef(roundId);
    const [messages, blocks] = await Promise.all([this.db.collection('chatMessages').where('roundId', '==', roundId).orderBy('createdAt', 'desc').limit(100).get(),
      this.db.collection('users').doc(uid).collection('blocks').get()]);
    const hidden = new Set(blocks.docs.map(d => d.id));
    return messages.docs.map(d => d.data()).filter(d => !hidden.has(d.userId) && !d.removed).reverse();
  }
  async report(uid: string, messageId: string) {
    requireThat(/^[a-zA-Z0-9_-]{1,128}$/.test(messageId), 'Invalid message ID');
    requireThat((await this.db.collection('chatMessages').doc(messageId).get()).exists, 'Message not found', 404);
    await this.db.collection('moderationReports').doc(`${uid}_${messageId}`).set({ userId: uid, messageId, status: 'OPEN', createdAt: this.now() });
  }
  async block(uid: string, other: string) {
    requireThat(/^[a-zA-Z0-9_-]{1,128}$/.test(other) && uid !== other, 'Invalid user');
    await this.db.collection('users').doc(uid).collection('blocks').doc(other).set({ createdAt: this.now() });
  }
}
