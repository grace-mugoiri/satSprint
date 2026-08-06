(function () {
    'use strict';
    if (typeof window !== 'undefined' && window.location && /^https?:/.test(window.location.protocol)) {
        window.SAT_SPRINT_HIGH_SCORE_API = window.SAT_SPRINT_HIGH_SCORE_API || '/api/high-scores';
        window.SAT_SPRINT_REMOTE_SAVE_API = window.SAT_SPRINT_REMOTE_SAVE_API || '/api/run-snapshot';
    }

    // ============================================================
    // DOM refs
    // ============================================================
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const wrap = document.getElementById('wrap');
    const scoreEl = document.getElementById('score');
    const bestEl = document.getElementById('best');
    const startScreen = document.getElementById('startScreen');
    const overScreen = document.getElementById('overScreen');
    const finalScoreEl = document.getElementById('finalScore');
    const bestScoreLineEl = document.getElementById('bestScoreLine');
    const coinLineEl = document.getElementById('coinLine');
    const startBtn = document.getElementById('startBtn');
    const retryBtn = document.getElementById('retryBtn');
    const homeScreen = document.getElementById('homeScreen');
    const supportScreen = document.getElementById('supportScreen');
    const walletScreen = document.getElementById('walletScreen');
    const lifeScreen = document.getElementById('lifeScreen');
    const homePlayBtn = document.getElementById('homePlayBtn');
    const supportBtn = document.getElementById('supportBtn');
    const walletBtn = document.getElementById('walletBtn');
    const supportBackBtn = document.getElementById('supportBackBtn');
    const walletBackBtn = document.getElementById('walletBackBtn');
    const useLifeBtn = document.getElementById('useLifeBtn');
    const buyLifeBtn = document.getElementById('buyLifeBtn');
    const waitLifeBtn = document.getElementById('waitLifeBtn');
    const lifeHomeBtn = document.getElementById('lifeHomeBtn');
    const homeLives = document.getElementById('homeLives');
    const homeSats = document.getElementById('homeSats');
    const homeTimer = document.getElementById('homeTimer');
    const rewardPoolStatus = document.getElementById('rewardPoolStatus');
    const lifeStatus = document.getElementById('lifeStatus');
    const lifeTimer = document.getElementById('lifeTimer');
    const walletGameSats = document.getElementById('walletGameSats');
    const walletPoints = document.getElementById('walletPoints');
    const walletReward = document.getElementById('walletReward');
    const playerNameInput = document.getElementById('playerName');
    const highScoresList = document.getElementById('highScoresList');
    const streakEl = document.getElementById('streak');
    const lightningEl = document.getElementById('lightning');
    const quizScreen = document.getElementById('quizScreen');
    const quizQuestionEl = document.getElementById('quizQuestion');
    const quizAnswersEl = document.getElementById('quizAnswers');
    const quizFeedbackEl = document.getElementById('quizFeedback');
    const quizHintEl = document.getElementById('quizHint');
    const cupButton = document.getElementById('cupButton');
    const finalLightningEl = document.getElementById('finalLightning');
    const rewardPointsEl = document.getElementById('rewardPoints');

    let lightningCharge = 0;
    let satsCollected = 0;
    let rewardPoints = 0;
    let quizPending = false;
    let quizZone = null; // legacy, no longer used
    let nextQuizAt = 45 + Math.random() * 15;
    const DOUBLE_JUMP_COIN_CHANCE = 0.12;
    const CUP_SHAKE_INTERVAL = 10;
    let cupShakeTimer = CUP_SHAKE_INTERVAL;
    let quizWarningDialogOpen = false;

    const STORE_KEY = 'sat_sprint_player_v3';
    const HIGH_SCORES_KEY = 'sat_sprint_high_scores_v1';
    const defaultPlayer = {
        name: '',
        lives: 10,
        gameSats: 0,
        totalRuns: 0,
        best: 0,
        lastLifeRefill: 0,
        developerTips: 0,
        virtualRewardBalance: 0
    };
    let account = { ...defaultPlayer };
    let highScores = [];
    let highScoresPage = 0;
    const HIGHSCORES_PER_PAGE = 5;
    try { account = { ...defaultPlayer, ...(JSON.parse(localStorage.getItem(STORE_KEY)) || {}) }; } catch (e) { }
    function savePlayer() { localStorage.setItem(STORE_KEY, JSON.stringify(account)); }

    // ============================================================
    // Sanitization (XSS fix) — shared with live players rendering
    // ============================================================
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function cleanName(name) {
        return String(name || '')
            .replace(/[<>&"'/\\]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 16) || 'Player';
    }

    async function fetchRemoteHighScores() {
        const api = window.SAT_SPRINT_HIGH_SCORE_API;
        if (!api) return null;
        try {
            const res = await fetch(api, { method: 'GET', headers: { 'Accept': 'application/json' } });
            if (!res.ok) return null;
            const data = await res.json();
            return Array.isArray(data) ? data : null;
        } catch (e) {
            return null;
        }
    }
    async function loadHighScores() {
        let remoteScores = await fetchRemoteHighScores();
        if (remoteScores && remoteScores.length) {
            highScores = remoteScores.map(e => ({ name: cleanName(e.name), score: Number(e.score) || 0 }));
        } else {
            try { highScores = JSON.parse(localStorage.getItem(HIGH_SCORES_KEY) || '[]') || []; } catch (e) { highScores = []; }
            highScores = highScores.map(e => ({ name: cleanName(e.name), score: Number(e.score) || 0 }));
        }
        highScoresPage = 0;
        renderHighScores();
    }
    function saveHighScores() { try { localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(highScores)); } catch (e) { } }
    async function saveRunRemote(snapshot) {
        const api = window.SAT_SPRINT_REMOTE_SAVE_API || window.SAT_SPRINT_HIGH_SCORE_API;
        if (!api) return false;
        try {
            const res = await fetch(api, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'run_snapshot', payload: snapshot })
            });
            return res.ok;
        } catch (e) {
            return false;
        }
    }
    function getHighScorePageCount() {
        return Math.max(1, Math.ceil(highScores.length / HIGHSCORES_PER_PAGE));
    }
    function renderHighScores() {
        if (!highScoresList) return;
        if (!highScores.length) {
            highScoresList.innerHTML = '<div style="opacity:.7;">No high scores yet.</div>';
            updateHighScorePager();
            return;
        }
        const pageCount = getHighScorePageCount();
        highScoresPage = Math.min(highScoresPage, pageCount - 1);
        const start = highScoresPage * HIGHSCORES_PER_PAGE;
        const pageItems = highScores.slice(start, start + HIGHSCORES_PER_PAGE);
        highScoresList.innerHTML = pageItems.map((entry, index) =>
            `<div>${start + index + 1}. <strong>${esc(entry.name)}</strong> — ${Number(entry.score) || 0}m</div>`
        ).join('');
        updateHighScorePager();
    }
    function updateHighScorePager() {
        const pageCount = getHighScorePageCount();
        const label = document.getElementById('highScorePageLabel');
        const prevBtn = document.getElementById('highScorePrevBtn');
        const nextBtn = document.getElementById('highScoreNextBtn');
        if (label) label.textContent = `${highScoresPage + 1}/${pageCount}`;
        if (prevBtn) prevBtn.disabled = highScoresPage <= 0;
        if (nextBtn) nextBtn.disabled = highScoresPage >= pageCount - 1;
    }
    async function saveHighScoreRemote(entry) {
        const api = window.SAT_SPRINT_HIGH_SCORE_API;
        if (!api) return false;
        try {
            const res = await fetch(api, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry)
            });
            return res.ok;
        } catch (e) {
            return false;
        }
    }
    function setHighScoreSyncReminder() {
        const reminder = document.getElementById('highScoreSyncReminder');
        if (!reminder) return;
        reminder.textContent = window.SAT_SPRINT_HIGH_SCORE_API || window.SAT_SPRINT_REMOTE_SAVE_API
            ? 'Live top-score sync is enabled.'
            : 'Scores are stored locally. Add SAT_SPRINT_HIGH_SCORE_API for live sync.';
    }
    function setPlayerNameUI() {
        if (!playerNameInput) return;
        playerNameInput.value = account.name || '';
    }
    function savePlayerName(name) {
        account.name = cleanName(name);
        if (!account.name) account.name = 'Player';
        savePlayer();
    }
    window.satSprintGetPlayerInfo = function () {
        return {
            name: account.name || 'Player',
            lives: account.lives,
            gameSats: account.gameSats,
            best: account.best
        };
    };
    if (playerNameInput) {
        const saveNameValue = () => {
            if (playerNameInput.value.trim()) savePlayerName(playerNameInput.value.trim());
        };
        playerNameInput.addEventListener('blur', saveNameValue);
        playerNameInput.addEventListener('input', saveNameValue);
    }
    async function addHighScore(name, score) {
        const normalized = cleanName(name);
        const entry = { name: normalized, score };
        highScores.push(entry);
        highScores.sort((a, b) => b.score - a.score);
        highScores = highScores.slice(0, 50);
        saveHighScores();
        renderHighScores();
        const remoteSaved = await saveHighScoreRemote(entry);
        if (remoteSaved) {
            loadHighScores();
        }
    }
    function getRunSnapshot() {
        return {
            score: Math.floor(distance),
            sats: Math.floor(satsCollected),
            charge: Math.floor(lightningCharge),
            elapsed: Number(elapsed || 0),
            distance: Number(distance || 0),
            speed: Number(speed || baseSpeed),
            spawnTimer: Number(spawnTimer || 0),
            nextSpawnAt: Number(nextSpawnAt || 0.9),
            hillOffset1: Number(hillOffset1 || 0),
            hillOffset2: Number(hillOffset2 || 0),
            cityOffset: Number(cityOffset || 0),
            starOffset: Number(starOffset || 0),
            lightningMode: Number(lightningMode || 0),
            quizTimer: Number(quizTimer || 0),
            coinCount: Number(coinCount || 0),
            rewardPoints: Number(rewardPoints || 0),
            gamePlayer: {
                x: gamePlayer.x,
                y: gamePlayer.y,
                vy: gamePlayer.vy,
                onGround: gamePlayer.onGround,
                jumps: gamePlayer.jumps,
                squash: gamePlayer.squash,
                rot: gamePlayer.rot
            },
            obstacles: obstacles.map(o => ({ ...o })),
            coins: coins.map(c => ({ ...c })),
            savedAt: Date.now()
        };
    }
    function loadRunSnapshot(snapshot) {
        if (!snapshot) return;
        resetGame();
        distance = Number(snapshot.distance || snapshot.score || 0);
        satsCollected = Number(snapshot.sats || 0);
        lightningCharge = Number(snapshot.charge || 0);
        elapsed = Number(snapshot.elapsed || 0);
        speed = Number(snapshot.speed || baseSpeed);
        spawnTimer = Number(snapshot.spawnTimer || 0);
        nextSpawnAt = Number(snapshot.nextSpawnAt || 0.9);
        hillOffset1 = Number(snapshot.hillOffset1 || 0);
        hillOffset2 = Number(snapshot.hillOffset2 || 0);
        cityOffset = Number(snapshot.cityOffset || 0);
        starOffset = Number(snapshot.starOffset || 0);
        lightningMode = Number(snapshot.lightningMode || 0);
        quizTimer = Number(snapshot.quizTimer || 0);
        coinCount = Number(snapshot.coinCount || 0);
        rewardPoints = Number(snapshot.rewardPoints || 0);
        if (snapshot.gamePlayer) {
            gamePlayer.x = Number(snapshot.gamePlayer.x || gamePlayer.x);
            gamePlayer.y = Number(snapshot.gamePlayer.y || gamePlayer.y);
            gamePlayer.vy = Number(snapshot.gamePlayer.vy || 0);
            gamePlayer.onGround = Boolean(snapshot.gamePlayer.onGround);
            gamePlayer.jumps = Number(snapshot.gamePlayer.jumps || 0);
            gamePlayer.squash = Number(snapshot.gamePlayer.squash || 1);
            gamePlayer.rot = Number(snapshot.gamePlayer.rot || 0);
        }
        obstacles = Array.isArray(snapshot.obstacles) ? snapshot.obstacles.map(o => ({ ...o })) : [];
        coins = Array.isArray(snapshot.coins) ? snapshot.coins.map(c => ({ ...c })) : [];
        if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(true);
        quizPending = false;
        state = 'playing';
    }
    window.satSprintGetState = () => state;
    window.satSprintSetState = (value) => { state = value; };
    window.satSprintGetRunSnapshot = getRunSnapshot;
    window.satSprintLoadRunSnapshot = loadRunSnapshot;
    // expose core values to other modules (fixes IIFE scoping bugs)
    window.satSprintGetCore = function () {
        return {
            get account() { return account; },
            get satsCollected() { return satsCollected; },
            get rewardPoints() { return rewardPoints; },
            get state() { return state; },
            saveRunRemote: saveRunRemote,
            savePlayer: savePlayer
        };
    };
    // cup bonus bump — lives in main closure so it can mutate satsCollected
    window.satSprintBumpCup = function () {
        if (state !== 'playing' && state !== 'home') return;
        satsCollected += 5;
        rewardPoints += 15;
        if (window.SatAudio) window.SatAudio.sfx.coin();
        spawnBurst(gamePlayer.x + gamePlayer.w / 2, gamePlayer.y, '#ffb300', 10, true);
    };
    loadHighScores();

    // Periodically refresh remote high scores when a remote API is configured.
    (function setupHighScorePolling() {
        const POLL_MS = 10 * 1000;
        if (!window.SAT_SPRINT_HIGH_SCORE_API) return;
        let polling = true;
        setInterval(() => {
            if (!polling) return;
            try {
                const homeScreenEl = document.getElementById('homeScreen');
                if (homeScreenEl && homeScreenEl.classList.contains('hidden')) return;
                loadHighScores();
            } catch (e) {
                // ignore
            }
        }, POLL_MS);

        (function setupWebSocket() {
            const defaultWs = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws';
            const wsUrl = window.SAT_SPRINT_WS_URL || defaultWs;
            if (!wsUrl) return;
            let ws;
            let reconnectTimer = null;
            const RECONNECT_MS = 5000;

            function connect() {
                try { ws = new WebSocket(wsUrl); window.SAT_SPRINT_WS = ws; } catch (e) { return; }

                const livePlayers = {};
                let runProgressTicker = null;

                function renderLivePlayers() {
                    const el = document.getElementById('livePlayersList');
                    if (!el) return;
                    const items = Object.values(livePlayers)
                        .map(p => ({
                            id: p.id,
                            name: cleanName(p.name || 'Player'),
                            progress: p.progress || {},
                            lastSeen: p.lastSeen || 0
                        }))
                        .sort((a, b) => (b.progress.score || 0) - (a.progress.score || 0));
                    if (!items.length) {
                        el.innerHTML = '<div style="opacity:.7;">No active players</div>';
                        return;
                    }
                    const namesSeen = new Set();
                    el.innerHTML = items.map(p => {
                        const displayName = namesSeen.has(p.name) ? `${p.name} (${p.id.slice(0, 4)})` : p.name;
                        namesSeen.add(p.name);
                        const sc = typeof p.progress.score !== 'undefined' && p.progress.score !== null ? p.progress.score + 'm' : '';
                        const ds = typeof p.progress.distance !== 'undefined' && p.progress.distance !== null ? ' • ' + Math.floor(p.progress.distance) + 'm' : '';
                        return `<div><strong>${esc(displayName)}</strong>${sc ? ' — ' + sc : ''}${ds}</div>`;
                    }).join('');
                }

                ws.addEventListener('open', () => {
                    console.info('SAT SPRINT WS connected to', wsUrl);
                    const wsStatus = document.getElementById('wsStatus');
                    if (wsStatus) wsStatus.textContent = 'WS: connected';
                    try { ws.send(JSON.stringify({ type: 'presence', payload: { name: account.name || 'Player' } })); } catch (e) { }
                    try { ws.send(JSON.stringify({ type: 'get_active_players' })); } catch (e) { }
                });

                ws.addEventListener('message', (ev) => {
                    try {
                        const msg = JSON.parse(ev.data);
                        if (!msg || !msg.type) return;
                        if (msg.type === 'welcome') {
                            if (Array.isArray(msg.data)) { highScores = msg.data.map(e => ({ name: cleanName(e.name), score: Number(e.score) || 0 })); renderHighScores(); }
                            window.SAT_SPRINT_CLIENT_ID = msg.id;
                            return;
                        }
                        if (msg.type === 'high_scores' && Array.isArray(msg.data)) {
                            highScores = msg.data.map(e => ({ name: cleanName(e.name), score: Number(e.score) || 0 }));
                            highScoresPage = 0;
                            renderHighScores();
                            return;
                        }
                        if (msg.type === 'presence' && msg.id) {
                            livePlayers[msg.id] = Object.assign(livePlayers[msg.id] || {}, msg.payload || {});
                            renderLivePlayers();
                            return;
                        }
                        if (msg.type === 'active_players' && Array.isArray(msg.data)) {
                            msg.data.forEach(p => { if (p && p.id) livePlayers[p.id] = p; });
                            renderLivePlayers();
                            return;
                        }
                        if (msg.type === 'run_progress' && msg.id) {
                            livePlayers[msg.id] = Object.assign(livePlayers[msg.id] || {}, msg.payload || {});
                            renderLivePlayers();
                            return;
                        }
                        if (msg.type === 'player_disconnected' && msg.id) {
                            if (livePlayers[msg.id]) delete livePlayers[msg.id];
                            renderLivePlayers();
                            return;
                        }
                    } catch (e) { /* ignore malformed ws messages */ }
                });

                ws.addEventListener('close', () => {
                    console.info('SAT SPRINT WS disconnected');
                    if (reconnectTimer) clearTimeout(reconnectTimer);
                    const wsStatus = document.getElementById('wsStatus');
                    if (wsStatus) wsStatus.textContent = 'WS: disconnected';
                    reconnectTimer = setTimeout(connect, RECONNECT_MS);
                });
                ws.addEventListener('error', () => { /* will trigger close */ });

                function startRunProgressTicker() {
                    if (runProgressTicker) return;
                    runProgressTicker = setInterval(() => {
                        if (!ws || ws.readyState !== WebSocket.OPEN) return;
                        if (state !== 'playing') return;
                        try {
                            ws.send(JSON.stringify({
                                type: 'run_progress', payload: {
                                    name: account.name || 'Player', score: Math.floor(distance), distance: Math.floor(distance), sats: Math.floor(satsCollected), elapsed: Number(elapsed || 0)
                                }
                            }));
                        } catch (e) { }
                    }, 1000);
                }
                function stopRunProgressTicker() { if (runProgressTicker) { clearInterval(runProgressTicker); runProgressTicker = null; } }

                const origStartGame = startGame;
                startGame = function () { origStartGame(); startRunProgressTicker(); };
                const origEndGame = endGame;
                endGame = function () { stopRunProgressTicker(); origEndGame(); };

                if (playerNameInput) {
                    playerNameInput.addEventListener('blur', () => { try { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'presence', payload: { name: account.name || 'Player' } })); } catch (e) { } });
                    playerNameInput.addEventListener('input', () => { try { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'presence', payload: { name: account.name || 'Player' } })); } catch (e) { } });
                }
            }
            connect();
        })();
    })();
    function refillLives() {
        const now = Date.now();
        if (account.lives >= 10) { account.lastLifeRefill = 0; return; }
        if (!account.lastLifeRefill) account.lastLifeRefill = now;
        const gained = Math.floor((now - account.lastLifeRefill) / (20 * 60 * 1000));
        if (gained > 0) {
            account.lives = Math.min(10, account.lives + gained);
            account.lastLifeRefill += gained * 20 * 60 * 1000;
            if (account.lives >= 10) account.lastLifeRefill = 0;
            savePlayer();
        }
    }
    function nextLifeSeconds() {
        refillLives();
        if (account.lives >= 10 || !account.lastLifeRefill) return 0;
        return Math.max(0, Math.ceil((20 * 60 * 1000 - (Date.now() - account.lastLifeRefill)) / 1000));
    }
    function fmtTime(s) {
        const m = Math.floor(s / 60), sec = s % 60;
        return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    }
    let quizTimer = 0;
    let quizStreak = 0;
    let lightningMode = 0;

    // expanded quiz bank (was only 5)
    const quizBank = [
        { q: 'What is a sat?', a: ['A mining machine', 'The smallest unit of bitcoin', 'A Bitcoin block'], correct: 1 },
        { q: 'What does Lightning primarily enable?', a: ['Faster Bitcoin payments', 'Free bitcoin forever', 'Mining on a phone'], correct: 0 },
        { q: 'What is a block?', a: ['A wallet password', 'A batch of Bitcoin transactions', 'A type of Lightning bolt'], correct: 1 },
        { q: 'Who can run a Bitcoin node?', a: ['Only miners', 'Anyone with suitable software and resources', 'Only exchanges'], correct: 1 },
        { q: 'What happens at a Bitcoin halving?', a: ['Block subsidy is reduced', 'All wallets reset', 'Bitcoin stops'], correct: 0 },
        { q: 'How many sats are in 1 bitcoin?', a: ['1,000', '100 million', '1 million'], correct: 1 },
        { q: 'What is the Bitcoin supply cap?', a: ['21 million BTC', 'Unlimited', '2.1 million BTC'], correct: 0 },
        { q: 'Who invented Bitcoin?', a: ['Vitalik Buterin', 'Satoshi Nakamoto', 'Elon Musk'], correct: 1 },
        { q: 'What is a mempool?', a: ['A pool for miners', 'A waiting room for unconfirmed transactions', 'A type of wallet'], correct: 1 },
        { q: 'What is the current block reward after the 2024 halving?', a: ['6.25 BTC', '3.125 BTC', '12.5 BTC'], correct: 1 },
        { q: 'What is a private key?', a: ['A public address', 'Secret data that controls your bitcoin', 'A password for exchanges'], correct: 1 },
        { q: 'What is a seed phrase?', a: ['A list of words that backs up your wallet', 'A Bitcoin ticker', 'A mining term'], correct: 0 },
        { q: 'What does HODL mean?', a: ['Hold On for Dear Life', 'A trading bot', 'A type of coin'], correct: 0 },
        { q: 'What is the Lightning Network?', a: ['A second-layer payment network', 'A mining pool', 'A Bitcoin fork'], correct: 0 },
        { q: 'What is a nonce?', a: ['A wallet type', 'A number used once in mining', 'A transaction fee'], correct: 1 }
    ];

    // ---------- game constants ----------
    const GROUND_Y_RATIO = 0.78;
    const GRAVITY = 2200;
    const JUMP_V = -760;
    const DOUBLE_JUMP_V = -650;
    let baseSpeed = 260;

    let W, H, DPR;
    let state = 'start'; // start, playing, dead, paused, quiz, home
    let gamePlayer, obstacles, coins, particles, groundY;
    let distance = 0, coinCount = 0, elapsed = 0, speed = baseSpeed;
    let spawnTimer = 0, nextSpawnAt = 0;
    let hillOffset1 = 0, hillOffset2 = 0, cityOffset = 0, starOffset = 0;
    let shakeT = 0;
    // ---------- parallax background data ----------
    let stars = [];
    let city = [];

    function resize() {
        const rect = wrap.getBoundingClientRect();
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = rect.width; H = rect.height;
        canvas.width = W * DPR;
        canvas.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        groundY = H * GROUND_Y_RATIO;
        buildStars();
        buildCity();
    }
    window.addEventListener('resize', resize);
    resize();

    // ---------- persistent best score (fixed: uses localStorage) ----------
    const BEST_KEY = 'sat_sprint_best_v1';
    let best = 0;
    function loadBest() {
        try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { best = 0; }
        if (bestEl) bestEl.textContent = '🏆 BEST ' + best + 'm';
    }
    function saveBest(v) {
        try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { }
    }
    loadBest();

    function buildStars() {
        stars = [];
        const count = Math.max(30, Math.floor(W / 12));
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H * 0.62,
                r: 0.6 + Math.random() * 1.6,
                p: Math.random() * Math.PI * 2,
                sp: 0.5 + Math.random() * 1.5,
                layer: Math.random() < 0.6 ? 1 : 2
            });
        }
    }
    function buildCity() {
        city = [];
        let x = 0;
        let i = 0;
        while (x < W + 400) {
            const bw = 40 + Math.random() * 70;
            const bh = H * (0.12 + Math.random() * 0.24);
            const windows = [];
            const cols = Math.max(1, Math.floor(bw / 14));
            const rows = Math.max(1, Math.floor(bh / 18));
            for (let r = 0; r < rows; r++) {
                for (let cIdx = 0; cIdx < cols; cIdx++) {
                    if (Math.random() < 0.35) {
                        windows.push({ wx: cIdx * 14 + 6, wy: r * 18 + 8, lit: Math.random() < 0.7 });
                    }
                }
            }
            city.push({ x, w: bw, h: bh, windows });
            x += bw + 6;
            i++;
            if (i > 200) break;
        }
    }

    function resetGame() {
        groundY = H * GROUND_Y_RATIO;
        gamePlayer = {
            x: W * 0.24, y: groundY - 40, w: 40, h: 40,
            vy: 0, onGround: true, jumps: 0, maxJumps: 2,
            squash: 1, rot: 0, trail: []
        };
        obstacles = [];
        coins = [];
        particles = [];
        distance = 0; coinCount = 0; elapsed = 0; speed = baseSpeed;
        lightningCharge = 0; satsCollected = 0; rewardPoints = 0; lightningMode = 0; quizTimer = 0;
        if (streakEl) streakEl.textContent = '🔥 ' + quizStreak;
        if (lightningEl) lightningEl.textContent = '⚡ 0%';
        spawnTimer = 0; nextSpawnAt = 0.9;
    }

    function jump() {
        if (state !== 'playing') return;
        if (gamePlayer.jumps < gamePlayer.maxJumps) {
            gamePlayer.vy = gamePlayer.jumps === 0 ? JUMP_V : DOUBLE_JUMP_V;
            gamePlayer.jumps++;
            gamePlayer.onGround = false;
            gamePlayer.squash = 1.3; // stretch on jump (jiggle)
            spawnBurst(gamePlayer.x + gamePlayer.w / 2, gamePlayer.y + gamePlayer.h, '#ffffff', 5, true);
            if (window.SatAudio) {
                if (gamePlayer.jumps > 1) window.SatAudio.sfx.doubleJump();
                else window.SatAudio.sfx.jump();
            }
        }
    }

    function spawnBurst(x, y, color, count, small) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 220,
                vy: -Math.random() * 220 - 40,
                life: 0.5 + Math.random() * 0.3,
                t: 0,
                color,
                r: small ? 2 + Math.random() * 2 : 3 + Math.random() * 3
            });
        }
    }

    function startGame() {
        resetGame();
        if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(true);
        state = 'playing';
        startScreen.classList.add('hidden');
        overScreen.classList.add('hidden');
        if (window.SatAudio) { window.SatAudio.setMusicMode('game'); window.SatAudio.startMusic(); }
    }

    function endGame() {
        if (window.satSprintClearSavedRun) window.satSprintClearSavedRun();
        if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(false);
        state = 'dead';
        shakeT = 0.35;
        spawnBurst(gamePlayer.x + gamePlayer.w / 2, gamePlayer.y + gamePlayer.h / 2, '#ff5d5d', 18, false);
        if (window.SatAudio) window.SatAudio.sfx.death();
        const d = Math.floor(distance);
        finalScoreEl.textContent = d;
        coinLineEl.textContent = satsCollected + ' sats';
        finalLightningEl.textContent = Math.floor(lightningCharge) + '%';
        rewardPointsEl.textContent = rewardPoints;
        const virtualReward = Math.floor(Math.min(250, rewardPoints / 20));
        account.virtualRewardBalance += virtualReward;
        account.gameSats += satsCollected;
        savePlayer();
        let isNew = false;
        if (d > best) { best = d; isNew = true; saveBest(best); bestEl.textContent = '🏆 BEST ' + best + 'm'; }
        if (d > account.best) {
            account.best = d;
            savePlayer();
        }
        if (d > 0) addHighScore(account.name || 'Player', d);
        bestScoreLineEl.innerHTML = best + (isNew ? '<span id="newbest">NEW!</span>' : '');
        // share button state
        const shareBtn = document.getElementById('shareScoreBtn');
        if (shareBtn) {
            if (d > 0) {
                const text = encodeURIComponent(`⚡ I just ran ${d}m in SAT SPRINT and collected ${Math.floor(satsCollected)} sats! Best: ${best}m. Think you can beat me? 🏃₿`);
                shareBtn.href = `https://wa.me/?text=${text}`;
                shareBtn.style.display = '';
            } else {
                shareBtn.style.display = 'none';
            }
        }
        setTimeout(() => { overScreen.classList.remove('hidden'); }, 500);
    }

    function maybeQuiz(dt) {
        if (state !== 'playing') return;
        quizTimer += dt;
        if (quizTimer >= nextQuizAt && !quizPending) {
            quizTimer = 0;
            nextQuizAt = 45 + Math.random() * 15;
            quizPending = true;
            if (!quizWarningDialogOpen) {
                quizWarningDialogOpen = true;
                if (window.satSprintSaveRun) window.satSprintSaveRun('quiz-warning');
                if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(false);
                state = 'paused';
                document.getElementById('quizWarningScreen')?.classList.remove('hidden');
            }
        }
    }

    function pauseForQuiz() {
        if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(false);
        state = 'quiz';
        quizWarningDialogOpen = false;
        quizPending = false;
        quizTimer = 0;
        const q = quizBank[Math.floor(Math.random() * quizBank.length)];
        quizQuestionEl.textContent = q.q;
        quizAnswersEl.innerHTML = '';
        quizFeedbackEl.textContent = '';
        q.a.forEach((answer, i) => {
            const b = document.createElement('button');
            b.textContent = answer;
            b.onclick = () => {
                if (i === q.correct) {
                    quizStreak++;
                    rewardPoints += 250;
                    lightningCharge = Math.min(100, lightningCharge + 25);
                    quizFeedbackEl.textContent = '✓ Correct! +250 reward points';
                    quizFeedbackEl.style.color = '#22c55e';
                    if (window.SatAudio) window.SatAudio.sfx.quizCorrect();
                } else {
                    quizStreak = 0;
                    quizFeedbackEl.textContent = 'Not quite — keep learning!';
                    quizFeedbackEl.style.color = '#f97316';
                    if (window.SatAudio) window.SatAudio.sfx.quizWrong();
                }
                streakEl.textContent = '🔥 ' + quizStreak;
                setTimeout(() => {
                    quizScreen.classList.add('hidden');
                    state = 'playing';
                    if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(true);
                    quizPending = false;
                }, 750);
            };
            quizAnswersEl.appendChild(b);
        });
        quizScreen.classList.remove('hidden');
    }

    // function createQuizCheckpoint() {
    //     quizZone = { kind: 'quizCheckpoint', x: W + 340, w: QUIZ_ZONE_WIDTH, passed: false };
    //     obstacles.push(quizZone);
    //     quizPending = true;
    //     if (!quizWarningDialogOpen) {
    //         quizWarningDialogOpen = true;
    //         if (window.satSprintSaveRun) {
    //             window.satSprintSaveRun('quiz-warning');
    //         }
    //         if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(false);
    //         state = 'paused';
    //         document.getElementById('quizWarningScreen')?.classList.remove('hidden');
    //     }
    // }

    function hideQuizWarningDialog() {
        document.getElementById('quizWarningScreen')?.classList.add('hidden');
        quizWarningDialogOpen = false;
    }

    function updateHomeUI() {
        refillLives();
        homeLives.textContent = account.lives + ' / 10';
        homeSats.textContent = account.gameSats;
        walletGameSats.textContent = account.gameSats;
        walletPoints.textContent = rewardPoints;
        walletReward.textContent = account.virtualRewardBalance + ' sats';
        const sec = nextLifeSeconds();
        homeTimer.textContent = sec ? 'Next free life in ' + fmtTime(sec) : '';
        const reminder = document.getElementById('highScoreSyncReminder');
        if (reminder) {
            reminder.textContent = window.SAT_SPRINT_HIGH_SCORE_API ? 'Live top scores enabled.' : 'Top scores are local only. Add SAT_SPRINT_HIGH_SCORE_API for server sync.';
        }
    }
    function showHome() {
        if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(false);
        state = 'home';
        [startScreen, overScreen, quizScreen, lifeScreen, supportScreen, walletScreen].forEach(x => x.classList.add('hidden'));
        homeScreen.classList.remove('hidden');
        setPlayerNameUI();
        setHighScoreSyncReminder();
        loadHighScores();
        updateHomeUI();
        if (window.SatAudio) { window.SatAudio.setMusicMode('menu'); window.SatAudio.startMusic(); }
    }
    function startFromHome() {
        if (playerNameInput && playerNameInput.value.trim()) {
            savePlayerName(playerNameInput.value.trim());
        } else if (!account.name) {
            account.name = 'Player';
            savePlayer();
        }
        if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(true);
        refillLives();
        if (account.lives <= 0) {
            openLifeScreen();
            return;
        }
        account.lives--;
        account.totalRuns++;
        savePlayer();
        homeScreen.classList.add('hidden');
        resetGame();
        state = 'playing';
        startScreen.classList.add('hidden');
        if (window.SatAudio) { window.SatAudio.setMusicMode('game'); window.SatAudio.startMusic(); }
    }
    function openLifeScreen() {
        [homeScreen, startScreen, overScreen, quizScreen, supportScreen, walletScreen].forEach(x => x.classList.add('hidden'));
        lifeScreen.classList.remove('hidden');
        updateLifeUI();
    }
    function updateLifeUI() {
        refillLives();
        lifeStatus.textContent = account.lives > 0 ? `You have ${account.lives} lives left.` : 'No free lives left.';
        useLifeBtn.disabled = account.lives <= 0;
        buyLifeBtn.disabled = account.gameSats < 25;
        const sec = nextLifeSeconds();
        lifeTimer.textContent = sec ? 'Free revival in ' + fmtTime(sec) : (account.lives < 10 ? 'A free life is ready.' : '');
        homeTimer.textContent = sec ? 'Next free life in ' + fmtTime(sec) : '';
    }
    const toggleHighScoresBtn = document.getElementById('toggleHighScoresBtn');
    const highScoresBox = document.getElementById('highScoresBox');
    const quizWarningContinueBtn = document.getElementById('quizWarningContinueBtn');
    const quizWarningCancelBtn = document.getElementById('quizWarningCancelBtn');

    if (quizWarningContinueBtn) {
        quizWarningContinueBtn.onclick = function () {
            hideQuizWarningDialog();
            pauseForQuiz();
        };
    }
    if (quizWarningCancelBtn) {
        quizWarningCancelBtn.onclick = function () {
            hideQuizWarningDialog();
            quizPending = false;
            if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(true);
            state = 'playing';
        };
    }

    function setHighScoresVisible(show) {
        if (!highScoresBox || !toggleHighScoresBtn) return;
        highScoresBox.classList.toggle('hidden', !show);
        toggleHighScoresBtn.textContent = show ? 'Hide High Scores' : 'Show High Scores';
    }

    if (toggleHighScoresBtn) {
        toggleHighScoresBtn.addEventListener('click', function () {
            const visible = highScoresBox && !highScoresBox.classList.contains('hidden');
            setHighScoresVisible(!visible);
        });
    }

    homePlayBtn.onclick = startFromHome;
    supportBtn.onclick = () => { homeScreen.classList.add('hidden'); supportScreen.classList.remove('hidden'); };
    walletBtn.onclick = () => { homeScreen.classList.add('hidden'); walletScreen.classList.remove('hidden'); updateHomeUI(); };
    supportBackBtn.onclick = showHome;
    walletBackBtn.onclick = showHome;
    lifeHomeBtn.onclick = showHome;
    const highScorePrevBtn = document.getElementById('highScorePrevBtn');
    const highScoreNextBtn = document.getElementById('highScoreNextBtn');
    if (highScorePrevBtn) {
        highScorePrevBtn.addEventListener('click', function () {
            if (highScoresPage > 0) {
                highScoresPage -= 1;
                renderHighScores();
            }
        });
    }
    if (highScoreNextBtn) {
        highScoreNextBtn.addEventListener('click', function () {
            const pageCount = getHighScorePageCount();
            if (highScoresPage < pageCount - 1) {
                highScoresPage += 1;
                renderHighScores();
            }
        });
    }
    waitLifeBtn.onclick = () => {
        updateLifeUI();
        if (account.lives > 0) { lifeScreen.classList.add('hidden'); startFromHome(); }
    };
    useLifeBtn.onclick = () => {
        if (account.lives > 0) {
            account.lives--; savePlayer();
            lifeScreen.classList.add('hidden');
            resetGame(); state = 'playing';
        }
    };
    buyLifeBtn.onclick = () => {
        if (account.gameSats >= 25) {
            account.gameSats -= 25; account.lives++;
            savePlayer(); updateLifeUI(); updateHomeUI();
            lifeTimer.textContent = '❤️ Life purchased! Press Use 1 Life to run again.';
        }
    };
    setInterval(() => { updateHomeUI(); if (!lifeScreen.classList.contains('hidden')) updateLifeUI(); }, 1000);

    // input
    function onPress(e) {
        if (e) { e.preventDefault(); }
        if (state === 'playing') jump();
    }
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') { onPress(e); }
    });
    const overHomeBtn = document.getElementById('overHomeBtn');
    canvas.addEventListener('pointerdown', onPress);
    startBtn.addEventListener('click', startGame);
    retryBtn.addEventListener('click', startGame);
    if (overHomeBtn) {
        overHomeBtn.addEventListener('click', function () {
            overScreen.classList.add('hidden');
            showHome();
        });
    }

    // ---------- obstacle / coin generation (more variety) ----------
    function spawnObstacle() {
        const type = Math.random();
        const gh = 34 + Math.random() * 22;
        if (type < 0.34) {
            obstacles.push({ kind: 'spike', x: W + 40, y: groundY, w: 30, h: gh, passed: false });
        } else if (type < 0.48) {
            // double spike — wider hazard
            obstacles.push({ kind: 'spike', x: W + 40, y: groundY, w: 64, h: gh, passed: false });
        } else if (type < 0.62) {
            // flying drone — must jump late (or under)
            const dh = 26;
            const dy = groundY - 70 - Math.random() * 40;
            obstacles.push({ kind: 'drone', x: W + 40, y: dy, w: 34, h: dh, passed: false, phase: Math.random() * Math.PI * 2 });
        } else if (type < 0.78) {
            // tall spike wall — higher jump
            obstacles.push({ kind: 'spike', x: W + 40, y: groundY, w: 38, h: gh + 26, passed: false, tall: true });
        } else {
            const gw = 70 + Math.random() * 50;
            obstacles.push({ kind: 'gap', x: W + 40, w: gw, passed: false });
        }
        if (Math.random() < 0.22) {
            coins.push({ x: W + 80, y: groundY - 150, r: 14, taken: false, bob: Math.random() * Math.PI * 2, lightning: true });
        }
        if (Math.random() < DOUBLE_JUMP_COIN_CHANCE) {
            coins.push({ x: W + 120, y: groundY - 230, r: 18, taken: false, bob: Math.random() * Math.PI * 2, lightning: true, doubleJump: true });
        }
        if (Math.random() < 0.7) {
            const baseX = W + 60;
            const cnt = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < cnt; i++) {
                coins.push({
                    x: baseX + i * 34,
                    y: groundY - 90 - Math.sin(i / (cnt - 1) * Math.PI) * 50,
                    r: 10, taken: false, bob: Math.random() * Math.PI * 2
                });
            }
        }
    }

    // ---------- update ----------
    function update(dt) {
        elapsed += dt;
        maybeQuiz(dt);
        speed = baseSpeed + elapsed * 7;
        if (lightningMode > 0) { lightningMode -= dt; lightningCharge = 100; }
        distance += speed * dt * 0.05;
        scoreEl.textContent = '⚡ ' + Math.floor(satsCollected) + ' sats  •  ' + Math.floor(distance) + 'm';
        lightningEl.textContent = '⚡ ' + Math.floor(lightningCharge) + '%' + (lightningMode > 0 ? '  2×' : '');

        hillOffset1 -= speed * 0.15 * dt;
        hillOffset2 -= speed * 0.3 * dt;
        cityOffset -= speed * 0.45 * dt;
        starOffset -= speed * 0.06 * dt;

        // drive the music BPM from game speed
        if (window.SatAudio) {
            const speedFactor = Math.min(1, (speed - baseSpeed) / (baseSpeed * 4));
            window.SatAudio.updateBPM(speedFactor);
        }

        const pCenterX = gamePlayer.x + gamePlayer.w / 2;
        let overGap = false;
        for (const o of obstacles) {
            if (o.kind === 'gap' && pCenterX > o.x + 8 && pCenterX < o.x + o.w - 8) { overGap = true; break; }
            // if (o.kind === 'quizCheckpoint' && !o.passed && pCenterX > o.x + o.w / 2) {
            //     o.passed = true;
            //     quizZone = null;
            //     pauseForQuiz();
            // }
        }

        gamePlayer.vy += GRAVITY * dt;
        gamePlayer.y += gamePlayer.vy * dt;
        if (!overGap && gamePlayer.y + gamePlayer.h >= groundY) {
            const wasAirborne = !gamePlayer.onGround;
            gamePlayer.y = groundY - gamePlayer.h;
            if (!gamePlayer.onGround && gamePlayer.vy > 0) {
                gamePlayer.squash = 0.65; // squash on land (jiggle)
                if (window.SatAudio) window.SatAudio.sfx.land();
            }
            gamePlayer.vy = 0;
            gamePlayer.onGround = true;
            gamePlayer.jumps = 0;
            if (wasAirborne && !gamePlayer.trail) gamePlayer.trail = [];
        } else {
            gamePlayer.onGround = false;
            if (overGap && gamePlayer.y + gamePlayer.h >= groundY + 30) {
                endGame(); return;
            }
        }
        // squash spring back to 1 (jiggle)
        gamePlayer.squash += (1 - gamePlayer.squash) * Math.min(1, dt * 10);
        // wobble rotation when airborne
        gamePlayer.rot = gamePlayer.onGround ? 0 : Math.sin(gamePlayer.jumps * Math.PI * 2 + elapsed * 6) * 0.06 * gamePlayer.jumps;

        // run trail for speed feel
        if (state === 'playing' && gamePlayer.onGround) {
            gamePlayer.trail.push({ x: gamePlayer.x + gamePlayer.w / 2, y: gamePlayer.y + gamePlayer.h, life: 0.3, t: 0 });
            if (gamePlayer.trail.length > 12) gamePlayer.trail.shift();
        }
        for (const tr of gamePlayer.trail || []) { tr.t += dt; tr.x -= speed * dt * 0.6; }
        if (gamePlayer.trail) gamePlayer.trail = gamePlayer.trail.filter(tr => tr.t < tr.life);

        spawnTimer += dt;
        if (spawnTimer > nextSpawnAt) {
            spawnTimer = 0;
            nextSpawnAt = Math.max(0.55, 1.3 - elapsed * 0.01) + Math.random() * 0.5;
            spawnObstacle();
        }
        // if (!quizPending && quizTimer > QUIZ_WARNING_TIME && !quizZone) {
        //     createQuizCheckpoint();
        // }

        for (const o of obstacles) { o.x -= speed * dt; if (o.phase !== undefined) o.phase += dt * 4; }
        obstacles = obstacles.filter(o => o.x + (o.w || 0) > -60);

        for (const c of coins) {
            c.x -= speed * dt;
            c.bob += dt * 6;
        }
        coins = coins.filter(c => c.x > -40);

        const px = gamePlayer.x, py = gamePlayer.y, pw = gamePlayer.w, ph = gamePlayer.h;
        for (const o of obstacles) {
            if (o.kind === 'spike') {
                const ox = o.x, ow = o.w, oy = groundY - o.h, oh = o.h;
                if (px < ox + ow - 6 && px + pw > ox + 6 && py + ph > oy + 8) {
                    endGame(); return;
                }
            }
            if (o.kind === 'drone') {
                const bobY = o.y + Math.sin(o.phase) * 12;
                const ox = o.x, ow = o.w, oy = bobY, oh = o.h;
                if (px < ox + ow - 6 && px + pw > ox + 6 && py < oy + oh && py + ph > oy) {
                    endGame(); return;
                }
            }
        }

        for (const c of coins) {
            if (c.taken) continue;
            const dx = (px + pw / 2) - c.x, dy = (py + ph / 2) - (c.y + Math.sin(c.bob) * 6);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < c.r + pw * 0.35) {
                if (c.doubleJump && gamePlayer.jumps < 2) {
                    continue;
                }
                c.taken = true;
                if (c.lightning) {
                    lightningCharge = 100;
                    lightningMode = 6;
                    rewardPoints += c.doubleJump ? 220 : 100;
                    satsCollected += c.doubleJump ? 15 : 0;
                    spawnBurst(c.x, c.y, c.doubleJump ? '#c084fc' : '#7dd3fc', c.doubleJump ? 24 : 18, true);
                    if (window.SatAudio) window.SatAudio.sfx.lightning();
                } else {
                    coinCount++;
                    const earned = 1 + Math.floor(elapsed / 25);
                    satsCollected += earned;
                    // NOTE: account.gameSats credited only in endGame — no double count
                    lightningCharge = Math.min(100, lightningCharge + 8);
                    rewardPoints += 10;
                    spawnBurst(c.x, c.y, '#ffb300', 8, true);
                    if (window.SatAudio) window.SatAudio.sfx.coin();
                }
            }
        }
        coins = coins.filter(c => !c.taken);

        for (const p of particles) {
            p.t += dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 900 * dt;
        }
        particles = particles.filter(p => p.t < p.life);

        if (shakeT > 0) shakeT -= dt;
        if (cupButton) {
            cupShakeTimer -= dt;
            if (cupShakeTimer <= 0) {
                cupButton.classList.add('shake');
                setTimeout(() => cupButton.classList.remove('shake'), 350);
                cupShakeTimer = CUP_SHAKE_INTERVAL + Math.random() * 6;
            }
        }
    }

    // ---------- draw ----------
    function drawBackground() {
        // deep gradient sky
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#05070f');
        g.addColorStop(0.45, '#0b1220');
        g.addColorStop(1, '#3b2415');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // twinkling stars (proper wrap: offset goes negative, % must stay >= 0)
        for (const s of stars) {
            const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(elapsed * s.sp + s.p));
            ctx.globalAlpha = tw * (s.layer === 2 ? 0.8 : 0.5);
            ctx.fillStyle = '#cdd6f4';
            const sx = ((s.x + starOffset * s.layer * 0.2) % W + W) % W;
            ctx.beginPath(); ctx.arc(sx, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // glowing bitcoin moon
        const moonX = W * 0.82, moonY = H * 0.18;
        const glow = ctx.createRadialGradient(moonX, moonY, 6, moonX, moonY, 110);
        glow.addColorStop(0, 'rgba(247,147,26,0.55)');
        glow.addColorStop(1, 'rgba(247,147,26,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(moonX, moonY, 110, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(247,147,26,0.95)';
        ctx.beginPath(); ctx.arc(moonX, moonY, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3b2415';
        ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('₿', moonX, moonY + 1);

        // distant city skyline (scrolls LEFT with the world — offset is negative)
        ctx.fillStyle = '#101b2c';
        const cityPeriod = W + 400;
        for (const b of city) {
            const bx = ((b.x + cityOffset) % cityPeriod + cityPeriod) % cityPeriod;
            ctx.fillRect(bx, groundY - b.h, b.w, b.h);
            // lit windows
            for (const win of b.windows) {
                if (win.lit) {
                    ctx.fillStyle = 'rgba(247,147,26,0.55)';
                    ctx.fillRect(bx + win.wx, groundY - b.h + win.wy, 5, 7);
                }
            }
        }
        ctx.fillStyle = '#263442';
        drawHillRow(hillOffset1, H * 0.62, 70, groundY);
        ctx.fillStyle = '#1b2835';
        drawHillRow(hillOffset2, H * 0.7, 46, groundY);

        // ground
        ctx.fillStyle = '#171717';
        ctx.fillRect(0, groundY, W, H - groundY);
        ctx.fillStyle = '#f7931a';
        ctx.fillRect(0, groundY, W, 10);
        // animated ground stripes for speed feel
        ctx.fillStyle = 'rgba(247,147,26,0.18)';
        const stripeW = 46;
        let sox = (cityOffset * 2) % stripeW;
        for (let x = sox - stripeW; x < W + stripeW; x += stripeW) {
            ctx.fillRect(x, groundY + 18, stripeW * 0.55, 6);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        for (let x = sox - stripeW; x < W + stripeW; x += stripeW * 2) {
            ctx.fillRect(x, groundY + 34, stripeW * 0.3, 4);
        }
    }

    function drawHillRow(offset, baseY, amp, bottomY) {
        const period = 160;
        ctx.beginPath();
        ctx.moveTo(0, bottomY + 2);
        let x = (offset % period) - period;
        while (x < W + period) {
            ctx.quadraticCurveTo(x + period / 2, baseY - amp, x + period, baseY);
            x += period;
        }
        ctx.lineTo(W, bottomY + 2);
        ctx.closePath();
        ctx.fill();
    }

    function drawGaps() {
        for (const o of obstacles) {
            if (o.kind === 'gap') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(o.x, groundY, o.w, H - groundY);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
                ctx.fillRect(o.x + 2, groundY + 2, Math.max(0, o.w - 4), 20);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 4;
                ctx.setLineDash([14, 10]);
                ctx.beginPath();
                ctx.moveTo(o.x + 12, groundY + 16);
                ctx.lineTo(o.x + o.w - 12, groundY + 16);
                ctx.stroke();
                ctx.setLineDash([]);
                const stripeCount = Math.max(4, Math.round((o.w - 16) / 28));
                const stripeStep = (o.w - 16) / stripeCount;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
                for (let i = 0; i < stripeCount; i++) {
                    const sx = o.x + 10 + i * stripeStep;
                    ctx.fillRect(sx, groundY + 26, stripeStep * 0.42, 16);
                }
            }
        }
    }

    function drawSpikes() {
        for (const o of obstacles) {
            if (o.kind === 'spike') {
                const baseY = groundY;
                const n = Math.max(1, Math.round(o.w / 16));
                const step = o.w / n;
                ctx.fillStyle = o.tall ? '#c2410c' : '#e0453f';
                for (let i = 0; i < n; i++) {
                    const sx = o.x + i * step;
                    ctx.beginPath();
                    ctx.moveTo(sx, baseY);
                    ctx.lineTo(sx + step / 2, baseY - o.h);
                    ctx.lineTo(sx + step, baseY);
                    ctx.closePath();
                    ctx.fill();
                }
                if (o.tall) {
                    ctx.fillStyle = 'rgba(255,255,255,0.15)';
                    ctx.fillRect(o.x + 4, baseY - o.h, 4, o.h * 0.8);
                }
            }
        }
    }

    function drawDrones() {
        for (const o of obstacles) {
            if (o.kind !== 'drone') continue;
            const y = o.y + Math.sin(o.phase) * 12;
            // engine glow
            const glow = ctx.createRadialGradient(o.x + o.w / 2, y + o.h / 2, 2, o.x + o.w / 2, y + o.h / 2, 22);
            glow.addColorStop(0, 'rgba(239,68,68,0.5)');
            glow.addColorStop(1, 'rgba(239,68,68,0)');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(o.x + o.w / 2, y + o.h / 2, 22, 0, Math.PI * 2); ctx.fill();
            // body
            ctx.fillStyle = '#7f1d1d';
            ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2); ctx.fill();
            // eye
            ctx.fillStyle = '#fca5a5';
            ctx.beginPath(); ctx.arc(o.x + o.w / 2, y + o.h / 2, 5, 0, Math.PI * 2); ctx.fill();
            // rotor
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(o.x + o.w / 2 - 12, y + o.h / 2 - 12);
            ctx.lineTo(o.x + o.w / 2 + 12, y + o.h / 2 - 12);
            ctx.moveTo(o.x + o.w / 2, y + o.h / 2 - 16);
            ctx.lineTo(o.x + o.w / 2, y + o.h / 2 - 8);
            ctx.stroke();
        }
    }

    function drawCoins() {
        for (const c of coins) {
            const y = c.y + Math.sin(c.bob) * 6;
            ctx.save();
            ctx.translate(c.x, y);
            const squeeze = Math.abs(Math.cos(c.bob * 0.7));
            ctx.scale(0.4 + 0.6 * squeeze, 1);
            if (c.doubleJump) {
                ctx.fillStyle = '#c084fc';
            } else {
                ctx.fillStyle = c.lightning ? '#38bdf8' : '#ffb300';
            }
            ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = c.lightning ? '#0c4a6e' : '#d18a00';
            if (c.doubleJump) ctx.fillStyle = '#7c3aed';
            ctx.beginPath(); ctx.arc(0, 0, c.r * 0.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold ' + Math.max(11, c.r * 0.7) + 'px Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            if (c.doubleJump) {
                ctx.fillText('⚡⚡', 0, 1);
            } else {
                ctx.fillText(c.lightning ? '⚡' : '₿', 0, 1);
            }
            ctx.restore();
        }
    }

    function drawPlayer() {
        if (state === 'dead' && shakeT <= 0) { return; }
        ctx.save();
        const cx = gamePlayer.x + gamePlayer.w / 2;
        const cy = gamePlayer.y + gamePlayer.h / 2;
        ctx.translate(cx, cy);
        if (gamePlayer.rot) ctx.rotate(gamePlayer.rot);
        const sq = gamePlayer.squash;
        ctx.scale(1 / sq, sq);
        // trail
        for (const tr of gamePlayer.trail || []) {
            const a = 0.3 * (1 - tr.t / tr.life);
            ctx.globalAlpha = Math.max(0, a);
            ctx.fillStyle = '#f7931a';
            ctx.beginPath(); ctx.arc(tr.x - cx, tr.y - cy, 4 * (1 - tr.t / tr.life), 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = lightningMode > 0 ? '#38bdf8' : '#c96b0c';
        ctx.beginPath(); ctx.arc(2, 3, gamePlayer.w / 2 + 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f7931a';
        ctx.beginPath(); ctx.arc(0, 0, gamePlayer.w / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 25px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('₿', 0, 1);
        ctx.fillStyle = '#9a4e0b';
        ctx.beginPath(); ctx.ellipse(-9, gamePlayer.w / 2 - 2, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(9, gamePlayer.w / 2 - 2, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        if (lightningMode > 0) {
            ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, gamePlayer.w / 2 + 8, -0.8, 1.8); ctx.stroke();
        }
        ctx.restore();
    }

    function drawParticles() {
        for (const p of particles) {
            const a = 1 - p.t / p.life;
            ctx.globalAlpha = Math.max(0, a);
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    function render() {
        ctx.save();
        if (shakeT > 0) {
            const s = shakeT * 40;
            ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
        }
        drawBackground();
        drawGaps();
        drawSpikes();
        drawDrones();
        drawCoins();
        drawPlayer();
        drawParticles();
        ctx.restore();
    }

    let last = performance.now();
    function loop(now) {
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        if (state === 'playing') {
            update(dt);
        } else if (state === 'dead') {
            for (const p of particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; }
            particles = particles.filter(p => p.t < p.life);
            if (shakeT > 0) shakeT -= dt;
        }
        render();
        requestAnimationFrame(loop);
    }

    groundY = H * GROUND_Y_RATIO;
    gamePlayer = { x: W * 0.24, y: groundY - 40, w: 40, h: 40, vy: 0, onGround: true, jumps: 0, maxJumps: 2, squash: 1, rot: 0, trail: [] };
    obstacles = []; coins = []; particles = [];
    buildStars(); buildCity();
    requestAnimationFrame(loop);
})();

// ============================================================
// Gameplay UI module — pause / continue / exit (fixed state handling)
// ============================================================
(function () {
    const gameControls = document.getElementById('gameControls');
    const pauseScreen = document.getElementById('pauseScreen');
    const supportScreen = document.getElementById('supportScreen');
    const homeScreen = document.getElementById('homeScreen');
    const walletScreen = document.getElementById('walletScreen');
    const lifeScreen = document.getElementById('lifeScreen');
    const overScreen = document.getElementById('overScreen');
    const startScreen = document.getElementById('startScreen');
    const quizScreen = document.getElementById('quizScreen');
    const menuDuringGame = document.getElementById('menuDuringGame');
    const continueBtn = document.getElementById('continueBtn');
    const exitRunBtn = document.getElementById('exitRunBtn');

    function setGameplayUI(on) {
        gameControls.style.display = on ? 'flex' : 'none';
    }

    function pauseRun(reason) {
        if (typeof state !== 'undefined' && state === 'playing') {
            if (window.satSprintSaveRun) window.satSprintSaveRun(reason || 'menu');
            state = 'paused';
            pauseScreen.classList.remove('hidden');
            if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(false);
            if (window.SatAudio) window.SatAudio.pauseMusic();
        }
    }

    menuDuringGame.onclick = function () { pauseRun('menu'); };

    continueBtn.onclick = function () {
        pauseScreen.classList.add('hidden');
        const saved = window.satSprintGetSavedRun ? window.satSprintGetSavedRun() : null;
        if (saved) { if (window.satSprintResumeSaved) window.satSprintResumeSaved(); }
        else {
            if (typeof state !== 'undefined') state = 'playing';
            if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(true);
            if (window.SatAudio) window.SatAudio.resumeMusic();
        }
    };

    exitRunBtn.onclick = function () {
        pauseScreen.classList.add('hidden');
        if (window.satSprintClearSavedRun) window.satSprintClearSavedRun();
        if (typeof state !== 'undefined') state = 'home';
        setGameplayUI(false);
        if (typeof showHome === 'function') showHome();
    };

    window.satSprintSetGameplayUI = setGameplayUI;
    window.satSprintPauseRun = pauseRun;
})();

(function () {
    window.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && typeof state !== 'undefined' && state === 'playing') {
            document.getElementById('menuDuringGame')?.click();
        }
        // toggle sound with M
        if ((e.key === 'm' || e.key === 'M') && window.SatAudio) {
            window.SatAudio.setMusicEnabled(!window.SatAudio.musicEnabled);
            const btn = document.getElementById('musicToggleBtn');
            if (btn) btn.textContent = window.SatAudio.musicEnabled ? '🎵 On' : '🎵 Off';
        }
    });
})();

// ============================================================
// Save & Resume module (fixed: no closure-scoped references)
// ============================================================
(function () {
    const KEY = 'sat_sprint_saved_run_v4';
    const toast = document.getElementById('saveToast');
    const resumeScreen = document.getElementById('saveResumeScreen');
    const savedScore = document.getElementById('savedScore');
    const savedSats = document.getElementById('savedSats');
    const savedCharge = document.getElementById('savedCharge');

    function showToast() {
        if (!toast) return;
        toast.style.display = 'block';
        clearTimeout(window.__satToast);
        window.__satToast = setTimeout(() => toast.style.display = 'none', 1100);
    }

    window.satSprintSaveRun = function (reason) {
        try {
            const core = window.satSprintGetCore ? window.satSprintGetCore() : null;
            if (typeof window.satSprintGetState !== 'function' || window.satSprintGetState() !== 'playing') return false;
            const snapshot = window.satSprintGetRunSnapshot();
            snapshot.reason = reason || 'pause';
            snapshot.playerName = (core && core.account && core.account.name) || 'Player';
            localStorage.setItem(KEY, JSON.stringify(snapshot));
            showToast();
            if (window.SAT_SPRINT_REMOTE_SAVE_API || window.SAT_SPRINT_HIGH_SCORE_API) {
                if (core && core.saveRunRemote) {
                    core.saveRunRemote(snapshot).then(saved => {
                        if (!saved) console.warn('Remote save failed or endpoint unavailable.');
                    });
                }
            }
            return true;
        } catch (e) { console.warn('Could not save run', e); return false; }
    };

    window.satSprintGetSavedRun = function () {
        try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch (e) { return null }
    };

    window.satSprintClearSavedRun = function () {
        localStorage.removeItem(KEY);
    };

    window.satSprintShowSavedRun = function () {
        const r = window.satSprintGetSavedRun();
        if (!r) return false;
        savedScore.textContent = Math.floor(r.score).toLocaleString();
        savedSats.textContent = Math.floor(r.sats).toLocaleString();
        savedCharge.textContent = Math.floor(r.charge) + '%';
        resumeScreen.classList.remove('hidden');
        return true;
    };

    window.satSprintResumeSaved = function () {
        const r = window.satSprintGetSavedRun();
        if (!r) return;
        resumeScreen.classList.add('hidden');
        if (typeof window.satSprintLoadRunSnapshot === 'function') {
            window.satSprintLoadRunSnapshot(r);
        }
        window.satSprintClearSavedRun();
        if (window.SatAudio) { window.SatAudio.setMusicMode('game'); window.SatAudio.resumeMusic(); }
    };

    document.getElementById('resumeSavedBtn').onclick = window.satSprintResumeSaved;
    document.getElementById('discardSavedBtn').onclick = function () {
        window.satSprintClearSavedRun();
        resumeScreen.classList.add('hidden');
    };

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            if (window.SatAudio) window.SatAudio.pauseMusic();
            if (typeof state !== 'undefined' && state === 'playing') {
                if (window.satSprintPauseRun) window.satSprintPauseRun('background');
                else {
                    window.satSprintSaveRun('background');
                    state = 'paused';
                    if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(false);
                }
            }
        } else {
            if (typeof state !== 'undefined' && state === 'home' && window.SatAudio) {
                window.SatAudio.setMusicMode('menu');
                window.SatAudio.resumeMusic();
            }
        }
    });

    window.addEventListener('load', function () {
        setTimeout(function () {
            if (window.satSprintGetSavedRun()) window.satSprintShowSavedRun();
        }, 250);
    });
})();

// ============================================================
// Cup button + sound toggles (fixed scoping via satSprintGetCore)
// ============================================================
(function () {
    const cupButton = document.getElementById('cupButton');
    const supportScreen = document.getElementById('supportScreen');

    if (cupButton) {
        let cupCooldown = false;
        cupButton.onclick = function () {
            if (cupCooldown) return;
            cupCooldown = true;
            setTimeout(() => cupCooldown = false, 1200);
            cupButton.classList.add('shake');
            setTimeout(() => cupButton.classList.remove('shake'), 450);

            const supportScreen = document.getElementById('supportScreen');
            const pauseScreen = document.getElementById('pauseScreen');
            if (!supportScreen) return;

            if (typeof state !== 'undefined' && state === 'playing') {
                if (window.satSprintSaveRun) window.satSprintSaveRun('support');
                state = 'paused';
                if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(false);
                if (window.SatAudio) window.SatAudio.pauseMusic();
            }

            if (pauseScreen) pauseScreen.classList.add('hidden');
            ['homeScreen', 'startScreen', 'overScreen', 'quizScreen', 'lifeScreen', 'walletScreen', 'saveResumeScreen'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            supportScreen.classList.remove('hidden');
        };
    }

    // sound toggles
    const musicToggleBtn = document.getElementById('musicToggleBtn');
    const sfxToggleBtn = document.getElementById('sfxToggleBtn');
    if (musicToggleBtn && window.SatAudio) {
        musicToggleBtn.addEventListener('click', function () {
            window.SatAudio.setMusicEnabled(!window.SatAudio.musicEnabled);
            musicToggleBtn.textContent = window.SatAudio.musicEnabled ? '🎵 On' : '🎵 Off';
        });
    }
    if (sfxToggleBtn && window.SatAudio) {
        sfxToggleBtn.addEventListener('click', function () {
            window.SatAudio.setSfxEnabled(!window.SatAudio.sfxEnabled);
            sfxToggleBtn.textContent = window.SatAudio.sfxEnabled ? '🔊 On' : '🔊 Off';
        });
    }

    // unlock audio on first user gesture anywhere
    function unlockAudio() {
        if (window.SatAudio) window.SatAudio.unlock();
        document.removeEventListener('pointerdown', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
    }
    document.addEventListener('pointerdown', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
})();
