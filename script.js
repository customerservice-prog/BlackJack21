// BlackJack 21 - Card Counting Trainer

const LS_KEY = 'bjStats';

const gameState = {
  currentSystem: 'highlow',
  deckCount: 4,
  isGameActive: false,
  deck: [],
  discardPile: [],
  runningCount: 0,
  trueCount: 0,
  currentCard: null,
  sessionStats: {
    startTime: null,
    correctAnswers: 0,
    totalAnswers: 0,
    cardsCountedInSession: 0,
  },
  stats: {
    totalSessions: 0,
    sessions: [],
    systemBreakdown: {
      highlow: { sessions: 0, totalAccuracy: 0 },
      omega2: { sessions: 0, totalAccuracy: 0 },
      wonghalves: { sessions: 0, totalAccuracy: 0 },
    },
  },
};

const CARD_VALUES = {
  highlow: {
    '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
    '7': 0, '8': 0, '9': 0,
    '10': -1, 'J': -1, 'Q': -1, 'K': -1, 'A': -1,
  },
  omega2: {
    '2': 1, '3': 1, '4': 2, '5': 2, '6': 2,
    '7': 1, '8': 0, '9': -1,
    '10': -2, 'J': -2, 'Q': -2, 'K': -2, 'A': -2,
  },
  wonghalves: {
    '2': 0.5, '3': 1, '4': 1, '5': 1.5, '6': 1,
    '7': 0.5, '8': 0, '9': -1,
    '10': -1, 'J': -1, 'Q': -1, 'K': -1, 'A': -0.5,
  },
};

const CARD_SUITS = ['♠', '♥', '♦', '♣'];
const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const SYSTEM_LABELS = {
  highlow: 'High-Low',
  omega2: 'Omega II',
  wonghalves: 'Wong Halves',
};

let submitLocked = false;
let streak = 0;
let penetrationWarned = false;
let feedbackTimer = null;
let livePlaySessionActive = false;

function defaultStats() {
  return {
    totalSessions: 0,
    sessions: [],
    systemBreakdown: {
      highlow: { sessions: 0, totalAccuracy: 0 },
      omega2: { sessions: 0, totalAccuracy: 0 },
      wonghalves: { sessions: 0, totalAccuracy: 0 },
    },
  };
}

function createDeck() {
  const deck = [];
  for (let d = 0; d < gameState.deckCount; d++) {
    for (const suit of CARD_SUITS) {
      for (const rank of CARD_RANKS) {
        deck.push({ rank, suit });
      }
    }
  }
  return deck;
}

function shuffleDeck() {
  const a = gameState.deck;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function drawCard() {
  if (gameState.deck.length === 0) {
    if (gameState.discardPile.length === 0) {
      gameState.deck = createDeck();
      shuffleDeck();
    } else {
      gameState.deck = shuffleArray(gameState.discardPile);
      gameState.discardPile = [];
    }
  }
  return gameState.deck.pop();
}

function getTotalCardsInShoe() {
  return gameState.deckCount * 52;
}

function getCorrectValue(card) {
  const table = CARD_VALUES[gameState.currentSystem];
  return table[card.rank];
}

function countsEqual(a, b) {
  return Math.abs(a - b) < 0.001;
}

function formatCountForDisplay(v) {
  if (countsEqual(v, 0)) return '0';
  if (Math.abs(v) === 0.5) return v > 0 ? '+0.5' : '-0.5';
  if (countsEqual(v, Math.round(v))) {
    const n = Math.round(v);
    return n > 0 ? `+${n}` : String(n);
  }
  return (v > 0 ? '+' : '') + v.toFixed(1);
}

function formatRunningDisplay(n) {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

function createCardHTML(card) {
  const red = card.suit === '♥' || card.suit === '♦';
  const cls = red ? 'playing-card red' : 'playing-card black';
  return `<div class="${cls}"><span class="rank">${card.rank}</span><span class="suit">${card.suit}</span></div>`;
}

function showFeedback(message, type) {
  const el = document.getElementById('feedback-area');
  if (!el) return;
  if (feedbackTimer) clearTimeout(feedbackTimer);
  const safe = message.length > 40 ? message.slice(0, 37) + '…' : message;
  el.innerHTML = `<div class="feedback-message ${type}">${safe}</div>`;
  feedbackTimer = setTimeout(() => {
    el.innerHTML = '';
    feedbackTimer = null;
  }, 1500);
}

function navigateSection(sectionName) {
  if (sectionName !== 'live' && livePlaySessionActive) {
    if (!confirm('Leave Live Play? Your session will end and show results.')) return;
    endLivePlaySession(false);
  }
  document.querySelectorAll('.section').forEach((s) => {
    s.classList.toggle('active', s.id === sectionName);
  });
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === sectionName);
  });
}

