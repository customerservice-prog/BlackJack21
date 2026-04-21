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

function init() {
  loadStats();

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sec = btn.dataset.section;
      if (sec) navigateSection(sec);
    });
  });

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
