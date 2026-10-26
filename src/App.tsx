/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChatMessage,
  ExchangeQuote,
  PredictionEntry,
  PreviousWinner,
  RoundPhase,
  UserProfile,
} from './types/game';
import {
  AmsterdamClockDetails,
  getAmsterdamClockDetails,
} from './utils/amsterdamTime';
import {
  calculateMedianPrice,
  fetchLiveExchangeQuotes,
  generate7DayChartData,
  ChartPoint,
} from './services/marketData';
import { calculateRankingsAndPrizes } from './services/rankingAndPrizes';
import {
  INITIAL_CHAT_MESSAGES,
  INITIAL_COMMUNITY_SUBMISSIONS,
  INITIAL_PREVIOUS_WINNERS,
  INITIAL_USER,
} from './services/seedData';
import {
  auth,
  db,
  onAuthStateChanged,
  fetchFirestoreUserProfile,
  saveFirestorePrediction,
  saveFirestoreChatMessage,
  handleFirestoreError,
  OperationType,
} from './services/firebase';
import {
  getActiveSessionUser,
  setActiveSessionUser,
  syncUserUpdate,
  logoutCurrentUser,
} from './services/authService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Header } from './components/Header';
import { SponsorBanner } from './components/SponsorBanner';
import { LiveChart } from './components/LiveChart';
import { PredictionBox } from './components/PredictionBox';
import { SubmissionsList } from './components/SubmissionsList';
import { PreviousWinners } from './components/PreviousWinners';
import { GlobalChat } from './components/GlobalChat';
import { LiveStudioModal } from './components/LiveStudioModal';
import { ResultsModal } from './components/ResultsModal';
import { UserProfileModal } from './components/UserProfileModal';
import { RulesTransparencyModal } from './components/RulesTransparencyModal';
import { AuthModal, AuthModalMode } from './components/AuthModal';
import { CheckCircle2, SlidersHorizontal, X } from 'lucide-react';