function updateLiveStats() {
  const remaining = gameState.deck.length;
  const total = getTotalCardsInShoe();
  const used = total - remaining;
  const decksRemaining = remaining / 52;
  gameState.trueCount = decksRemaining > 0
    ? gameState.runningCount / decksRemaining
    : 0;

  const rc = document.getElementById('running-count');
  const tc = document.getElementById('true-count');
  const cr = document.getElementById('cards-remaining');
  const pen = document.getElementById('penetration');
  const acc = document.getElementById('accuracy');
  const cc = document.getElementById('cards-counted');
  const sp = document.getElementById('speed');
  const st = document.getElementById('streak');

  if (rc) rc.textContent = formatRunningDisplay(gameState.runningCount);
  if (tc) tc.textContent = gameState.trueCount.toFixed(1);
  if (cr) cr.textContent = String(remaining);
  if (pen) {
    const pct = total > 0 ? (used / total) * 100 : 0;
    pen.textContent = `${Math.round(pct)}%`;
  }

  const { totalAnswers, correctAnswers, cardsCountedInSession, startTime } = gameState.sessionStats;
  if (acc) {
    const accPct = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;
    acc.textContent = `${Math.round(accPct)}%`;
  }
  if (cc) cc.textContent = String(cardsCountedInSession);
  if (st) st.textContent = String(streak);

  if (sp && startTime) {
    const mins = (Date.now() - startTime) / 60000;
    const cpm = mins > 0 ? cardsCountedInSession / mins : 0;
    sp.textContent = `${Math.round(cpm)} cards/min`;
  } else if (sp) {
    sp.textContent = '0 cards/min';
  }
}

function checkPenetration() {
  const total = getTotalCardsInShoe();
  const used = total - gameState.deck.length;
  const pct = total > 0 ? used / total : 0;
  if (!penetrationWarned && pct >= 0.75) {
    penetrationWarned = true;
    showFeedback('75% shoe—consider new shoe.', 'wrong');
  }
}

function showNextCard() {
  if (!gameState.isGameActive) return;
  checkPenetration();
  const card = drawCard();
  gameState.currentCard = card;
  const host = document.getElementById('current-card-display');
  if (host) host.innerHTML = createCardHTML(card);
  updateLiveStats();
}

function startNewGame() {
  const sys = document.getElementById('system-select');
  const dc = document.getElementById('deck-count');
  gameState.currentSystem = sys ? sys.value : 'highlow';
  gameState.deckCount = dc ? parseInt(dc.value, 10) : 4;

  gameState.deck = createDeck();
  gameState.discardPile = [];
  gameState.runningCount = 0;
  gameState.trueCount = 0;
  gameState.currentCard = null;
  gameState.sessionStats = {
    startTime: Date.now(),
    correctAnswers: 0,
    totalAnswers: 0,
    cardsCountedInSession: 0,
  };
  streak = 0;
  submitLocked = false;
  penetrationWarned = false;

  shuffleDeck();
  gameState.isGameActive = true;

  const fb = document.getElementById('feedback-area');
  if (fb) fb.innerHTML = '';

  showNextCard();
  updateLiveStats();
}

function submitCount(value) {
  if (!gameState.isGameActive || submitLocked || !gameState.currentCard) return;

  const correct = getCorrectValue(gameState.currentCard);
  const ok = countsEqual(value, correct);

  gameState.sessionStats.totalAnswers += 1;
  if (ok) {
    gameState.sessionStats.correctAnswers += 1;
    streak += 1;
    showFeedback('✓ Correct!', 'correct');
  } else {
    streak = 0;
    showFeedback(`✗ Wrong! Answer: ${formatCountForDisplay(correct)}`, 'wrong');
  }

  gameState.runningCount += correct;
  gameState.sessionStats.cardsCountedInSession += 1;
  gameState.discardPile.push(gameState.currentCard);
  gameState.currentCard = null;

  submitLocked = true;
  updateLiveStats();

  setTimeout(() => {
    submitLocked = false;
    showNextCard();
  }, 600);
}

function sessionAccuracyPct() {
  const { totalAnswers, correctAnswers } = gameState.sessionStats;
  if (totalAnswers === 0) return 0;
  return (correctAnswers / totalAnswers) * 100;
}

function sessionSpeedCpm() {
  const { startTime, cardsCountedInSession } = gameState.sessionStats;
  if (!startTime || cardsCountedInSession === 0) return 0;
  const mins = (Date.now() - startTime) / 60000;
  return mins > 0 ? cardsCountedInSession / mins : 0;
}

function endGame() {
  if (!gameState.isGameActive) {
    navigateSection('stats');
    updateStatsDisplay();
    return;
  }

  const { totalAnswers, cardsCountedInSession } = gameState.sessionStats;
  if (totalAnswers === 0) {
    gameState.isGameActive = false;
    alert('No cards counted this session.');
    navigateSection('stats');
    updateStatsDisplay();
    return;
  }

  const accuracy = sessionAccuracyPct();
  const speed = sessionSpeedCpm();
  const session = {
    timestamp: Date.now(),
    system: gameState.currentSystem,
    accuracy: Math.round(accuracy * 10) / 10,
    cardsCounted: cardsCountedInSession,
    deckCount: gameState.deckCount,
    speed: Math.round(speed * 10) / 10,
  };

  gameState.stats.sessions.push(session);
  gameState.stats.totalSessions += 1;

  const br = gameState.stats.systemBreakdown[gameState.currentSystem];
  if (br) {
    br.sessions += 1;
    br.totalAccuracy += session.accuracy;
  }

  saveStats();

  gameState.isGameActive = false;
  gameState.currentCard = null;
  const host = document.getElementById('current-card-display');
  if (host) host.innerHTML = '';

  alert(
    `Session complete!\nAccuracy: ${Math.round(accuracy)}%\nCards counted: ${cardsCountedInSession}`,
  );

  navigateSection('stats');
  updateStatsDisplay();
}

