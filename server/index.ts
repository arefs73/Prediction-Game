import 'dotenv/config';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { resolve } from 'node:path';
import { GameService } from './gameService.ts';
import { GameError, dayKey, addDays, atAmsterdam, requireThat } from './domain.ts';
import { fetchQuotes } from './market.ts';

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('Set FIREBASE_PROJECT_ID explicitly.');
if (process.env.NODE_ENV === 'production' && (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)) throw new Error('Emulator authentication forbidden in production');
initializeApp({ projectId, ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : { credential: applicationDefault() }) });
const service = new GameService(getFirestore(process.env.FIRESTORE_DATABASE_ID || '(default)'));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); next(); });
app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api', async (req, res, next) => {
  try {
    if (req.headers.authorization) {
      requireThat(req.headers.authorization.startsWith('Bearer '), 'Invalid authorization', 401);
      const token = await getAuth().verifyIdToken(req.headers.authorization.slice(7), true);
      requireThat(token.email_verified === true, 'Verify your email first', 403);
      res.locals.identity = token;
    }
    next();
  } catch { res.status(401).json({ error: 'Sign in with a verified account' }); }
});
const identity = (res: express.Response) => { requireThat(res.locals.identity, 'Sign in first', 401); return res.locals.identity; };
const route = (fn: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => { void fn(req, res).then(value => res.json(value === undefined ? { success: true } : value)).catch(next); };
app.get('/api/rounds/current', route((_req, res) => service.snapshot('round_' + dayKey(Date.now()).replaceAll('-', ''), res.locals.identity?.uid)));
app.get('/api/rounds/:id', route((req, res) => service.snapshot(req.params.id, res.locals.identity?.uid, typeof req.query.after === 'string' ? req.query.after : undefined)));
app.get('/api/rounds/:id/audit', route(req => service.audit(req.params.id)));
app.get('/api/me', route((_req, res) => service.profile(identity(res).uid)));
app.post('/api/me', route((req, res) => { const who = identity(res); return service.register(who.uid, who.email, req.body); }));
app.patch('/api/me', route((req, res) => service.updateProfile(identity(res).uid, req.body)));
app.post('/api/tokens/claim', route((_req, res) => service.claim(identity(res).uid)));
app.post('/api/predictions', route((req, res) => service.submit(identity(res).uid, String(req.body.roundId), req.body.predictedPrice, req.body.requestId)));
app.post('/api/kyc', route((req, res) => service.kyc(identity(res).uid, req.body)));
app.get('/api/chat/:roundId', route((req, res) => service.chat(req.params.roundId, identity(res).uid)));
app.post('/api/chat/:roundId', route((req, res) => service.sendChat(identity(res).uid, req.params.roundId, req.body.message)));
app.post('/api/reports', route((req, res) => service.report(identity(res).uid, String(req.body.messageId))));
app.post('/api/blocks', route((req, res) => service.block(identity(res).uid, String(req.body.userId))));
// KYC approval and cash payouts require an independently verified provider integration.
app.delete('/api/me', route(async (_req, res) => {
  const who = identity(res);
  requireThat(Date.now() / 1000 - who.auth_time < 300, 'Reauthenticate before deleting', 401);
  await service.db.runTransaction(async tx => {
    const ref = service.db.collection('users').doc(who.uid), user = await tx.get(ref);
    requireThat(user.exists, 'Profile not found', 404);
    tx.set(ref, { userId: who.uid, disabled: true, deletedAt: Date.now() });
    tx.delete(service.db.collection('publicProfiles').doc(who.uid));
    tx.delete(service.db.collection('kycRequests').doc(who.uid));
  });
  await getAuth().deleteUser(who.uid);
}));
let cache: { at: number; quotes: Awaited<ReturnType<typeof fetchQuotes>> } | null = null;
let inFlight: Promise<void> | null = null;
app.get('/api/market', route(async () => {
  if (!cache || Date.now() - cache.at > 10_000) {
    inFlight ||= fetchQuotes().then(quotes => { cache = { at: Date.now(), quotes }; }).finally(() => { inFlight = null; });
    await inFlight;
  }
  const quotes = cache!.quotes;
  requireThat(quotes.length >= 2, 'Live prices temporarily unavailable', 503);
  const sorted = quotes.map(q => q.priceCents).sort((a, b) => a - b);
  return { quotes, price: (sorted.length === 3 ? sorted[1] : Math.round((sorted[0] + sorted[1]) / 2)) / 100 };
}));
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Endpoint not found' }); });
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof GameError) res.status(error.status).json({ error: error.message });
  else { console.error('Request failed', error); res.status(500).json({ error: 'Request failed. Please retry safely.' }); }
});
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve('dist')));
  app.get('*', (_req, res) => res.sendFile(resolve('dist/index.html')));
}
const server = app.listen(Number(process.env.PORT || 3001), '0.0.0.0');
let stopped = false;
async function tick() {
  if (stopped) return;
  try {
    const now = Date.now(), day = dayKey(now);
    if (process.env.ROUND_POOL_CENTS !== undefined) {
      const pool = Number(process.env.ROUND_POOL_CENTS), cap = Number(process.env.ROUND_PREDICTION_CAP || 100);
      if (now < atAmsterdam(day, 12)) await service.createRound(day, pool, cap);
      await service.createRound(addDays(day, 1), pool, cap);
    }
    const rounds = await service.db.collection('rounds').where('status', 'in', ['OPEN', 'LOCKED', 'FROZEN']).get();
    for (const doc of rounds.docs) {
      const r = doc.data();
      if (r.status === 'LOCKED' && now > r.lockAt + 5000) await doc.ref.update({ status: 'SUSPENDED', suspensionReason: 'Interrupted capture; manual review required.' });
      await service.freeze(doc.id);
      await service.publish(doc.id);
    }
  } catch (error) { console.error('Round worker failed', error); }
  const remaining = atAmsterdam(dayKey(Date.now()), 20) - Date.now();
  setTimeout(tick, remaining > 0 ? Math.max(10, Math.min(30_000, remaining)) : 30_000).unref();
}
if (process.env.ENABLE_ROUND_WORKER === 'true') void tick();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopped = true; server.close(); });