export default function App() {
  // Amsterdam Clock & Simulated Phase Override (defaults to real-time clock)
  const [clock, setClock] = useState<AmsterdamClockDetails>(() => getAmsterdamClockDetails());
  const [phaseOverride, setPhaseOverride] = useState<RoundPhase | null>(null);

  // User Session State (supports logged-in UserProfile or null when logged out)
  const [user, setUser] = useState<UserProfile | null>(() => {
    const active = getActiveSessionUser();
    if (active) return active;
    // Check if user explicitly logged out previously
    const explicitlyLoggedOut = localStorage.getItem('apex_explicit_logout') === 'true';
    if (explicitlyLoggedOut) return null;
    setActiveSessionUser(INITIAL_USER, 'email');
    return INITIAL_USER;
  });

  // Track unverified Firebase email address (0 tokens until verified)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  // Auth Banner Notification
  const [authBanner, setAuthBanner] = useState<string | null>(null);

  // Exchange Quotes & Live Price
  const [exchangeQuotes, setExchangeQuotes] = useState<ExchangeQuote[]>([
    { exchange: 'Coinbase', price: 64801.20, timestamp: Date.now(), latencyMs: 140, status: 'VALID' },
    { exchange: 'Binance', price: 64798.40, timestamp: Date.now(), latencyMs: 95, status: 'VALID' },
    { exchange: 'Kraken', price: 64805.70, timestamp: Date.now(), latencyMs: 160, status: 'VALID' },
  ]);

  const [currentSpotPrice, setCurrentSpotPrice] = useState<number>(64801.20);
  const [officialSettlementPrice, setOfficialSettlementPrice] = useState<number>(64801.20);
  const [chartData] = useState<ChartPoint[]>(() => generate7DayChartData(64801.20));

  // Submissions & Previous Winners
  const [submissions, setSubmissions] = useState<PredictionEntry[]>(() => {
    const saved = localStorage.getItem('apex_submissions');
    return saved ? JSON.parse(saved) : INITIAL_COMMUNITY_SUBMISSIONS;
  });

  const [previousWinners] = useState<PreviousWinner[]>(INITIAL_PREVIOUS_WINNERS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('apex_chat_messages');
    return saved ? JSON.parse(saved) : INITIAL_CHAT_MESSAGES;
  });

  // Modals state
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');

  // Cash prize pool ($30,000 baseline)
  const totalCashPool = 30000;
  const currentRoundId = `round_${clock.dateString.replace(/-/g, '')}`;

  // Listen to Firebase Auth state changes and enforce email verification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        if (!fbUser.emailVerified) {
          setUnverifiedEmail(fbUser.email || 'pending@email');
          setUser(null);
          return;
        }
        setUnverifiedEmail(null);
        try {
          const profile = await fetchFirestoreUserProfile(fbUser.uid);
          if (profile) {
            localStorage.removeItem('apex_explicit_logout');
            setActiveSessionUser(profile, 'google');
            setUser(profile);
          }
        } catch {
          // Profile may still be in onboarding or pending activation
        }
      } else {
        setUnverifiedEmail(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time Firestore listener when authenticated & email verified via Firebase Auth
  useEffect(() => {
    if (!auth.currentUser || !auth.currentUser.emailVerified) return;

    const predQuery = query(
      collection(db, 'predictions'),
      where('roundId', '==', currentRoundId)
    );
    const unsubPred = onSnapshot(
      predQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const remotePreds: PredictionEntry[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: data.id,
              userId: data.userId,
              username: data.username,
              avatarUrl: data.avatarUrl || '',
              predictedPrice: data.predictedPrice,
              submittedAt: data.submittedAt,
              submittedTimestamp: data.submittedTimestamp,
              roundId: data.roundId,
            };
          });
          setSubmissions((prev) => {
            const existingIds = new Set(remotePreds.map((r) => r.id));
            const merged = [...remotePreds, ...prev.filter((p) => !existingIds.has(p.id))];
            merged.sort((a, b) => b.submittedTimestamp - a.submittedTimestamp);
            return merged;
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'predictions');
      }
    );

    const chatQuery = query(
      collection(db, 'chatMessages'),
      where('roundId', '==', currentRoundId)
    );
    const unsubChat = onSnapshot(
      chatQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const remoteMsgs: ChatMessage[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: data.id,
              userId: data.userId,
              username: data.username,
              avatarUrl: data.avatarUrl || '',
              message: data.message,
              timestamp: data.timestamp,
            };
          });
          setChatMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newItems = remoteMsgs.filter((r) => !existingIds.has(r.id));
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'chatMessages');
      }
    );

    return () => {
      unsubPred();
      unsubChat();
    };
  }, [currentRoundId, user?.id]);

  // Persist submissions & chat locally as well
  useEffect(() => {
    localStorage.setItem('apex_submissions', JSON.stringify(submissions));
  }, [submissions]);

  useEffect(() => {
    localStorage.setItem('apex_chat_messages', JSON.stringify(chatMessages));
  }, [chatMessages]);

  // Tick clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      const details = getAmsterdamClockDetails();
      if (phaseOverride) {
        details.phase = phaseOverride;
        if (phaseOverride === 'OPEN') details.phaseLabel = 'Prediction Window Open (12:00–20:00)';
        if (phaseOverride === 'LOCKED_LIVE') details.phaseLabel = 'Locked — Live Studio Active (20:00–22:00)';
        if (phaseOverride === 'ANNOUNCED') details.phaseLabel = 'Winners Announced (22:00)';
        if (phaseOverride === 'PRE_OPEN') details.phaseLabel = 'Pre-Window (< 12:00)';
      }
      setClock(details);
    }, 1000);

    return () => clearInterval(interval);
  }, [phaseOverride]);

  // Polling live exchange quotes every 4.5 seconds
  useEffect(() => {
    let isMounted = true;

    const pollQuotes = async () => {
      try {
        const quotes = await fetchLiveExchangeQuotes(currentSpotPrice);
        if (!isMounted) return;
        setExchangeQuotes(quotes);
        const { median } = calculateMedianPrice(quotes);
        setCurrentSpotPrice(median);
        if (clock.phase === 'OPEN' || clock.phase === 'PRE_OPEN') {
          setOfficialSettlementPrice(median);
        }
      } catch {
        // Fallback handled inside service
      }
    };

    pollQuotes();
    const interval = setInterval(pollQuotes, 4500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [clock.phase, currentSpotPrice]);

  const handleOpenAuth = useCallback((mode: AuthModalMode) => {
    setAuthModalMode(mode);
    setIsAuthOpen(true);
  }, []);

  const handleAuthSuccess = useCallback((loggedInUser: UserProfile, isNewRegistration?: boolean) => {
    localStorage.removeItem('apex_explicit_logout');
    setUnverifiedEmail(null);
    setUser(loggedInUser);
    if (isNewRegistration) {
      setAuthBanner(
        `Welcome to ApexPredict, ${loggedInUser.username}! Your email is verified and 5 Free Welcome Tokens have been credited.`
      );
    } else {
      setAuthBanner(`Welcome back, ${loggedInUser.username}! You are now signed in.`);
    }
    setTimeout(() => setAuthBanner(null), 6000);
  }, []);

  const handleLogout = useCallback(async () => {
    const previousName = user?.username;
    localStorage.setItem('apex_explicit_logout', 'true');
    await logoutCurrentUser();
    setUser(null);
    setUnverifiedEmail(null);
    setIsProfileOpen(false);
    setAuthBanner(previousName ? `Signed out of ${previousName}. See you for the 20:00 price freeze!` : 'You have logged out.');
    setTimeout(() => setAuthBanner(null), 5000);
  }, [user]);

  const handleAccountDeleted = useCallback((deletedUsername: string) => {
    localStorage.setItem('apex_explicit_logout', 'true');
    setUser(null);
    setUnverifiedEmail(null);
    setIsProfileOpen(false);
    setAuthBanner(
      `Account "${deletedUsername}" has been verified and permanently deleted.`
    );
    setTimeout(() => setAuthBanner(null), 6000);
  }, []);

  // Handle user prediction submission
  const handleSubmitPrediction = useCallback(
    (predictedPrice: number): { success: boolean; error?: string } => {
      if (!user) {
        handleOpenAuth('login');
        return { success: false, error: 'Please log in to submit a prediction.' };
      }

      if (user.tokenBalance < 1) {
        return { success: false, error: 'Insufficient tokens. 1 Token is required per prediction.' };
      }

      if (clock.phase !== 'OPEN') {
        return { success: false, error: 'Prediction window is closed. Predictions accepted 12:00 to 20:00 Amsterdam time.' };
      }

      const now = new Date();
      const newEntry: PredictionEntry = {
        id: `pred_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        userId: user.id,
        username: user.username,
        avatarUrl: '',
        predictedPrice,
        submittedAt: now.toISOString(),
        submittedTimestamp: Date.now(),
        roundId: currentRoundId,
      };

      // Consume 1 token and advance daily streak if not yet predicted today (Section 21 & 22)
      const isFirstToday = user.lastPredictionDate !== clock.dateString;
      const updatedFields: Partial<UserProfile> = {
        tokenBalance: Math.max(0, user.tokenBalance - 1),
        lastPredictionDate: clock.dateString,
        streakDay: isFirstToday ? (user.streakDay >= 7 ? 1 : user.streakDay + 1) : user.streakDay,
      };

      syncUserUpdate(user, updatedFields).then((synced) => setUser(synced));

      // Add to immutable submissions
      setSubmissions((prev) => [newEntry, ...prev]);

      // Persist to Firestore if authenticated via Firebase
      if (auth.currentUser && auth.currentUser.uid === user.id) {
        saveFirestorePrediction(newEntry).catch(() => {});
      }

      // Add a chat announcement
      const systemAnnouncement: ChatMessage = {
        id: `sys_${Date.now()}`,
        userId: 'system',
        username: 'System Broadcast',
        avatarUrl: '',
        message: `${user.username} locked in an immutable prediction for today's 20:00 settlement!`,
        timestamp: clock.timeString.slice(0, 5),
        isSystem: true,
      };
      setChatMessages((prev) => [...prev, systemAnnouncement]);

      return { success: true };
    },
    [user, clock, currentRoundId, handleOpenAuth]
  );

  // Handle user chat message
  const handleSendMessage = useCallback(
    (text: string): { success: boolean; error?: string } => {
      if (!user) {
        handleOpenAuth('login');
        return { success: false, error: 'Please log in to chat.' };
      }

      const newMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        userId: user.id,
        username: user.username,
        avatarUrl: '',
        message: text,
        timestamp: clock.timeString.slice(0, 5),
      };
      setChatMessages((prev) => [...prev, newMsg]);

      if (auth.currentUser && auth.currentUser.uid === user.id) {
        saveFirestoreChatMessage(newMsg, currentRoundId).catch(() => {});
      }

      return { success: true };
    },
    [user, clock, currentRoundId, handleOpenAuth]
  );

  // Daily tokens claim (Section 4)
  const handleClaimDailyTokens = useCallback(() => {
    if (!user) return;
    syncUserUpdate(user, {
      tokenBalance: user.tokenBalance + 2,
      streakClaimedToday: true,
    }).then((synced) => setUser(synced));
  }, [user]);

  // Update profile
  const handleUpdateUser = useCallback(
    (updated: Partial<UserProfile>) => {
      if (!user) return;
      syncUserUpdate(user, updated).then((synced) => setUser(synced));
    },
    [user]
  );

  // Compute live rankings
  const rankedPredictions = calculateRankingsAndPrizes(
    submissions,
    officialSettlementPrice,
    totalCashPool
  );

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header */}
      <Header
        clock={clock}
        user={user}
        unverifiedEmail={unverifiedEmail}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenRules={() => setIsRulesOpen(true)}
        onOpenStudio={() => setIsStudioOpen(true)}
        onOpenResults={() => setIsResultsOpen(true)}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      {/* Authentication Status Toast Banner */}
      {authBanner && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">{authBanner}</span>
            </div>
            <button
              onClick={() => setAuthBanner(null)}
              className="text-emerald-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Viewport: Full 1440px desktop presence */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* Top Hero Banner matching image.png "Sponsor Banner" */}
        <SponsorBanner />

        {/* 3-Column Grid Layout matching image.png wireframe */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (3 cols): "Previous winners" & Prize Distribution */}
          <div className="lg:col-span-3">
            <PreviousWinners
              winners={previousWinners}
              totalPoolCash={totalCashPool}
            />
          </div>

          {/* Middle Column (6 cols): Live Chart, Prediction Box, Submissions List */}
          <div className="lg:col-span-6 space-y-6">
            {/* Live Line Chart matching image.png */}
            <LiveChart
              data={chartData}
              currentPrice={currentSpotPrice}
            />

            {/* Prediction Input Box & Confirmation matching image.png */}
            <PredictionBox
              currentSpotPrice={currentSpotPrice}
              clock={clock}
              user={user}
              unverifiedEmail={unverifiedEmail}
              onSubmitPrediction={handleSubmitPrediction}
              onOpenAuth={handleOpenAuth}
            />

            {/* Submissions List matching image.png */}
            <SubmissionsList
              submissions={submissions}
              clock={clock}
              currentUserId={user?.id || ''}
            />
          </div>

          {/* Right Column (3 cols): "Global chat" */}
          <div className="lg:col-span-3">
            <GlobalChat
              messages={chatMessages}
              currentUser={user}
              onSendMessage={handleSendMessage}
              onOpenAuth={handleOpenAuth}
            />
          </div>
        </div>

        {/* Auditor & Compliance Timeline Switcher */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <span>
              <strong>Tournament Lifecycle Inspector:</strong> Testing real-time Europe/Amsterdam round transitions
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setPhaseOverride(null)}
              className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold transition-colors cursor-pointer ${
                phaseOverride === null
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Real Clock ({clock.phase})
            </button>
            <button
              onClick={() => setPhaseOverride('OPEN')}
              className={`px-2.5 py-1.5 rounded-lg font-mono text-[11px] font-medium transition-colors cursor-pointer ${
                phaseOverride === 'OPEN'
                  ? 'bg-teal-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              12:00 Open
            </button>
            <button
              onClick={() => {
                setPhaseOverride('LOCKED_LIVE');
                setIsStudioOpen(true);
              }}
              className={`px-2.5 py-1.5 rounded-lg font-mono text-[11px] font-medium transition-colors cursor-pointer ${
                phaseOverride === 'LOCKED_LIVE'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              20:00 Freeze & Live Studio
            </button>
            <button
              onClick={() => {
                setPhaseOverride('ANNOUNCED');
                setIsResultsOpen(true);
              }}
              className={`px-2.5 py-1.5 rounded-lg font-mono text-[11px] font-medium transition-colors cursor-pointer ${
                phaseOverride === 'ANNOUNCED'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              22:00 Announced Results
            </button>
          </div>
        </div>
      </main>

      {/* Footer conforming to Universal Constitution */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">ApexPredict</span>
            <span>·</span>
            <span>Game Rules v2.2 Compliant Platform Baseline</span>
            <span>·</span>
            <span className="text-cyan-400/90 font-mono">Europe/Amsterdam (IANA)</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button onClick={() => setIsRulesOpen(true)} className="hover:text-white transition-colors cursor-pointer">
              Rules Baseline v2.2
            </button>
            <span>·</span>
            <button onClick={() => setIsResultsOpen(true)} className="hover:text-white transition-colors cursor-pointer">
              Audit Transparency
            </button>
            <span>·</span>
            <span>© 2026 ApexPredict. All rights reserved.</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authModalMode}
        initialPendingEmail={unverifiedEmail}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <LiveStudioModal
        isOpen={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
        clock={clock}
        officialSettlementPrice={officialSettlementPrice}
        exchangeQuotes={exchangeQuotes}
        totalPredictionsCount={submissions.length}
      />

      <ResultsModal
        isOpen={isResultsOpen}
        onClose={() => setIsResultsOpen(false)}
        clock={clock}
        officialSettlementPrice={officialSettlementPrice}
        rankedPredictions={rankedPredictions}
        currentUser={user}
        totalCashPool={totalCashPool}
        onStartKycClaim={() => {
          setIsResultsOpen(false);
          if (user) {
            setIsProfileOpen(true);
          } else {
            handleOpenAuth('login');
          }
        }}
      />

      {user && (
        <UserProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          user={user}
          onUpdateUser={handleUpdateUser}
          onClaimDailyTokens={handleClaimDailyTokens}
          onLogout={handleLogout}
          onAccountDeleted={handleAccountDeleted}
        />
      )}

      <RulesTransparencyModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />
    </div>
  );
}