function saveStats() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(gameState.stats));
  } catch (e) {
    /* ignore quota */
  }
}

function loadStats() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const def = defaultStats();
    gameState.stats = {
      totalSessions: parsed.totalSessions ?? def.totalSessions,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      systemBreakdown: {
        highlow: { ...def.systemBreakdown.highlow, ...parsed.systemBreakdown?.highlow },
        omega2: { ...def.systemBreakdown.omega2, ...parsed.systemBreakdown?.omega2 },
        wonghalves: { ...def.systemBreakdown.wonghalves, ...parsed.systemBreakdown?.wonghalves },
      },
    };
  } catch (e) {
    gameState.stats = defaultStats();
  }
}

function resetAllStats() {
  if (!confirm('Clear all saved statistics?')) return;
  gameState.stats = defaultStats();
  saveStats();
  updateStatsDisplay();
}

function updateStatsDisplay() {
  const sessions = gameState.stats.sessions;
  const n = sessions.length;

  const totalSessionsEl = document.getElementById('total-sessions');
  const avgAccEl = document.getElementById('avg-accuracy');
  const bestEl = document.getElementById('best-accuracy');
  const avgSpEl = document.getElementById('avg-speed');

  if (totalSessionsEl) totalSessionsEl.textContent = String(gameState.stats.totalSessions);

  if (n > 0) {
    const sumAcc = sessions.reduce((s, x) => s + x.accuracy, 0);
    const avgAcc = sumAcc / n;
    const best = Math.max(...sessions.map((x) => x.accuracy));
    const sumSp = sessions.reduce((s, x) => s + (x.speed || 0), 0);
    const avgSp = sumSp / n;

    if (avgAccEl) avgAccEl.textContent = `${Math.round(avgAcc)}%`;
    if (bestEl) bestEl.textContent = `${Math.round(best)}%`;
    if (avgSpEl) avgSpEl.textContent = `${Math.round(avgSp)} cards/min`;
  } else {
    if (avgAccEl) avgAccEl.textContent = '0%';
    if (bestEl) bestEl.textContent = '0%';
    if (avgSpEl) avgSpEl.textContent = '0 cards/min';
  }

  const systems = ['highlow', 'omega2', 'wonghalves'];
  const rows = document.querySelectorAll('#system-stats .system-stat-row');
  systems.forEach((key, i) => {
    const br = gameState.stats.systemBreakdown[key];
    const row = rows[i];
    if (!row || !br) return;
    const cnt = row.querySelector('.system-count');
    const acc = row.querySelector('.system-accuracy');
    const avg = br.sessions > 0 ? br.totalAccuracy / br.sessions : 0;
    if (cnt) cnt.textContent = `${br.sessions} sessions`;
    if (acc) acc.textContent = `${Math.round(avg)}% avg`;
  });

  const recentHost = document.getElementById('recent-sessions');
  if (recentHost) {
    const last5 = [...sessions].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
    if (last5.length === 0) {
      recentHost.innerHTML = '<p class="no-data">No sessions yet. Start practicing!</p>';
    } else {
      recentHost.innerHTML = last5
        .map((s) => {
          const t = new Date(s.timestamp);
          const ts = t.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
          const name = SYSTEM_LABELS[s.system] || s.system;
          return `<div class="recent-session-row"><span class="rs-time">${ts}</span><span class="rs-sys">${name}</span><span class="rs-acc">${Math.round(s.accuracy)}%</span></div>`;
        })
        .join('');
    }
  }

  drawProgressChart();
}

function drawProgressChart() {
  const canvas = document.getElementById('progress-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  const w = (parent && parent.clientWidth) ? parent.clientWidth : 400;
  const h = 160;
  canvas.width = w;
  canvas.height = h;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);

  const sessions = gameState.stats.sessions;
  const now = new Date();
  const dayMs = 86400000;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push(d);
  }

  const counts = days.map((dayStart) => {
    const start = dayStart.getTime();
    const end = start + dayMs;
    return sessions.filter((s) => s.timestamp >= start && s.timestamp < end).length;
  });

  const max = Math.max(1, ...counts);
  const barW = (w - 40) / 7;
  const maxBarH = h - 50;

  days.forEach((d, i) => {
    const bh = (counts[i] / max) * maxBarH;
    const x = 20 + i * barW;
    const y = h - 30 - bh;
    ctx.fillStyle = '#1a6b3a';
    ctx.fillRect(x, y, barW - 4, bh);
    ctx.fillStyle = '#999';
    ctx.font = '10px sans-serif';
    ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, x, h - 8);
  });

  ctx.fillStyle = '#ccc';
  ctx.font = '12px sans-serif';
  ctx.fillText('Sessions per day (last 7 days)', 20, 16);
}

// --- Live Play (≤30 min): blackjack + basic strategy + bet vs true count ---

