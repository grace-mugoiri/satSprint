const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const cors = require('cors');
const app = express();
const dataPath = path.join(__dirname, 'data.json');
const rootPath = path.join(__dirname, '..');

app.use(express.json({ limit: '64kb' }));
app.use(cors());

// ============================================================
// Security hardening
// ============================================================
function sanitizeName(name) {
    return String(name || '')
        .replace(/[<>&"'/\\]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 16) || 'Player';
}

function validScore(score) {
    const n = Number(score);
    return Number.isFinite(n) && n >= 1 && n <= 100000000; // no 0m spam, sane cap
}

// Simple per-IP rate limiter for write endpoints
const rateBuckets = new Map();
const RATE_LIMIT = 15;          // requests
const RATE_WINDOW_MS = 60 * 1000; // per minute
function rateLimited(req) {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString().split(',')[0].trim();
    const now = Date.now();
    const bucket = rateBuckets.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };
    if (now > bucket.resetAt) { bucket.count = 0; bucket.resetAt = now + RATE_WINDOW_MS; }
    bucket.count++;
    rateBuckets.set(ip, bucket);
    if (rateBuckets.size > 5000) {
        // evict stale buckets
        for (const [k, v] of rateBuckets) {
            if (now > v.resetAt) rateBuckets.delete(k);
        }
    }
    return bucket.count > RATE_LIMIT;
}

let data = { highScores: [], runSnapshots: [] };
try {
    const raw = fs.readFileSync(dataPath, 'utf8');
    data = Object.assign(data, JSON.parse(raw));
} catch (error) {
    console.warn('Could not load backend data file, starting with fresh data.');
}

function persistData() {
    try {
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to persist backend data:', error);
    }
}

// ============================================================
// Static assets — ONLY public game files (fixed: no repo root)
// ============================================================
app.get('/', (req, res) => res.sendFile(path.join(rootPath, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(rootPath, 'index.html')));
app.get('/js/satSprint.js', (req, res) => res.sendFile(path.join(rootPath, 'js', 'satSprint.js')));
app.get('/js/audio.js', (req, res) => res.sendFile(path.join(rootPath, 'js', 'audio.js')));
app.get('/manifest.webmanifest', (req, res) => {
    res.set('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(rootPath, 'manifest.webmanifest'));
});
app.get('/icons/:file', (req, res) => {
    const file = path.basename(req.params.file);
    if (!/^[\w.-]+$/.test(file)) return res.status(400).json({ error: 'bad file' });
    res.sendFile(path.join(rootPath, 'icons', file));
});
app.get('/sw.js', (req, res) => res.sendFile(path.join(rootPath, 'sw.js')));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: 'sat-sprint-backend' });
});

app.get('/api/high-scores', (req, res) => {
    res.json(data.highScores.slice(0, 50));
});

app.get('/api/run-snapshots', (req, res) => {
    res.json(data.runSnapshots.slice(0, 50));
});

app.get('/api/active-players', (req, res) => {
    const players = (wss && wss.activePlayers) ? Object.values(wss.activePlayers) : [];
    res.json(players);
});

// Helper to broadcast to connected websocket clients
function broadcastWS(message) {
    if (!wss) return;
    const msg = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
}

app.post('/api/high-scores', (req, res) => {
    if (rateLimited(req)) return res.status(429).json({ error: 'slow down' });
    const body = req.body;
    if (body && body.type === 'run_snapshot') {
        const payload = body.payload || {};
        if (payload.playerName) payload.playerName = sanitizeName(payload.playerName);
        data.runSnapshots.unshift({ ...payload, savedAt: Date.now() });
        if (data.runSnapshots.length > 100) data.runSnapshots.length = 100;
        persistData();
        broadcastWS({ type: 'run_snapshot', payload });
        return res.json({ ok: true });
    }

    if (!body || typeof body.name !== 'string' || !validScore(body.score)) {
        return res.status(400).json({ error: 'Expected {name, score} or {type:"run_snapshot", payload}' });
    }

    const entry = {
        name: sanitizeName(body.name),
        score: Math.floor(body.score),
        savedAt: Date.now()
    };
    data.highScores.push(entry);
    data.highScores.sort((a, b) => b.score - a.score);
    data.highScores = data.highScores.slice(0, 50);
    persistData();
    broadcastWS({ type: 'high_scores', data: data.highScores.slice(0, 50) });
    res.json({ ok: true });
});

