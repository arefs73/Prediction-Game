import React, { useState, useEffect, useCallback } from 'react';
import type { ChatMessage, ExchangeQuote, PredictionEntry, UserProfile } from './types/game';
import { getAmsterdamClockDetails } from './utils/amsterdamTime';
import { api, auth, onAuthStateChanged, fetchFirestoreUserProfile } from './services/firebase';
import { logoutCurrentUser, syncUserUpdate } from './services/authService';
import type { RankedPrediction } from './services/rankingAndPrizes';
import { Header } from './components/Header';
import { SponsorBanner } from './components/SponsorBanner';
import { PredictionBox } from './components/PredictionBox';
import { SubmissionsList } from './components/SubmissionsList';
import { GlobalChat } from './components/GlobalChat';
import { LiveStudioModal } from './components/LiveStudioModal';
import { ResultsModal } from './components/ResultsModal';
import { UserProfileModal } from './components/UserProfileModal';
import { RulesTransparencyModal } from './components/RulesTransparencyModal';
import { AuthModal } from './components/AuthModal';
import type { AuthModalMode } from './components/AuthModal';
import type { Round } from '../server/domain';

interface Snapshot {
  serverNow: number; round: Round; entries: PredictionEntry[]; results: RankedPrediction[];
  myResult: RankedPrediction | null; nextCursor: string | null;
}
export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [clock, setClock] = useState(() => getAmsterdamClockDetails());
  const [error, setError] = useState<string | null>(null);
  const [market, setMarket] = useState<{ price: number; quotes: any[] } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [modal, setModal] = useState<'auth'|'profile'|'results'|'studio'|'rules'|null>(null);
  const [authMode, setAuthMode] = useState<AuthModalMode>('login');
  const [hasMore, setHasMore] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<PredictionEntry[]>([]);
  const openAuth = useCallback((mode: AuthModalMode) => { setAuthMode(mode); setModal('auth'); }, []);

  useEffect(() => onAuthStateChanged(auth, fb => {
    setUser(null); setSubmissions([]); setMessages([]);
    setUnverifiedEmail(fb && !fb.emailVerified ? fb.email : null);
    if (fb?.emailVerified) void fetchFirestoreUserProfile(fb.uid).then(p => {
      if (auth.currentUser?.uid === fb.uid) setUser(p);
    }).catch(e => setError(e.message));
  }), []);

  const refresh = useCallback(async () => {
    const result = await api<Snapshot>('/rounds/current');
    // Replace current-round state; never merge cached or demo entries.
    setSnapshot(result); setSubmissions(result.entries); setHasMore(result.nextCursor);
    setError(result.round.status === 'SUSPENDED' ? result.round.suspensionReason || 'Round suspended' : null);
    return result;
  }, []);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const result = await api<Snapshot>('/rounds/current');
        if (!active) return;
        setSnapshot(result); setSubmissions(result.entries); setHasMore(result.nextCursor);
        setError(result.round.status === 'SUSPENDED' ? result.round.suspensionReason || 'Round suspended' : null);
      } catch (e) {
        if (active) { setSnapshot(null); setSubmissions([]); setHasMore(null); setError((e as Error).message); }
      }
    };
    void poll(); const timer = setInterval(poll, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [user?.id]);
  useEffect(() => {
    const received = performance.now(), serverNow = snapshot?.serverNow;
    const tick = () => {
      const details = getAmsterdamClockDetails(new Date(serverNow === undefined ? Date.now() : serverNow + performance.now() - received));
      if (!snapshot || snapshot.round.status === 'SUSPENDED') details.phase = 'PRE_OPEN';
      if (snapshot?.round.status === 'FROZEN' && details.phase === 'ANNOUNCED') details.phase = 'LOCKED_LIVE';
      setClock(details);
    };
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [snapshot]);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try { const data = await api<{ price: number; quotes: any[] }>('/market'); if (active) setMarket(data); }
      catch { if (active) setMarket(null); }
    };
    void poll(); const timer = setInterval(poll, 15000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!user || !snapshot) { setMessages([]); return; }
    let active = true;
    const poll = async () => {
      try { const data = await api<ChatMessage[]>('/chat/' + snapshot.round.id); if (active) setMessages(data); }
      catch (e) { if (active) setError((e as Error).message); }
    };
    void poll(); const timer = setInterval(poll, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [user?.id, snapshot?.round.id]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const timer = setInterval(() => { void api<UserProfile>('/me').then(p => { if (active) setUser(p); }).catch(e => { if (active) setError(e.message); }); }, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [user?.id]);

  const submit = async (price: number, requestId: string) => {
    if (!snapshot || !user) return { success: false, error: 'Sign in and wait for an open round.' };
    try {
      const data = await api<{ user: UserProfile; entry: PredictionEntry }>('/predictions', 'POST', {
        roundId: snapshot.round.id, predictedPrice: price, requestId,
      });
      setUser(data.user);
      // A failed subsequent refresh must not turn a committed submission into a failed request.
      setSubmissions(prev => [data.entry, ...prev.filter(p => p.id !== data.entry.id)]);
      void refresh().catch(e => setError(e.message));
      return { success: true };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  };
  const sendMessage = async (message: string) => {
    if (!snapshot) return { success: false, error: 'Round unavailable' };
    try {
      const msg = await api<ChatMessage>('/chat/' + snapshot.round.id, 'POST', { message });
      setMessages(prev => [...prev, msg]); return { success: true };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  };
  const updateUser = async (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('Sign in first');
    const updated = await syncUserUpdate(user, updates); setUser(updated);
  };
  const claim = async () => {
    try { setUser(await api<UserProfile>('/tokens/claim', 'POST')); }
    catch (e) { setError((e as Error).message); }
  };
  const logout = async () => { await logoutCurrentUser(); setUser(null); setModal(null); };
  const official = snapshot?.round.officialPriceCents === undefined ? null : snapshot.round.officialPriceCents / 100;
  const quotes: ExchangeQuote[] = (snapshot?.round.quotes || market?.quotes || []).map(q => ({
    exchange: q.exchange, price: q.priceCents / 100, timestamp: q.observedAt, latencyMs: q.latencyMs, status: 'VALID',
  }));
  const ranked = snapshot ? [...snapshot.results, ...(snapshot.myResult && !snapshot.results.some(p => p.id === snapshot.myResult!.id) ? [snapshot.myResult] : [])] : [];

  return <div className="min-h-screen bg-[#0b0f19] text-slate-100">
    <Header clock={clock} user={user} unverifiedEmail={unverifiedEmail} onOpenProfile={() => setModal('profile')}
      onOpenRules={() => setModal('rules')} onOpenStudio={() => setModal('studio')} onOpenResults={() => setModal('results')}
      onOpenAuth={openAuth} onLogout={logout} />
    <main className="max-w-7xl mx-auto p-5 space-y-5">
      <SponsorBanner />
      {error && <div role="alert" className="p-4 rounded bg-amber-950 text-amber-200">{error}</div>}
      <div className="flex gap-4 flex-wrap">
        <button onClick={() => setModal('rules')}>Game rules</button>
        <button onClick={() => setModal('studio')}>Price freeze & sources</button>
        <button onClick={() => setModal('results')}>Results at 22:00</button>
      </div>
      <div className="p-4 rounded bg-slate-900">
        Current BTC/USD: {market ? '$' + market.price.toFixed(2) : 'Temporarily unavailable'} ·
        Official frozen price: {official === null ? 'Awaiting server settlement' : '$' + official.toFixed(2)}
        <div>Round cash pool: {snapshot ? '$' + (snapshot.round.poolCents / 100).toFixed(2) : 'Not scheduled'}</div>
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <PredictionBox currentSpotPrice={market?.price || 0} clock={clock} user={user} unverifiedEmail={unverifiedEmail} onSubmitPrediction={submit} onOpenAuth={openAuth} />
          <SubmissionsList submissions={submissions} clock={clock} currentUserId={user?.id || ''} />
          {hasMore && <button onClick={async () => {
            try {
              const page = await api<Snapshot>('/rounds/' + snapshot!.round.id + '?after=' + hasMore);
              setSubmissions(prev => [...prev, ...page.entries.filter(p => !prev.some(v => v.id === p.id))]); setHasMore(page.nextCursor);
            } catch (e) { setError((e as Error).message); }
          }}>Load more predictions</button>}
        </div>
        <GlobalChat messages={messages} currentUser={user} onSendMessage={sendMessage} onOpenAuth={openAuth} />
      </div>
    </main>
    <AuthModal isOpen={modal === 'auth'} initialMode={authMode} initialPendingEmail={unverifiedEmail} onClose={() => setModal(null)}
      onAuthSuccess={p => { setUser(p); setUnverifiedEmail(null); setModal(null); }} />
    <LiveStudioModal isOpen={modal === 'studio'} onClose={() => setModal(null)} clock={clock} officialSettlementPrice={official} exchangeQuotes={quotes} totalPredictionsCount={snapshot?.round.entryCount || 0} />
    <ResultsModal isOpen={modal === 'results'} onClose={() => setModal(null)} clock={clock} officialSettlementPrice={official}
      rankedPredictions={ranked} currentUser={user} totalCashPool={(snapshot?.round.poolCents || 0) / 100}
      published={snapshot?.round.status === 'ANNOUNCED'} auditHash={snapshot?.round.auditHash} roundId={snapshot?.round.id}
      onStartKycClaim={() => user ? setModal('profile') : openAuth('login')} />
    {user && <UserProfileModal isOpen={modal === 'profile'} onClose={() => setModal(null)} user={user} onUpdateUser={updateUser}
      onClaimDailyTokens={claim} onLogout={logout} onAccountDeleted={() => { setUser(null); setModal(null); }} />}
    <RulesTransparencyModal isOpen={modal === 'rules'} onClose={() => setModal(null)} />
  </div>;
}