const LIVE_MAX_MS = 30 * 60 * 1000;
const LIVE_START_BANK = 1000;

const liveState = {
  active: false,
  endsAt: 0,
  timerId: null,
  deck: [],
  discard: [],
  runningCount: 0,
  system: 'highlow',
  deckCount: 6,
  bankroll: LIVE_START_BANK,
  handsPlayed: 0,
  phase: 'idle',
  dealer: [],
  playerHands: [],
  activeHandIndex: 0,
  dealerHoleHidden: false,
  pendingBetUnits: 2,
  currentBetUnits: 2,
  decisionsTotal: 0,
  decisionsCorrect: 0,
  betsTotal: 0,
  betsGood: 0,
  misplayLog: [],
  betLog: [],
};

function liveCardCountValue(rank) {
  return CARD_VALUES[liveState.system][rank];
}

function rankToDealerUp(r) {
  if (r === 'A') return 11;
  if (r === '10' || r === 'J' || r === 'Q' || r === 'K') return 10;
  return parseInt(r, 10);
}

function bjRankValue(rank) {
  if (rank === 'A') return 11;
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return parseInt(rank, 10);
}

function analyzeHand(cards) {
  let total = 0;
  let acesAs11 = 0;
  for (const c of cards) {
    const v = bjRankValue(c.rank);
    if (v === 11) {
      acesAs11 += 1;
      total += 11;
    } else {
      total += v;
    }
  }
  while (total > 21 && acesAs11 > 0) {
    total -= 10;
    acesAs11 -= 1;
  }
  const soft = acesAs11 > 0;
  return { total, soft };
}

function isNatural(cards) {
  if (cards.length !== 2) return false;
  const { total } = analyzeHand(cards);
  return total === 21;
}

function isPair(cards) {
  return cards.length === 2 && cards[0].rank === cards[1].rank;
}

function canSplitRank(cards) {
  return cards.length === 2 && cards[0].rank === cards[1].rank;
}

/** Ideal units vs floored true count: min 1, scale up in +TC */
function idealBetUnitsFromTC(tc) {
  const f = Math.floor(tc + 1e-9);
  if (f <= 0) return 1;
  if (f === 1) return 2;
  if (f === 2) return 4;
  if (f === 3) return 6;
  return 8;
}

function betMatchesIdeal(playerUnits, ideal) {
  return playerUnits === ideal;
}

/** S17, DAS, multi-deck — surrender omitted */
function getOptimalAction(playerCards, dealerUpRank, canDouble, canSplit) {
  const d = rankToDealerUp(dealerUpRank);

  if (playerCards.length === 2 && canSplitRank(playerCards)) {
    const r = playerCards[0].rank;
    if (r === '5') {
      return normalizeDoubleHard(10, d, canDouble);
    }
    if (r === '10' || r === 'J' || r === 'Q' || r === 'K') {
      return 'S';
    }
    if (r === 'A') return 'P';
    if (r === '8') return 'P';
    if (r === '9') {
      if (d >= 2 && d <= 6) return 'P';
      if (d === 7) return 'S';
      if (d === 8 || d === 9) return 'P';
      return 'S';
    }
    if (r === '7') {
      if (d >= 2 && d <= 7) return 'P';
      return 'H';
    }
    if (r === '6') {
      if (d >= 2 && d <= 6) return 'P';
      return 'H';
    }
    if (r === '4') {
      if (d === 5 || d === 6) return 'P';
      return 'H';
    }
    if (r === '3' || r === '2') {
      if (d >= 2 && d <= 7) return 'P';
      return 'H';
    }
  }

  const { total, soft } = analyzeHand(playerCards);
  if (soft && playerCards.length >= 2 && total <= 21) {
    return normalizeDoubleSoft(total, d, canDouble);
  }
  return normalizeDoubleHard(total, d, canDouble);
}

function normalizeDoubleHard(total, d, canDouble) {
  let a = hardOnly(total, d);
  if (a === 'D' && !canDouble) a = hardDoubleFallback(total, d);
  return a;
}

function normalizeDoubleSoft(total, d, canDouble) {
  let a = softOnly(total, d);
  if (a === 'D' && !canDouble) {
    if (total <= 17) return 'H';
    if (total === 18) {
      if (d >= 9) return 'H';
      return 'S';
    }
    return 'S';
  }
  return a;
}

function hardDoubleFallback(total, d) {
  if (total <= 11) return 'H';
  return 'S';
}

function hardOnly(total, d) {
  if (total >= 17) return 'S';
  if (total === 16) {
    if (d >= 2 && d <= 6) return 'S';
    return 'H';
  }
  if (total === 15) {
    if (d >= 2 && d <= 6) return 'S';
    return 'H';
  }
  if (total === 14 || total === 13) {
    if (d >= 2 && d <= 6) return 'S';
    return 'H';
  }
  if (total === 12) {
    if (d >= 4 && d <= 6) return 'S';
    return 'H';
  }
  if (total === 11) return 'D';
  if (total === 10) {
    if (d <= 9) return 'D';
    return 'H';
  }
  if (total === 9) {
    if (d >= 3 && d <= 6) return 'D';
    return 'H';
  }
  return 'H';
}