// Admin cleanup endpoint: remove entries matching a predicate or clear all
app.post('/api/high-scores/cleanup', (req, res) => {
    const token = req.get('x-admin-token') || req.body.adminToken || process.env.ADMIN_TOKEN || '';
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({ error: 'forbidden' });
    }
    const mode = req.body && req.body.mode ? req.body.mode : 'remove-test';
    if (mode === 'clear-all') {
        data.highScores = [];
    } else {
        data.highScores = (data.highScores || []).filter(e => !/test/i.test(e.name));
    }
    persistData();
    broadcastWS({ type: 'high_scores', data: data.highScores.slice(0, 50) });
    res.json({ ok: true, mode, count: data.highScores.length });
});

app.post('/api/run-snapshot', (req, res) => {
    if (rateLimited(req)) return res.status(429).json({ error: 'slow down' });
    const body = req.body;
    if (!body || body.type !== 'run_snapshot' || typeof body.payload !== 'object') {
        return res.status(400).json({ error: 'Expected {type:"run_snapshot", payload}' });
    }

    const payload = { ...body.payload, savedAt: Date.now() };
    if (payload.playerName) payload.playerName = sanitizeName(payload.playerName);
    data.runSnapshots.unshift(payload);
    if (data.runSnapshots.length > 100) data.runSnapshots.length = 100;
    persistData();
    broadcastWS({ type: 'run_snapshot', payload });
    res.json({ ok: true });
});

const port = process.env.PORT || 3000;
const host = process.env.BIND_ADDR || '0.0.0.0';
const server = http.createServer(app);

// Attach WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (socket, req) => {
    socket._id = Date.now().toString(36) + '-' + Math.floor(Math.random() * 100000).toString(36);
    socket.send(JSON.stringify({ type: 'welcome', id: socket._id, data: data.highScores.slice(0, 50) }));
    console.log('WS client connected', req.socket.remoteAddress, 'id=', socket._id);

    wss.activePlayers = wss.activePlayers || {};
    wss.activePlayers[socket._id] = { id: socket._id, connectedAt: Date.now() };

    socket.on('message', (msg) => {
        try {
            const parsed = JSON.parse(msg);
            if (!parsed || !parsed.type) return;
            if (parsed.type === 'ping') return socket.send(JSON.stringify({ type: 'pong' }));

            if (parsed.type === 'presence') {
                const payload = parsed.payload || {};
                wss.activePlayers[socket._id] = Object.assign(wss.activePlayers[socket._id] || {}, {
                    id: socket._id,
                    name: sanitizeName(payload.name || 'Player'),
                    lastSeen: Date.now()
                });
                broadcastWS({ type: 'presence', id: socket._id, payload: wss.activePlayers[socket._id] });
                return;
            }

            if (parsed.type === 'run_progress') {
                const payload = parsed.payload || {};
                wss.activePlayers[socket._id] = Object.assign(wss.activePlayers[socket._id] || {}, {
                    id: socket._id,
                    name: sanitizeName(payload.name || 'Player'),
                    lastSeen: Date.now(),
                    progress: payload
                });
                broadcastWS({ type: 'run_progress', id: socket._id, payload: wss.activePlayers[socket._id] });
                return;
            }

            if (parsed.type === 'get_active_players') {
                socket.send(JSON.stringify({ type: 'active_players', data: Object.values(wss.activePlayers || {}) }));
                return;
            }
        } catch (e) { }
    });

    socket.on('close', () => {
        if (wss.activePlayers && wss.activePlayers[socket._id]) {
            const info = wss.activePlayers[socket._id];
            delete wss.activePlayers[socket._id];
            broadcastWS({ type: 'player_disconnected', id: socket._id, payload: info });
        }
        console.log('WS client disconnected', socket._id);
    });
});

server.listen(port, host, () => {
    console.log(`SAT SPRINT backend running at http://${host}:${port}`);
    console.log('Serving game assets from:', rootPath);
    console.log('WebSocket endpoint: /ws');
});
