(function () {
    'use strict';
    if (typeof window !== 'undefined') {
        const apiBase = String(window.SAT_SPRINT_API_BASE_URL || '').replace(/\/+$/, '');
        if (apiBase) {
            window.SAT_SPRINT_HIGH_SCORE_API = window.SAT_SPRINT_HIGH_SCORE_API || `${apiBase}/api/high-scores`;
            window.SAT_SPRINT_REMOTE_SAVE_API = window.SAT_SPRINT_REMOTE_SAVE_API || `${apiBase}/api/run-snapshot`;
            window.SAT_SPRINT_PLAYER_API = window.SAT_SPRINT_PLAYER_API || `${apiBase}/api/players/register`;
        }
    }

    // ============================================================
    // DOM refs
    // ============================================================
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const wrap = document.getElementById('wrap');
    const scoreEl = document.getElementById('score');
    const seasonStageLabel = document.getElementById('seasonStage');
    const bestEl = document.getElementById('best');
    const startScreen = document.getElementById('startScreen');
    const overScreen = document.getElementById('overScreen');
    const finalScoreEl = document.getElementById('finalScore');
    const bestScoreLineEl = document.getElementById('bestScoreLine');
    const coinLineEl = document.getElementById('coinLine');
    const startBtn = document.getElementById('startBtn');
    const retryBtn = document.getElementById('retryBtn');
    const homeScreen = document.getElementById('homeScreen');
    const onlinePlayersWidget = document.getElementById('onlinePlayersWidget');
    const onlinePlayersToggle = document.getElementById('onlinePlayersToggle');
    const onlinePlayersPanel = document.getElementById('onlinePlayersPanel');
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
    const homeLearningLevel = document.getElementById('homeLearningLevel');
    const playerNameInput = document.getElementById('playerName');
    const registerPlayerBtn = document.getElementById('registerPlayerBtn');
    const playerIdentityStatus = document.getElementById('playerIdentityStatus');
    const playerIdentityEditor = document.getElementById('playerIdentityEditor');
    const registeredPlayerSummary = document.getElementById('registeredPlayerSummary');
    const registeredPlayerName = document.getElementById('registeredPlayerName');
    const changePlayerNameBtn = document.getElementById('changePlayerNameBtn');
    const cancelChangePlayerNameBtn = document.getElementById('cancelChangePlayerNameBtn');
    const streakEl = document.getElementById('streak');
    const lightningEl = document.getElementById('lightning');
    const quizScreen = document.getElementById('quizScreen');
    const quizLevelLabel = document.getElementById('quizLevelLabel');
    const quizQuestionEl = document.getElementById('quizQuestion');
    const quizAnswersEl = document.getElementById('quizAnswers');
    const quizFeedbackEl = document.getElementById('quizFeedback');
    const quizHintEl = document.getElementById('quizHint');
    const finalLightningEl = document.getElementById('finalLightning');
    const rewardPointsEl = document.getElementById('rewardPoints');

    let lightningCharge = 0;
    let satsCollected = 0;
    let rewardPoints = 0;
    let quizPending = false;
    let quizZone = null; // legacy, no longer used
    let nextQuizAt = 25 + Math.random() * 15;
    const DOUBLE_JUMP_COIN_CHANCE = 0.12;
    let quizWarningDialogOpen = false;

    const STORE_KEY = 'sat_sprint_player_v3';
    const KNOWLEDGE_LEVELS = ['Beginner', 'Intermediate', 'Expert'];
    const CORRECT_ANSWERS_TO_ADVANCE = 5;
    function emptyKnowledgeProgress() {
        return { level: 0, correctToNext: 0, seenQuestionIds: { beginner: [], intermediate: [], expert: [] } };
    }
    function normalizeKnowledgeProgress(progress) {
        const safe = emptyKnowledgeProgress();
        if (!progress || typeof progress !== 'object') return safe;
        safe.level = Math.max(0, Math.min(KNOWLEDGE_LEVELS.length - 1, Math.floor(Number(progress.level) || 0)));
        safe.correctToNext = Math.max(0, Math.min(CORRECT_ANSWERS_TO_ADVANCE - 1, Math.floor(Number(progress.correctToNext) || 0)));
        for (const key of Object.keys(safe.seenQuestionIds)) {
            const seen = progress.seenQuestionIds && progress.seenQuestionIds[key];
            safe.seenQuestionIds[key] = Array.isArray(seen) ? [...new Set(seen.filter(id => typeof id === 'string'))] : [];
        }
        if (safe.level === KNOWLEDGE_LEVELS.length - 1) safe.correctToNext = 0;
        return safe;
    }
    const defaultPlayer = {
        name: '',
        playerId: '',
        lives: 10,
        gameSats: 0,
        totalRuns: 0,
        best: 0,
        lastLifeRefill: 0,
        developerTips: 0,
        virtualRewardBalance: 0,
        knowledgeProgress: emptyKnowledgeProgress()
    };
    let account = { ...defaultPlayer };
    let editingPlayerName = false;
    const scores = window.SatSprintHighScores;
    const cleanName = scores.cleanName;
    const esc = scores.escapeHtml;
    try { account = { ...defaultPlayer, ...(JSON.parse(localStorage.getItem(STORE_KEY)) || {}) }; } catch (e) { }
    account.knowledgeProgress = normalizeKnowledgeProgress(account.knowledgeProgress);
    function savePlayer() { localStorage.setItem(STORE_KEY, JSON.stringify(account)); }

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
    function setPlayerNameUI() {
        if (playerNameInput) playerNameInput.value = account.name || '';
        if (registeredPlayerName) registeredPlayerName.textContent = account.name || '';
        const registered = Boolean(account.playerId);
        if (registeredPlayerSummary) registeredPlayerSummary.hidden = !registered || editingPlayerName;
        if (playerIdentityEditor) playerIdentityEditor.hidden = registered && !editingPlayerName;
        if (cancelChangePlayerNameBtn) cancelChangePlayerNameBtn.hidden = !registered || !editingPlayerName;
        if (playerIdentityStatus) {
            playerIdentityStatus.className = 'identityStatus';
            if (!registered) playerIdentityStatus.textContent = 'Names are public. No password is used.';
            else if (editingPlayerName) playerIdentityStatus.textContent = 'Save a new name to switch your player identity.';
            else playerIdentityStatus.textContent = '';
        }
    }
    async function registerPlayerName() {
        const name = cleanName(playerNameInput && playerNameInput.value);
        if (!playerNameInput || !playerNameInput.value.trim()) {
            if (playerIdentityStatus) {
                playerIdentityStatus.className = 'identityStatus error';
                playerIdentityStatus.textContent = 'Enter a player name first.';
            }
            return;
        }
        if (window.location.protocol === 'file:') {
            if (playerIdentityStatus) {
                playerIdentityStatus.className = 'identityStatus error';
                playerIdentityStatus.textContent = 'Open the game through a local web server (for example, http://localhost:5500) to connect to global registration.';
            }
            return;
        }
        if (!window.SAT_SPRINT_PLAYER_API) {
            if (playerIdentityStatus) {
                playerIdentityStatus.className = 'identityStatus error';
                playerIdentityStatus.textContent = 'The SAT SPRINT API URL is not configured.';
            }
            return;
        }
        registerPlayerBtn.disabled = true;
        if (playerIdentityStatus) {
            playerIdentityStatus.className = 'identityStatus';
            playerIdentityStatus.textContent = 'Registering name…';
        }
        try {
            const response = await fetch(window.SAT_SPRINT_PLAYER_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const responseText = await response.text();
            let result = {};
            try { result = responseText ? JSON.parse(responseText) : {}; } catch (e) { }
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Name registration is not available on the server yet. The SAT SPRINT API needs the latest deployment.');
                }
                throw new Error(result.error || `Could not register that name (server error ${response.status}).`);
            }
            const previousPlayerId = account.playerId;
            account.name = cleanName(result.name);
            account.playerId = result.id;
            if (previousPlayerId && previousPlayerId !== result.id) account.knowledgeProgress = emptyKnowledgeProgress();
            savePlayer();
            editingPlayerName = false;
            setPlayerNameUI();
            if (window.satSprintSendPresence) window.satSprintSendPresence();
        } catch (error) {
            if (playerIdentityEditor) playerIdentityEditor.hidden = false;
            if (registeredPlayerSummary) registeredPlayerSummary.hidden = true;
            if (playerIdentityStatus) {
                playerIdentityStatus.className = 'identityStatus error';
                playerIdentityStatus.textContent = error.message || 'Could not reach the server. Try again.';
            }
        } finally {
            registerPlayerBtn.disabled = false;
        }
    }
    if (registerPlayerBtn) registerPlayerBtn.addEventListener('click', registerPlayerName);
    if (changePlayerNameBtn) changePlayerNameBtn.addEventListener('click', () => {
        editingPlayerName = true;
        setPlayerNameUI();
        playerNameInput && playerNameInput.focus();
    });
    if (cancelChangePlayerNameBtn) cancelChangePlayerNameBtn.addEventListener('click', () => {
        editingPlayerName = false;
        setPlayerNameUI();
    });
    if (playerNameInput) {
        playerNameInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                registerPlayerName();
            }
        });
    }
    window.satSprintGetPlayerInfo = function () {
        return {
            name: account.name || 'Player',
            playerId: account.playerId || null,
            lives: account.lives,
            gameSats: account.gameSats,
            best: account.best
        };
    };
    function addHighScore(name, score) { return scores.add(name, score, account.playerId); }
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
    scores.load();

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
                scores.load();
            } catch (e) {
                // ignore
            }
        }, POLL_MS);

        (function setupWebSocket() {
            const apiOrigin = window.SAT_SPRINT_API_BASE_URL ? new URL(window.SAT_SPRINT_API_BASE_URL) : location;
            const wsProtocol = apiOrigin.protocol === 'https:' ? 'wss:' : 'ws:';
            const defaultWs = `${wsProtocol}//${apiOrigin.host}/ws`;
            const wsUrl = window.SAT_SPRINT_WS_URL || defaultWs;
            if (!wsUrl) return;
            let ws;
            let reconnectTimer = null;
            const RECONNECT_MS = 5000;

            function connect() {
                try { ws = new WebSocket(wsUrl); window.SAT_SPRINT_WS = ws; } catch (e) { return; }

                const livePlayers = {};
                let runProgressTicker = null;

                function sendPresence() {
                    if (!ws || ws.readyState !== WebSocket.OPEN) return;
                    try { ws.send(JSON.stringify({ type: 'presence', payload: { name: account.name || 'Player' } })); } catch (e) { }
                }
                window.satSprintSendPresence = sendPresence;

                function renderLivePlayers() {
                    const el = document.getElementById('onlinePlayersList');
                    if (!el) return;
                    const items = Object.values(livePlayers)
                        .map(p => ({
                            id: p.id,
                            playerId: p.playerId || null,
                            name: cleanName(p.name || 'Player'),
                            progress: p.progress || {},
                            lastSeen: p.lastSeen || 0
                        }))
                        .sort((a, b) => (b.progress.score || 0) - (a.progress.score || 0));
                    const uniquePlayers = Array.from(items.reduce((unique, player) => {
                        const key = player.playerId || player.id;
                        const previous = unique.get(key);
                        const previousPlaying = previous && typeof previous.progress.score !== 'undefined';
                        const playerPlaying = typeof player.progress.score !== 'undefined';
                        if (!previous || (!previousPlaying && playerPlaying)) unique.set(key, player);
                        return unique;
                    }, new Map()).values());
                    const count = uniquePlayers.length;
                    const countLabel = document.getElementById('onlinePlayersCount');
                    const panelCount = document.getElementById('onlinePlayersPanelCount');
                    if (countLabel) countLabel.textContent = `${count} online`;
                    if (panelCount) panelCount.textContent = count;
                    if (!uniquePlayers.length) {
                        el.innerHTML = '<div style="color:#94a3b8">No one online yet</div>';
                        return;
                    }
                    el.innerHTML = uniquePlayers.map(p => {
                        const playing = p.progress && typeof p.progress.score !== 'undefined';
                        const status = playing ? 'playing' : 'online';
                        const progress = playing ? ` <span style="margin-left:auto;color:#94a3b8">${Math.floor(p.progress.distance || 0)}m</span>` : '';
                        return `<div class="onlinePlayer"><span class="onlineDot"></span><strong>${esc(p.name)}</strong><span class="playerStatus">${status}</span>${progress}</div>`;
                    }).join('');
                }

                ws.addEventListener('open', () => {
                    console.info('SAT SPRINT WS connected to', wsUrl);
                    if (onlinePlayersWidget) onlinePlayersWidget.classList.add('connected');
                    sendPresence();
                    try { ws.send(JSON.stringify({ type: 'get_active_players' })); } catch (e) { }
                });

                ws.addEventListener('message', (ev) => {
                    try {
                        const msg = JSON.parse(ev.data);
                        if (!msg || !msg.type) return;
                        if (msg.type === 'welcome') {
                            if (Array.isArray(msg.data)) scores.set(msg.data, false);
                            window.SAT_SPRINT_CLIENT_ID = msg.id;
                            return;
                        }
                        if (msg.type === 'high_scores' && Array.isArray(msg.data)) {
                            scores.set(msg.data, true);
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
                    if (onlinePlayersWidget) onlinePlayersWidget.classList.remove('connected');
                    Object.keys(livePlayers).forEach(id => delete livePlayers[id]);
                    renderLivePlayers();
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
                const origStartFromHome = startFromHome;
                startFromHome = function () {
                    origStartFromHome();
                    if (state === 'playing') startRunProgressTicker();
                    sendPresence();
                };
                const origEndGame = endGame;
                endGame = function () { stopRunProgressTicker(); origEndGame(); sendPresence(); };
                const origShowHome = showHome;
                showHome = function () { origShowHome(); sendPresence(); };

                if (playerNameInput) {
                    playerNameInput.addEventListener('blur', sendPresence);
                    playerNameInput.addEventListener('input', sendPresence);
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

    // Each level has its own shuffled question cycle. A player's seen IDs are
    // persisted in their local profile so a refresh or new run won't repeat one.
    const quizBanks = {
        beginner: [
            { id: 'b-sat', q: 'What is a satoshi (sat)?', a: ['The smallest unit of bitcoin commonly used', 'A Bitcoin block', 'A type of wallet'], correct: 0 },
            { id: 'b-units', q: 'How many satoshis are in one bitcoin?', a: ['One million', 'One hundred million', 'One thousand'], correct: 1 },
            { id: 'b-block', q: 'What does a Bitcoin block contain?', a: ['A batch of transactions', 'A list of passwords', 'A wallet backup'], correct: 0 },
            { id: 'b-node', q: 'What does a Bitcoin full node do?', a: ['Independently checks Bitcoin rules and transactions', 'Sets the price of bitcoin', 'Creates every wallet'], correct: 0 },
            { id: 'b-supply', q: 'What is Bitcoin’s maximum supply limit?', a: ['21 million BTC', 'There is no limit', '210 million BTC'], correct: 0 },
            { id: 'b-halving', q: 'What changes during a Bitcoin halving?', a: ['The block subsidy is cut in half', 'Wallet balances are cut in half', 'Transactions stop for a day'], correct: 0 },
            { id: 'b-mempool', q: 'What is the mempool?', a: ['A waiting area for transactions not yet confirmed', 'A type of mining machine', 'A list of wallet passwords'], correct: 0 },
            { id: 'b-lightning', q: 'What is the Lightning Network designed to help with?', a: ['Fast, low-value Bitcoin payments', 'Changing Bitcoin’s supply limit', 'Replacing private keys'], correct: 0 },
            { id: 'b-private-key', q: 'What does a private key let its holder do?', a: ['Authorize spending from its associated funds', 'Change the Bitcoin rules', 'Reverse any confirmed payment'], correct: 0 },
            { id: 'b-seed', q: 'What is a wallet recovery phrase for?', a: ['Restoring access to a wallet', 'Sharing a payment receipt', 'Reducing transaction fees'], correct: 0 },
            { id: 'b-address', q: 'What is a Bitcoin address mainly used for?', a: ['Receiving a payment', 'Signing a block', 'Recovering a lost seed phrase'], correct: 0 },
            { id: 'b-confirmation', q: 'A transaction gets its first confirmation when…', a: ['It is included in a block accepted by the network', 'It appears in a wallet draft', 'A miner sees it in the mempool'], correct: 0 },
            { id: 'b-fees', q: 'Why do Bitcoin transactions include fees?', a: ['They compete for limited block space', 'They pay the wallet company a subscription', 'They destroy the bitcoin sent'], correct: 0 },
            { id: 'b-miner', q: 'What is a Bitcoin miner trying to do?', a: ['Find valid proof of work for a block', 'Choose who may own bitcoin', 'Approve transactions by identity'], correct: 0 },
            { id: 'b-inventor', q: 'Who published the original Bitcoin paper?', a: ['Satoshi Nakamoto', 'Hal Finney alone', 'The Bitcoin Foundation'], correct: 0 }
        ],
        intermediate: [
            { id: 'i-utxo', q: 'What is a UTXO?', a: ['An unspent transaction output available to be spent', 'A node that has never synced', 'A Lightning routing fee'], correct: 0 },
            { id: 'i-pow', q: 'In proof of work, miners repeatedly hash block data mainly to…', a: ['Find a hash that meets the network target', 'Encrypt every transaction', 'Reveal the sender’s private key'], correct: 0 },
            { id: 'i-retarget', q: 'Bitcoin adjusts mining difficulty to keep…', a: ['Block production near its target pace over time', 'Every transaction the same size', 'The bitcoin price within a fixed range'], correct: 0 },
            { id: 'i-merkle', q: 'What does a Merkle root summarize?', a: ['The transactions committed to by a block', 'The full history of every wallet', 'The current mining hardware list'], correct: 0 },
            { id: 'i-coinbase', q: 'What is the coinbase transaction in a block?', a: ['The transaction that assigns the block subsidy and fees', 'A payment to the Coinbase exchange', 'A transaction with no inputs from any wallet'], correct: 0 },
            { id: 'i-script', q: 'Bitcoin Script is primarily used to…', a: ['Define conditions for spending transaction outputs', 'Run general-purpose web applications', 'Set exchange rates'], correct: 0 },
            { id: 'i-segwit', q: 'What did SegWit change in Bitcoin transactions?', a: ['It moved signature data into witness data and helped address malleability', 'It replaced proof of work with proof of stake', 'It made all transactions private'], correct: 0 },
            { id: 'i-taproot', q: 'What signature scheme did Taproot introduce for key-path spends?', a: ['Schnorr signatures', 'RSA signatures', 'PGP signatures'], correct: 0 },
            { id: 'i-channel', q: 'In a Lightning payment channel, most updates happen…', a: ['Off-chain between participants, with settlement possible on-chain', 'In a new Bitcoin block for every update', 'On a central exchange ledger'], correct: 0 },
            { id: 'i-liquidity', q: 'Why does Lightning routing depend on channel liquidity?', a: ['A route needs enough available balance in the payment direction', 'Liquidity sets the Bitcoin supply cap', 'Channels only route to miners'], correct: 0 },
            { id: 'i-watchonly', q: 'What can a watch-only wallet generally do?', a: ['Monitor addresses without holding the keys needed to spend', 'Sign transactions without keys', 'Reverse confirmed payments'], correct: 0 },
            { id: 'i-rbf', q: 'What is Replace-by-Fee used for?', a: ['Broadcasting a replacement transaction with a higher fee under applicable policy', 'Replacing a Bitcoin block after confirmation', 'Changing a wallet’s seed phrase'], correct: 0 },
            { id: 'i-satvb', q: 'What does a fee rate in sat/vB measure?', a: ['Satoshis paid per virtual byte of transaction size', 'Satoshis per bitcoin block reward', 'Virtual bytes per Lightning channel'], correct: 0 },
            { id: 'i-reorg', q: 'What is a chain reorganization?', a: ['A node switching to a valid competing chain with more accumulated work', 'A wallet moving funds to a new address', 'A miner changing its pool'], correct: 0 },
            { id: 'i-hashlock', q: 'What does a hash lock require to be satisfied?', a: ['A value whose hash matches a specified hash', 'A valid email address', 'A miner’s private key'], correct: 0 }
        ],
        expert: [
            { id: 'e-chainwork', q: 'When comparing valid Bitcoin chains, what determines which chain a node prefers?', a: ['The chain with the most accumulated proof of work', 'The chain with the most blocks regardless of work', 'The chain announced by the most exchanges'], correct: 0 },
            { id: 'e-header', q: 'Which item is committed to by a Bitcoin block header?', a: ['The Merkle root of the block’s transactions', 'Every transaction in full', 'The miner’s identity document'], correct: 0 },
            { id: 'e-nonce', q: 'Why do miners vary extra-nonce data as well as the header nonce?', a: ['To create more candidate header hashes when nonce values are exhausted', 'To change the block subsidy', 'To avoid validating transactions'], correct: 0 },
            { id: 'e-signature', q: 'What does a valid digital signature prove in a Bitcoin spend?', a: ['Authorization by the required key, without revealing its private key', 'The real-world identity of the spender', 'That the payment cannot be replaced before confirmation'], correct: 0 },
            { id: 'e-hash', q: 'Bitcoin proof of work uses which hash construction for block headers?', a: ['Double SHA-256', 'Single MD5', 'SHA-1 followed by RSA'], correct: 0 },
            { id: 'e-psbt', q: 'What is a PSBT designed to support?', a: ['Passing an unsigned or partially signed transaction between signers', 'Sending private keys to miners', 'Compressing the blockchain'], correct: 0 },
            { id: 'e-htlc', q: 'What two conditions are commonly combined in a Lightning HTLC?', a: ['A hash condition and a time lock', 'A miner fee and a seed phrase', 'A block height and an exchange rate'], correct: 0 },
            { id: 'e-cltv', q: 'What does CHECKLOCKTIMEVERIFY enforce in a spending script?', a: ['An absolute time or block-height condition before spending', 'A maximum transaction fee', 'A minimum number of signatures from miners'], correct: 0 },
            { id: 'e-csv', q: 'What does CHECKSEQUENCEVERIFY support?', a: ['Relative time-lock conditions on an output', 'Changing a transaction after confirmation', 'Setting mining difficulty'], correct: 0 },
            { id: 'e-coin-selection', q: 'Why might a wallet create a change output?', a: ['Inputs are spent whole, so leftover value is returned to a wallet-controlled output', 'Change outputs are required by miners for every payment', 'It hides the transaction from full nodes'], correct: 0 },
            { id: 'e-txid', q: 'What is a key effect of SegWit’s witness separation on a transaction ID?', a: ['Witness data is excluded from the traditional txid calculation', 'The txid becomes the recipient’s address', 'The txid changes every time a node relays it'], correct: 0 },
            { id: 'e-difficulty', q: 'What is Bitcoin’s difficulty adjustment based on?', a: ['Observed time to mine the previous retarget period compared with the target', 'The number of active wallets', 'The market price of bitcoin'], correct: 0 },
            { id: 'e-watchtower', q: 'What can a Lightning watchtower help a user do?', a: ['Detect and respond to certain channel breaches while the user is offline', 'Recover a lost seed phrase', 'Guarantee every payment routes instantly'], correct: 0 },
            { id: 'e-splice', q: 'What does Lightning channel splicing allow participants to do?', a: ['Change channel funding while keeping the channel operational through the process', 'Change Bitcoin’s consensus rules', 'Route a payment without any channel liquidity'], correct: 0 },
            { id: 'e-pool', q: 'Joining a mining pool changes how miners earn rewards, but who independently enforces consensus rules?', a: ['Each validating full node', 'The mining pool operator alone', 'The wallet provider'], correct: 0 }
        ]
    };

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
    const SEASON_STAGE_DISTANCE = 150;
    const SEASONS = [
        { name: 'SPRING', icon: '🌸', particle: 'petal', sky: ['#24466d', '#43849a', '#c98791'], horizonGlow: 'rgba(255,151,190,0.38)', aurora: 'rgba(111,225,185,0.24)', celestial: ['#fff0bb', '#ffc879', '#eb8f50'], farHills: ['#5b9676', '#3b6668'], nearHills: ['#47835f', '#2d5650'], ground: ['#3d654f', '#24483f', '#152c30'], edge: '#ffacd0' },
        { name: 'SUMMER', icon: '☀', particle: 'spark', sky: ['#15508a', '#2185ad', '#ffc078'], horizonGlow: 'rgba(255,195,92,0.42)', aurora: 'rgba(49,188,216,0.24)', celestial: ['#fff6bd', '#ffd34e', '#f58b24'], farHills: ['#59a574', '#347b5d'], nearHills: ['#42915d', '#28694a'], ground: ['#456b4a', '#264b3a', '#142d2d'], edge: '#ffd166' },
        { name: 'AUTUMN', icon: '🍂', particle: 'leaf', sky: ['#39395e', '#805069', '#d97c4a'], horizonGlow: 'rgba(255,119,55,0.4)', aurora: 'rgba(201,92,95,0.21)', celestial: ['#ffe1b0', '#ffae55', '#d85a2d'], farHills: ['#966b4d', '#69504b'], nearHills: ['#81583f', '#503d42'], ground: ['#503a37', '#332a30', '#1e222a'], edge: '#ff873e' },
        { name: 'WINTER', icon: '❄', particle: 'snow', sky: ['#1c3a62', '#3d77a0', '#c3dce5'], horizonGlow: 'rgba(137,218,255,0.36)', aurora: 'rgba(91,177,255,0.25)', celestial: ['#f3fcff', '#b9e9ff', '#70b9e8'], farHills: ['#719bb8', '#4a7190'], nearHills: ['#5b809b', '#3a5874'], ground: ['#3a5870', '#263f57', '#172a40'], edge: '#a5e8ff' }
    ];

    function seasonForDistance(value) {
        const stage = Math.floor(Math.max(0, Number(value) || 0) / SEASON_STAGE_DISTANCE);
        return { ...SEASONS[stage % SEASONS.length], stage: stage + 1 };
    }

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
        const count = Math.max(48, Math.floor(W / 7));
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H * 0.62,
                r: 0.7 + Math.random() * 1.8,
                p: Math.random() * Math.PI * 2,
                sp: 0.5 + Math.random() * 1.5,
                layer: Math.random() < 0.6 ? 1 : 2,
                color: ['#dbeafe', '#bae6fd', '#fde68a'][Math.floor(Math.random() * 3)]
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
                        windows.push({
                            wx: cIdx * 14 + 6,
                            wy: r * 18 + 8,
                            lit: Math.random() < 0.7,
                            color: Math.random() < 0.16 ? 'rgba(105,211,255,0.85)' : 'rgba(255,177,75,0.82)'
                        });
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
        if (window.SatAudio) {
            window.SatAudio.sfx.death();
            window.SatAudio.pauseMusic();
        }
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
            nextQuizAt = 25 + Math.random() * 15;
            quizPending = true;
            if (!quizWarningDialogOpen) {
                quizWarningDialogOpen = true;
                if (window.satSprintSaveRun) window.satSprintSaveRun('quiz-warning');
                if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(false);
                if (window.SatAudio) window.SatAudio.pauseMusic();
                state = 'paused';
                if (window.satSprintSendPresence) window.satSprintSendPresence();
                document.getElementById('quizWarningScreen')?.classList.remove('hidden');
            }
        }
    }

    function pauseForQuiz() {
        if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(false);
        if (window.SatAudio) window.SatAudio.pauseMusic();
        state = 'quiz';
        if (window.satSprintSendPresence) window.satSprintSendPresence();
        quizWarningDialogOpen = false;
        quizPending = false;
        quizTimer = 0;
        const progress = normalizeKnowledgeProgress(account.knowledgeProgress);
        account.knowledgeProgress = progress;
        const levelKey = ['beginner', 'intermediate', 'expert'][progress.level];
        const bank = quizBanks[levelKey];
        let unseen = bank.filter(question => !progress.seenQuestionIds[levelKey].includes(question.id));
        if (!unseen.length) {
            progress.seenQuestionIds[levelKey] = [];
            unseen = bank.slice();
        }
        const q = unseen[Math.floor(Math.random() * unseen.length)];
        progress.seenQuestionIds[levelKey].push(q.id);
        savePlayer();
        updateHomeUI();
        if (quizLevelLabel) {
            quizLevelLabel.textContent = `${KNOWLEDGE_LEVELS[progress.level].toUpperCase()} · ${progress.correctToNext}/${CORRECT_ANSWERS_TO_ADVANCE} CORRECT TO NEXT LEVEL`;
        }
        quizQuestionEl.textContent = q.q;
        quizAnswersEl.innerHTML = '';
        quizFeedbackEl.textContent = '';
        const shuffledAnswers = q.a.map((answer, index) => ({ answer, correct: index === q.correct }));
        for (let i = shuffledAnswers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledAnswers[i], shuffledAnswers[j]] = [shuffledAnswers[j], shuffledAnswers[i]];
        }
        let answered = false;
        shuffledAnswers.forEach(option => {
            const b = document.createElement('button');
            b.textContent = option.answer;
            b.onclick = () => {
                if (answered) return;
                answered = true;
                quizAnswersEl.querySelectorAll('button').forEach(button => { button.disabled = true; });
                if (option.correct) {
                    quizStreak++;
                    rewardPoints += 250;
                    lightningCharge = Math.min(100, lightningCharge + 25);
                    const currentProgress = account.knowledgeProgress;
                    let levelUp = false;
                    if (currentProgress.level < KNOWLEDGE_LEVELS.length - 1) {
                        currentProgress.correctToNext++;
                        if (currentProgress.correctToNext >= CORRECT_ANSWERS_TO_ADVANCE) {
                            currentProgress.level++;
                            currentProgress.correctToNext = 0;
                            levelUp = true;
                        }
                    }
                    savePlayer();
                    updateHomeUI();
                    quizFeedbackEl.textContent = levelUp
                        ? `✓ Level up! ${KNOWLEDGE_LEVELS[currentProgress.level]} unlocked and saved!`
                        : currentProgress.level < KNOWLEDGE_LEVELS.length - 1
                            ? `✓ Correct! +250 points · ${currentProgress.correctToNext}/${CORRECT_ANSWERS_TO_ADVANCE} to ${KNOWLEDGE_LEVELS[currentProgress.level + 1]}`
                            : '✓ Correct! +250 reward points · Expert level saved';
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
                    if (window.SatAudio) window.SatAudio.resumeMusic();
                    quizPending = false;
                }, 750);
            };
            quizAnswersEl.appendChild(b);
        });
        quizScreen.classList.remove('hidden');
    }

    function createQuizCheckpoint() {
        quizZone = { kind: 'quizCheckpoint', x: W + 340, w: QUIZ_ZONE_WIDTH, passed: false };
        obstacles.push(quizZone);
        quizPending = true;
        if (!quizWarningDialogOpen) {
            quizWarningDialogOpen = true;
            if (window.satSprintSaveRun) {
                window.satSprintSaveRun('quiz-warning');
            }
            if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(false);
            state = 'paused';
            document.getElementById('quizWarningScreen')?.classList.remove('hidden');
        }
    }

    function hideQuizWarningDialog() {
        document.getElementById('quizWarningScreen')?.classList.add('hidden');
        quizWarningDialogOpen = false;
    }

    function updateHomeUI() {
        refillLives();
        homeLives.textContent = account.lives + ' / 10';
        homeSats.textContent = account.gameSats;
        const knowledgeProgress = normalizeKnowledgeProgress(account.knowledgeProgress);
        account.knowledgeProgress = knowledgeProgress;
        if (homeLearningLevel) {
            const isExpert = knowledgeProgress.level === KNOWLEDGE_LEVELS.length - 1;
            homeLearningLevel.textContent = isExpert
                ? 'EXPERT · SAVED'
                : `${KNOWLEDGE_LEVELS[knowledgeProgress.level].toUpperCase()} · ${CORRECT_ANSWERS_TO_ADVANCE - knowledgeProgress.correctToNext} TO NEXT`;
        }
        walletGameSats.textContent = account.gameSats;
        walletPoints.textContent = rewardPoints;
        walletReward.textContent = account.virtualRewardBalance + ' sats';
        const sec = nextLifeSeconds();
        homeTimer.textContent = sec ? 'Next free life in ' + fmtTime(sec) : '';
    }
    function showHome() {
        if (window.satSprintSetGameplayUI) window.satSprintSetGameplayUI(false);
        state = 'home';
        [startScreen, overScreen, quizScreen, lifeScreen, supportScreen, walletScreen].forEach(x => x.classList.add('hidden'));
        homeScreen.classList.remove('hidden');
        setPlayerNameUI();
        scores.load();
        updateHomeUI();
        if (window.SatAudio) window.SatAudio.setModeIdle();
    }
    function startFromHome() {
        if (!account.playerId) {
            editingPlayerName = true;
            setPlayerNameUI();
            if (playerIdentityStatus) {
                playerIdentityStatus.className = 'identityStatus error';
                playerIdentityStatus.textContent = 'Save your global player name before playing.';
            }
            playerNameInput && playerNameInput.focus();
            return;
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
        if (window.SatAudio) window.SatAudio.pauseMusic();
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
    if (onlinePlayersToggle && onlinePlayersPanel) {
        onlinePlayersToggle.addEventListener('click', function () {
            const expanded = onlinePlayersToggle.getAttribute('aria-expanded') === 'true';
            onlinePlayersToggle.setAttribute('aria-expanded', String(!expanded));
            onlinePlayersPanel.hidden = expanded;
        });
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
            if (window.SatAudio) window.SatAudio.resumeMusic();
            state = 'playing';
            if (window.satSprintSendPresence) window.satSprintSendPresence();
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
    }

    // ---------- draw ----------
    function drawBackground() {
        const season = seasonForDistance(distance);
        const stageLabel = `${season.icon} ${season.name} · STAGE ${season.stage}`;
        if (seasonStageLabel && seasonStageLabel.textContent !== stageLabel) seasonStageLabel.textContent = stageLabel;
        // Saturated twilight sky with soft color blooms behind the skyline.
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, season.sky[0]);
        g.addColorStop(0.48, season.sky[1]);
        g.addColorStop(1, season.sky[2]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const horizonGlow = ctx.createRadialGradient(W * 0.52, groundY * 0.86, 8, W * 0.52, groundY * 0.86, W * 0.72);
        horizonGlow.addColorStop(0, season.horizonGlow);
        horizonGlow.addColorStop(0.48, 'rgba(244,89,90,0.09)');
        horizonGlow.addColorStop(1, 'rgba(244,89,90,0)');
        ctx.fillStyle = horizonGlow;
        ctx.fillRect(0, 0, W, groundY + 20);
        const aurora = ctx.createRadialGradient(W * 0.22, H * 0.26, 2, W * 0.22, H * 0.26, W * 0.58);
        aurora.addColorStop(0, season.aurora);
        aurora.addColorStop(1, 'rgba(81,116,255,0)');
        ctx.fillStyle = aurora;
        ctx.fillRect(0, 0, W, groundY);

        // twinkling stars (proper wrap: offset goes negative, % must stay >= 0)
        for (const s of stars) {
            const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(elapsed * s.sp + s.p));
            ctx.globalAlpha = tw * (s.layer === 2 ? 0.95 : 0.68);
            ctx.fillStyle = s.color;
            const sx = ((s.x + starOffset * s.layer * 0.2) % W + W) % W;
            ctx.beginPath(); ctx.arc(sx, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // A bright seasonal sun/moon glow keeps the sky recognizable across all palettes.
        const moonX = W * 0.82, moonY = H * 0.18;
        const glow = ctx.createRadialGradient(moonX, moonY, 6, moonX, moonY, 135);
        glow.addColorStop(0, season.horizonGlow);
        glow.addColorStop(0.35, season.aurora);
        glow.addColorStop(1, 'rgba(247,147,26,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(moonX, moonY, 110, 0, Math.PI * 2); ctx.fill();
        const moonFace = ctx.createRadialGradient(moonX - 10, moonY - 12, 2, moonX, moonY, 38);
        moonFace.addColorStop(0, season.celestial[0]);
        moonFace.addColorStop(0.55, season.celestial[1]);
        moonFace.addColorStop(1, season.celestial[2]);
        ctx.fillStyle = moonFace;
        ctx.beginPath(); ctx.arc(moonX, moonY, 34, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = season.name === 'WINTER' ? '#224663' : '#6a3b28';
        ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('₿', moonX, moonY + 1);

        // distant city skyline (scrolls LEFT with the world — offset is negative)
        const cityPeriod = W + 400;
        for (const b of city) {
            const bx = ((b.x + cityOffset) % cityPeriod + cityPeriod) % cityPeriod;
            const buildingGradient = ctx.createLinearGradient(0, groundY - b.h, 0, groundY);
            buildingGradient.addColorStop(0, season.farHills[0]);
            buildingGradient.addColorStop(1, season.farHills[1]);
            ctx.fillStyle = buildingGradient;
            ctx.fillRect(bx, groundY - b.h, b.w, b.h);
            // lit windows
            for (const win of b.windows) {
                if (win.lit) {
                    ctx.fillStyle = win.color;
                    ctx.fillRect(bx + win.wx, groundY - b.h + win.wy, 5, 7);
                }
            }
        }
        const farHillGradient = ctx.createLinearGradient(0, H * 0.52, 0, groundY);
        farHillGradient.addColorStop(0, season.farHills[0]);
        farHillGradient.addColorStop(1, season.farHills[1]);
        ctx.fillStyle = farHillGradient;
        drawHillRow(hillOffset1 * 0.42, H * 0.61, 88, groundY);
        const nearHills = ctx.createLinearGradient(0, H * 0.64, 0, groundY);
        nearHills.addColorStop(0, season.nearHills[0]);
        nearHills.addColorStop(1, season.nearHills[1]);
        ctx.fillStyle = nearHills;
        drawHillRow(hillOffset2, H * 0.7, 54, groundY);
        drawSeasonParticles(season);

        // ground
        const groundGradient = ctx.createLinearGradient(0, groundY, 0, H);
        groundGradient.addColorStop(0, season.ground[0]);
        groundGradient.addColorStop(0.12, season.ground[1]);
        groundGradient.addColorStop(1, season.ground[2]);
        ctx.fillStyle = groundGradient;
        ctx.fillRect(0, groundY, W, H - groundY);
        ctx.shadowColor = season.edge;
        ctx.shadowBlur = 16;
        ctx.fillStyle = season.edge;
        ctx.fillRect(0, groundY, W, 4);
        ctx.shadowBlur = 0;
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

    function drawSeasonParticles(season) {
        const count = season.particle === 'snow' ? 28 : 18;
        const fallRate = season.particle === 'snow' ? 22 : season.particle === 'leaf' ? 34 : 28;
        for (let i = 0; i < count; i++) {
            const seedX = (i * 97 + 23) % W;
            const phase = i * 1.73;
            const x = (seedX + Math.sin(elapsed * 0.7 + phase) * 22 - elapsed * (season.particle === 'leaf' ? 12 : 4) + W * 2) % W;
            const y = ((i * 53 + elapsed * fallRate) % Math.max(1, groundY * 0.78)) + 8;
            const alpha = 0.32 + 0.35 * (0.5 + 0.5 * Math.sin(elapsed * 1.4 + phase));
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(x, y);
            ctx.rotate(elapsed * (season.particle === 'leaf' ? 1.3 : 0.35) + phase);
            if (season.particle === 'petal') {
                ctx.fillStyle = i % 3 === 0 ? '#fff1f2' : '#ff9ec3';
                ctx.beginPath();
                ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
                ctx.fill();
            } else if (season.particle === 'leaf') {
                ctx.fillStyle = ['#ffb347', '#e76f32', '#d94f37'][i % 3];
                ctx.beginPath();
                ctx.moveTo(-5, 0);
                ctx.quadraticCurveTo(-2, -5, 5, -3);
                ctx.quadraticCurveTo(3, 3, -5, 0);
                ctx.fill();
                ctx.strokeStyle = 'rgba(91,45,25,.75)';
                ctx.lineWidth = 0.7;
                ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, -2); ctx.stroke();
            } else if (season.particle === 'snow') {
                ctx.fillStyle = i % 4 === 0 ? '#ffffff' : '#c8edff';
                ctx.beginPath(); ctx.arc(0, 0, 1.4 + (i % 3) * 0.55, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.fillStyle = i % 3 === 0 ? '#fff3bd' : '#ffe08a';
                ctx.beginPath(); ctx.arc(0, 0, 1 + (i % 3) * 0.45, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }
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
            const cx = o.x + o.w / 2;
            const cy = y + o.h / 2;
            // Bright red hazard glow makes the moving orb read clearly against the night sky.
            const glow = ctx.createRadialGradient(cx, cy, 3, cx, cy, 32);
            glow.addColorStop(0, 'rgba(255,51,66,0.62)');
            glow.addColorStop(0.55, 'rgba(239,35,56,0.24)');
            glow.addColorStop(1, 'rgba(239,35,56,0)');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(cx, cy, 32, 0, Math.PI * 2); ctx.fill();
            // Short radial spikes give this enemy a dangerous silhouette at a glance.
            ctx.save();
            ctx.translate(cx, cy);
            for (let spike = 0; spike < 8; spike++) {
                const angle = (Math.PI * 2 * spike) / 8;
                const inner = 12;
                const outer = 19;
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle - 0.22) * inner, Math.sin(angle - 0.22) * inner);
                ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
                ctx.lineTo(Math.cos(angle + 0.22) * inner, Math.sin(angle + 0.22) * inner);
                ctx.closePath();
                ctx.fillStyle = spike % 2 ? '#b40e28' : '#ff334a';
                ctx.fill();
                ctx.strokeStyle = '#7f1021';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            ctx.restore();
            ctx.save();
            ctx.shadowColor = '#ff263f';
            ctx.shadowBlur = 12;
            const body = ctx.createRadialGradient(cx - 7, cy - 7, 2, cx, cy, o.w * 0.62);
            body.addColorStop(0, '#fff1f2');
            body.addColorStop(0.18, '#ff717b');
            body.addColorStop(0.52, '#f5223b');
            body.addColorStop(0.82, '#ba1028');
            body.addColorStop(1, '#641326');
            ctx.fillStyle = body;
            ctx.beginPath(); ctx.ellipse(cx, cy, o.w / 2, o.h / 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            // Dark warning face and bright exclamation mark distinguish a hazard from a collectible.
            ctx.strokeStyle = '#3f0b19';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(cx, cy, o.w / 2, o.h / 2, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(76,5,22,0.78)';
            ctx.beginPath(); ctx.arc(cx, cy, 5.6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff7ed';
            ctx.font = '900 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', cx, cy + 0.5);
        }
    }

    function drawCoins() {
        for (const c of coins) {
            const y = c.y + Math.sin(c.bob) * 6;
            ctx.save();
            ctx.translate(c.x, y);
            const squeeze = Math.abs(Math.cos(c.bob * 0.7));
            ctx.scale(0.4 + 0.6 * squeeze, 1);
            let outerColor, innerColor, rimColor, symbolColor;
            if (c.doubleJump) {
                outerColor = '#d8b4fe'; innerColor = '#7c3aed'; rimColor = '#f3e8ff'; symbolColor = '#fff';
            } else if (c.lightning) {
                outerColor = '#7dd3fc'; innerColor = '#0284c7'; rimColor = '#e0f2fe'; symbolColor = '#fff';
            } else {
                outerColor = '#fbbf24'; innerColor = '#b45309'; rimColor = '#fef3c7'; symbolColor = '#fff7ed';
            }
            // Smooth concentric rims make collectibles read like tokens rather than hazards.
            ctx.shadowColor = c.doubleJump ? 'rgba(192,132,252,.72)' : c.lightning ? 'rgba(56,189,248,.72)' : 'rgba(251,191,36,.72)';
            ctx.shadowBlur = 11;
            ctx.fillStyle = outerColor;
            ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = rimColor;
            ctx.lineWidth = Math.max(1.5, c.r * 0.12);
            ctx.beginPath(); ctx.arc(0, 0, c.r * 0.86, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = innerColor;
            ctx.beginPath(); ctx.arc(0, 0, c.r * 0.65, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = symbolColor;
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


    // ============================================================
    // Gameplay UI module — pause / continue / exit (fixed state handling)
    // ============================================================
    // Double-tap top-left to pause (mobile-friendly)
    (function () {
        let lastTap = 0;
        document.addEventListener('touchend', function (e) {
            if (e.changedTouches[0].clientX < 80 && e.changedTouches[0].clientY < 80) {
                const now = Date.now();
                if (now - lastTap < 300) {
                    document.getElementById('menuDuringGame')?.click();
                }
                lastTap = now;
            }
        });
    })();
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
                if (window.satSprintSendPresence) window.satSprintSendPresence();
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
                if (window.satSprintSendPresence) window.satSprintSendPresence();
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
                snapshot.playerId = (core && core.account && core.account.playerId) || null;
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
                if (typeof state !== 'undefined' && state === 'playing' && window.SatAudio) {
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
    // Sound toggles
    // ============================================================
    (function () {
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
    })
})();