function softOnly(total, d) {
  if (total >= 20) return 'S';
  if (total === 19) return 'S';
  if (total === 18) {
    if (d >= 2 && d <= 6) return 'D';
    if (d === 7 || d === 8) return 'S';
    return 'H';
  }
  if (total === 17) {
    if (d >= 3 && d <= 6) return 'D';
    return 'H';
  }
  if (total === 16 || total === 15) {
    if (d >= 4 && d <= 6) return 'D';
    return 'H';
  }
  if (total === 14 || total === 13) {
    if (d >= 5 && d <= 6) return 'D';
    return 'H';
  }
  return 'H';
}

function actionLabel(code) {
  if (code === 'H') return 'Hit';
  if (code === 'S') return 'Stand';
  if (code === 'D') return 'Double';
  if (code === 'P') return 'Split';
  return code;
}

function recordPlayerDecision(chosen, playerCards, dealerUp) {
  const hi = liveState.playerHands[liveState.activeHandIndex];
  const canDouble =
    playerCards.length === 2 &&
    hi &&
    !hi.doubled &&
    liveState.bankroll >= hi.bet;
  const canSplit = canSplitRank(playerCards) && liveState.playerHands.length < 2;
  const opt = getOptimalAction(playerCards, dealerUp.rank, canDouble, canSplit);
  liveState.decisionsTotal += 1;
  const dealerVal = rankToDealerUp(dealerUp.rank);
  const { total, soft } = analyzeHand(playerCards);
  if (opt === chosen) {
    liveState.decisionsCorrect += 1;
  } else {
    const summary = `${soft ? 'Soft' : 'Hard'} ${total} vs ${dealerVal}: best ${actionLabel(opt)}, you ${actionLabel(chosen)}`;
    liveState.misplayLog.push(summary);
  }
}

function liveTrueCount() {
  const rem = liveState.deck.length;
  if (rem <= 0) return 0;
  return liveState.runningCount / (rem / 52);
}

function liveCreateShoe() {
  liveState.deckCount = parseInt(
    document.getElementById('live-deck-count')?.value || '6',
    10,
  );
  liveState.system = document.getElementById('live-system-select')?.value || 'highlow';
  const deck = [];
  for (let d = 0; d < liveState.deckCount; d++) {
    for (const suit of CARD_SUITS) {
      for (const rank of CARD_RANKS) {
        deck.push({ rank, suit });
      }
    }
  }
  return shuffleArray(deck);
}

function liveDrawCard() {
  if (liveState.deck.length === 0) {
    liveState.deck = shuffleArray(liveState.discard);
    liveState.discard = [];
    liveState.runningCount = 0;
  }
  const c = liveState.deck.pop();
  liveState.runningCount += liveCardCountValue(c.rank);
  return c;
}

function liveReturnToDiscard(cards) {
  for (const c of cards) {
    liveState.discard.push(c);
  }
}

function liveRefreshBetPills() {
  const sug = document.getElementById('live-suggested-value');
  const yours = document.getElementById('live-your-bet');
  const ideal = idealBetUnitsFromTC(liveTrueCount());
  if (sug) sug.textContent = String(ideal);
  if (yours) yours.textContent = String(liveState.pendingBetUnits ?? 2);

  document.querySelectorAll('#live-chips .live-chip').forEach((b) => {
    const u = parseInt(b.dataset.units, 10);
    const on = u === liveState.pendingBetUnits;
    b.classList.toggle('live-chip-selected', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  const pills = document.querySelector('.live-bet-row');
  if (pills) {
    const match = liveState.pendingBetUnits === ideal;
    const betPhase = liveState.phase === 'bet';
    pills.classList.toggle('live-bet-row--match', match && betPhase);
    pills.classList.toggle('live-bet-row--miss', !match && betPhase);
  }
}

function liveUpdateHud() {
  const rc = document.getElementById('live-running-count');
  const tc = document.getElementById('live-true-count');
  const br = document.getElementById('live-bankroll');
  const hp = document.getElementById('live-hands-played');
  const tleft = document.getElementById('live-time-left');
  const hint = document.getElementById('live-bet-hint');

  if (rc) rc.textContent = formatRunningDisplay(liveState.runningCount);
  if (tc) tc.textContent = liveTrueCount().toFixed(1);
  if (br) br.textContent = String(liveState.bankroll);
  if (hp) hp.textContent = String(liveState.handsPlayed);

  if (tleft && liveState.active && liveState.endsAt) {
    const ms = Math.max(0, liveState.endsAt - Date.now());
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    tleft.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  liveRefreshBetPills();

  if (hint) {
    const tcv = liveTrueCount();
    const phase = liveState.phase;
    if (phase === 'bet') {
      hint.textContent = `True count ≈ ${tcv.toFixed(1)} — match suggested bet if you can, then Deal.`;
    } else if (phase === 'play') {
      hint.textContent = 'Your move: Hit, Stand, Double, or Split (when lit).';
    } else if (phase === 'dealer') {
      hint.textContent = 'Dealer is drawing…';
    } else {
      hint.textContent = '';
    }
  }
}

function liveTick() {
  if (!liveState.active) return;
  liveUpdateHud();
  if (Date.now() >= liveState.endsAt) {
    endLivePlaySession(true);
  }
}

function startLivePlaySession() {
  if (liveState.active) return;
  liveState.deck = liveCreateShoe();
  liveState.discard = [];
  liveState.runningCount = 0;
  liveState.bankroll = LIVE_START_BANK;
  liveState.handsPlayed = 0;
  liveState.phase = 'bet';
  liveState.dealer = [];
  liveState.playerHands = [];
  liveState.misplayLog = [];
  liveState.betLog = [];
  liveState.decisionsTotal = 0;
  liveState.decisionsCorrect = 0;
  liveState.betsTotal = 0;
  liveState.betsGood = 0;
  liveState.pendingBetUnits = 2;
  liveState.active = true;
  livePlaySessionActive = true;
  liveState.endsAt = Date.now() + LIVE_MAX_MS;
  liveState.timerId = setInterval(liveTick, 500);

  document.getElementById('live-setup')?.setAttribute('hidden', 'true');
  document.getElementById('live-session')?.removeAttribute('hidden');
  document.getElementById('live-results')?.setAttribute('hidden', 'true');

  liveBindControls();
  liveRenderBetPanel();
  liveUpdateHud();
}

function liveRenderBetPanel() {
  document.getElementById('live-bet-panel')?.removeAttribute('hidden');
  document.getElementById('live-game-area')?.setAttribute('hidden', 'true');
  document.getElementById('live-actions')?.setAttribute('hidden', 'true');
  const fb = document.getElementById('live-feedback');
  if (fb) fb.innerHTML = '';
}

function liveBindControls() {
  document.querySelectorAll('#live-chips .live-chip').forEach((btn) => {
    btn.onclick = () => {
      liveState.pendingBetUnits = parseInt(btn.dataset.units, 10);
      liveRefreshBetPills();
    };
  });
  const firstChip = document.querySelector('#live-chips .live-chip[data-units="2"]');
  if (firstChip) firstChip.click();

  document.getElementById('live-deal-btn').onclick = liveDealHand;
  document.getElementById('live-hit').onclick = () => livePlayerAct('H');
  document.getElementById('live-stand').onclick = () => livePlayerAct('S');
  document.getElementById('live-double').onclick = () => livePlayerAct('D');
  document.getElementById('live-split').onclick = () => livePlayerAct('P');
  document.getElementById('live-end-session-btn').onclick = () => endLivePlaySession(false);
  document.getElementById('live-results-close').onclick = liveResetToSetup;
}

function liveResetToSetup() {
  document.getElementById('live-results')?.setAttribute('hidden', 'true');
  document.getElementById('live-setup')?.removeAttribute('hidden');
  document.getElementById('live-session')?.setAttribute('hidden', 'true');
}

function liveDealHand() {
  if (!liveState.active || liveState.phase !== 'bet') return;
  const bet = liveState.pendingBetUnits;
  if (bet < 1 || bet > liveState.bankroll) {
    const fb = document.getElementById('live-feedback');
    if (fb) {
      fb.innerHTML = '<div class="feedback-message wrong">Invalid bet amount.</div>';
    }
    return;
  }

  const tc = liveTrueCount();
  const ideal = idealBetUnitsFromTC(tc);
  liveState.betsTotal += 1;
  if (betMatchesIdeal(bet, ideal)) liveState.betsGood += 1;
  else {
    liveState.betLog.push(
      `TC ≈ ${tc.toFixed(1)}: you bet ${bet} units; suggested ${ideal} units.`,
    );
  }

  liveState.currentBetUnits = bet;
  liveState.bankroll -= bet;
  liveState.phase = 'play';
  liveState.dealer = [];
  liveState.playerHands = [{ cards: [], bet, doubled: false, stood: false }];
  liveState.activeHandIndex = 0;
  liveState.dealerHoleHidden = true;

  const p1 = liveDrawCard();
  const d1 = liveDrawCard();
  const p2 = liveDrawCard();
  const d2 = liveDrawCard();

  liveState.playerHands[0].cards.push(p1, p2);
  liveState.dealer.push(d1, d2);

  document.getElementById('live-bet-panel')?.setAttribute('hidden', 'true');
  document.getElementById('live-game-area')?.removeAttribute('hidden');
  document.getElementById('live-actions')?.removeAttribute('hidden');

  const upVal = rankToDealerUp(d1.rank);
  if (isNatural(liveState.playerHands[0].cards)) {
    if (isNatural(liveState.dealer)) {
      liveState.bankroll += bet;
      liveFinishHand('Both blackjack — push.');
    } else {
      liveState.bankroll += bet + Math.floor(bet * 1.5);
      liveFinishHand('Blackjack! You win 3:2.');
    }
    return;
  }

  if (isNatural(liveState.dealer)) {
    liveFinishHand('Dealer blackjack. You lose.');
    return;
  }

  liveRenderLiveTable();
  liveUpdateActionButtons();
  const fb = document.getElementById('live-phase-msg');
  if (fb) fb.textContent = 'Your move.';
  liveUpdateHud();
}

function liveRenderLiveTable() {
  const dealerEl = document.getElementById('live-dealer-cards');
  if (!dealerEl) return;
  if (liveState.dealerHoleHidden) {
    dealerEl.innerHTML =
      createCardHTML(liveState.dealer[0]) +
      '<div class="playing-card hidden-card">?</div>';
  } else {
    dealerEl.innerHTML = liveState.dealer.map((c) => createCardHTML(c)).join('');
  }
  const dt = analyzeHand(liveState.dealer);
  const dealerShow = liveState.dealerHoleHidden
    ? rankToDealerUp(liveState.dealer[0].rank)
    : dt.total;
  document.getElementById('live-dealer-total').textContent = liveState.dealerHoleHidden
    ? `Upcard: ${dealerShow}`
    : `Total: ${dt.total}`;

  const host = document.getElementById('live-player-blocks');
  if (!host) return;
  host.innerHTML = liveState.playerHands
    .map((h, i) => {
      const { total, soft } = analyzeHand(h.cards);
      const lab = liveState.playerHands.length > 1 ? `Hand ${i + 1}` : 'Your cards';
      const cardsHtml = h.cards.map((c) => createCardHTML(c)).join('');
      const active = i === liveState.activeHandIndex ? ' live-hand-active' : '';
      return `<div class="live-hand-block${active}"><h4>${lab}${h.doubled ? ' (doubled)' : ''}</h4><div class="live-cards">${cardsHtml}</div><p class="live-hand-total">${soft ? 'Soft ' : ''}${total}</p></div>`;
    })
    .join('');
}

function liveUpdateActionButtons() {
  const h = liveState.playerHands[liveState.activeHandIndex];
  if (!h) return;
  const { total } = analyzeHand(h.cards);
  const canD =
    h.cards.length === 2 && !h.doubled && liveState.bankroll >= h.bet;
  const canP =
    canSplitRank(h.cards) && liveState.playerHands.length < 2 && liveState.bankroll >= h.bet;

  document.getElementById('live-double').disabled = !canD;
  document.getElementById('live-split').disabled = !canP;
  document.getElementById('live-hit').disabled = h.stood || h.doubled || total >= 21;
  document.getElementById('live-stand').disabled = h.stood || h.doubled;
}

function livePlayerAct(code) {
  if (!liveState.active || liveState.phase !== 'play') return;
  const h = liveState.playerHands[liveState.activeHandIndex];
  if (!h || h.stood || h.doubled) return;

  const canDouble = h.cards.length === 2 && !h.doubled && liveState.bankroll >= h.bet;
  const canSplit =
    canSplitRank(h.cards) && liveState.playerHands.length < 2 && liveState.bankroll >= h.bet;
  const opt = getOptimalAction(
    h.cards,
    liveState.dealer[0].rank,
    canDouble,
    canSplit,
  );

  if (code === 'P' && !canSplit) return;
  if (code === 'D' && !canDouble) return;

  recordPlayerDecision(code, h.cards, liveState.dealer[0]);

  if (code === 'P') {
    const c1 = h.cards[0];
    const c2 = h.cards[1];
    h.cards = [c1, liveDrawCard()];
    liveState.playerHands.push({
      cards: [c2, liveDrawCard()],
      bet: h.bet,
      doubled: false,
      stood: false,
    });
    liveState.bankroll -= h.bet;
    liveRenderLiveTable();
    liveUpdateActionButtons();
    return;
  }

  if (code === 'D') {
    h.doubled = true;
    liveState.bankroll -= h.bet;
    h.bet *= 2;
    h.cards.push(liveDrawCard());
    h.stood = true;
    liveRenderLiveTable();
    liveNextHandOrDealer();
    return;
  }

  if (code === 'S') {
    h.stood = true;
    liveNextHandOrDealer();
    return;
  }

  if (code === 'H') {
    h.cards.push(liveDrawCard());
    const { total } = analyzeHand(h.cards);
    liveRenderLiveTable();
    if (total > 21) {
      h.stood = true;
      liveNextHandOrDealer();
    } else if (total === 21) {
      h.stood = true;
      liveNextHandOrDealer();
    } else {
      liveUpdateActionButtons();
    }
  }
}

function liveNextHandOrDealer() {
  for (let idx = 0; idx < liveState.playerHands.length; idx++) {
    const hand = liveState.playerHands[idx];
    const t = analyzeHand(hand.cards).total;
    if (t <= 21 && !hand.stood && !hand.doubled) {
      liveState.activeHandIndex = idx;
      liveRenderLiveTable();
      liveUpdateActionButtons();
      return;
    }
  }
  livePlayDealer();
}

function livePlayDealer() {
  liveState.phase = 'dealer';
  liveState.dealerHoleHidden = false;
  liveUpdateHud();
  liveRenderLiveTable();

  let dtot = analyzeHand(liveState.dealer).total;
  while (dtot < 17) {
    liveState.dealer.push(liveDrawCard());
    dtot = analyzeHand(liveState.dealer).total;
    liveRenderLiveTable();
  }

  liveResolveHands();
}

function liveResolveHands() {
  const dtot = analyzeHand(liveState.dealer).total;
  const dealerBust = dtot > 21;
  const parts = [];

  liveState.playerHands.forEach((h) => {
    const ptot = analyzeHand(h.cards).total;
    const bet = h.bet;
    if (ptot > 21) {
      parts.push('Bust');
      return;
    }
    if (dealerBust) {
      liveState.bankroll += bet * 2;
      parts.push('Win (dealer bust)');
      return;
    }
    if (ptot > dtot) {
      liveState.bankroll += bet * 2;
      parts.push('Win');
    } else if (ptot === dtot) {
      liveState.bankroll += bet;
      parts.push('Push');
    } else {
      parts.push('Lose');
    }
  });

  liveState.handsPlayed += 1;
  liveFinishHand(parts.join(' · ') || 'Hand complete.');
}

function liveFinishHand(message) {
  liveReturnToDiscard(liveState.dealer);
  liveState.playerHands.forEach((h) => liveReturnToDiscard(h.cards));

  liveState.phase = 'bet';
  liveState.dealer = [];
  liveState.playerHands = [];
  liveState.dealerHoleHidden = false;

  const fb = document.getElementById('live-feedback');
  if (fb) {
    fb.innerHTML = `<div class="feedback-message correct">${message}</div>`;
  }

  document.getElementById('live-phase-msg').textContent = '';
  liveRenderBetPanel();
  liveUpdateHud();
}

function endLivePlaySession(timedOut) {
  if (liveState.timerId) {
    clearInterval(liveState.timerId);
    liveState.timerId = null;
  }
  const wasActive = liveState.active;
  liveState.active = false;
  livePlaySessionActive = false;

  if (wasActive && liveState.phase === 'play' && liveState.playerHands.length) {
    liveReturnToDiscard(liveState.dealer);
    liveState.playerHands.forEach((h) => liveReturnToDiscard(h.cards));
  }

  liveShowResults(timedOut);
}

function liveShowResults(timedOut) {
  const dPct =
    liveState.decisionsTotal > 0
      ? Math.round((liveState.decisionsCorrect / liveState.decisionsTotal) * 100)
      : 0;
  const bPct =
    liveState.betsTotal > 0
      ? Math.round((liveState.betsGood / liveState.betsTotal) * 100)
      : 0;

  const misplays = liveState.misplayLog.slice(-15).reverse();
  const bets = liveState.betLog.slice(-10).reverse();

  const body = document.getElementById('live-results-body');
  if (body) {
    body.innerHTML = `
      <p class="live-result-lede">${timedOut ? 'Time limit (30 minutes) reached.' : 'Session ended.'}</p>
      <ul class="live-result-stats">
        <li>Hands played: <strong>${liveState.handsPlayed}</strong></li>
        <li>Ending bankroll: <strong>${liveState.bankroll}</strong> units</li>
        <li>Basic strategy: <strong>${dPct}%</strong> (${liveState.decisionsCorrect}/${liveState.decisionsTotal} decisions matched chart)</li>
        <li>Bet sizing vs true count: <strong>${bPct}%</strong> of bets matched the suggested spread.</li>
      </ul>
      <h4>Play reminders (sample misplayes)</h4>
      <ul class="live-misplay-list">${misplays.length ? misplays.map((m) => `<li>${m}</li>`).join('') : '<li>None recorded — great discipline.</li>'}</ul>
      <h4>Bet sizing notes</h4>
      <ul class="live-misplay-list">${bets.length ? bets.map((m) => `<li>${m}</li>`).join('') : '<li>Your bets matched the suggested ramp whenever you were scored.</li>'}</ul>
      <p class="live-result-tip">Suggested spread: TC ≤0 → 1 unit; TC +1 → 2; +2 → 4; +3 → 6; +4+ → 8. Raise when the count favors tens/aces; lower when it is negative.</p>
    `;
  }

  document.getElementById('live-session')?.setAttribute('hidden', 'true');
  document.getElementById('live-results')?.removeAttribute('hidden');
  document.getElementById('live-setup')?.setAttribute('hidden', 'true');
}

function initEnterOverlay() {
  const ov = document.getElementById('site-enter-overlay');
  const btn = document.getElementById('site-enter-btn');
  if (!ov || !btn) return;
  if (sessionStorage.getItem('bjEnterDismissed')) {
    ov.remove();
    return;
  }
  document.body.classList.add('enter-locked');
  const dismiss = () => {
    ov.classList.add('site-enter-exit');
    sessionStorage.setItem('bjEnterDismissed', '1');
    setTimeout(() => {
      ov.remove();
      document.body.classList.remove('enter-locked');
    }, 480);
  };
  btn.addEventListener('click', dismiss);
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dismiss();
    }
  });
}

function init() {
  loadStats();
  initEnterOverlay();

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sec = btn.dataset.section;
      if (sec) navigateSection(sec);
    });
  });

  document.querySelector('.logo-brand')?.addEventListener('click', () => {
    navigateSection('home');
  });

  document.getElementById('live-start-btn')?.addEventListener('click', startLivePlaySession);

  updateStatsDisplay();
  window.addEventListener('resize', () => drawProgressChart());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.navigateSection = navigateSection;
window.startNewGame = startNewGame;
window.submitCount = submitCount;
window.endGame = endGame;
window.resetAllStats = resetAllStats;
