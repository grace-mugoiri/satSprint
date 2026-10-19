const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const { Pool } = require('pg');

const cors = require('cors');
const app = express();
const dataPath = path.join(__dirname, 'data.json');
const rootPath = path.join(__dirname, '..');
const webOrigin = process.env.WEB_ORIGIN || 'https://satsprint.onrender.com';
const allowedOrigins = new Set([webOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000']);
const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5,
        connectionTimeoutMillis: 10000,
        ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined
    })
    : null;

app.use(express.json({ limit: '64kb' }));
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS'));
    }
}));

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
if (!pool) {
    try {
        const raw = fs.readFileSync(dataPath, 'utf8');
        data = Object.assign(data, JSON.parse(raw));
    } catch (error) {
        console.warn('Could not load backend data file, starting with fresh data.');
    }
}

function persistData() {
    if (pool) return;
    try {
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to persist backend data:', error);
    }
}

async function loadPersistedData() {
    if (!pool) return;
    await pool.query(`
        CREATE TABLE IF NOT EXISTS high_scores (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(16) NOT NULL,
            score INTEGER NOT NULL CHECK (score > 0),
            saved_at BIGINT NOT NULL
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS run_snapshots (
            id BIGSERIAL PRIMARY KEY,
            payload JSONB NOT NULL,
            saved_at BIGINT NOT NULL
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS app_migrations (
            migration_key TEXT PRIMARY KEY,
            applied_at BIGINT NOT NULL
        )
    `);

    const migrationKey = 'seed-json-data-v1';
    const { rowCount } = await pool.query('SELECT migration_key FROM app_migrations WHERE migration_key = $1', [migrationKey]);
    if (!rowCount) {
        let legacyData = { highScores: [], runSnapshots: [] };
        try { legacyData = Object.assign(legacyData, JSON.parse(fs.readFileSync(dataPath, 'utf8'))); } catch (error) { }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const entry of (legacyData.highScores || [])) {
                if (typeof entry.name !== 'string' || !validScore(entry.score)) continue;
                await client.query(
                    'INSERT INTO high_scores (name, score, saved_at) VALUES ($1, $2, $3)',
                    [sanitizeName(entry.name), Math.floor(Number(entry.score)), Number(entry.savedAt) || Date.now()]
                );
            }
            for (const payload of (legacyData.runSnapshots || [])) {
                if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue;
                await client.query(
                    'INSERT INTO run_snapshots (payload, saved_at) VALUES ($1::jsonb, $2)',
                    [JSON.stringify(payload), Number(payload.savedAt) || Date.now()]
                );
            }
            await client.query('INSERT INTO app_migrations (migration_key, applied_at) VALUES ($1, $2)', [migrationKey, Date.now()]);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    const [scores, snapshots] = await Promise.all([
        pool.query('SELECT name, score, saved_at AS "savedAt" FROM high_scores ORDER BY score DESC, saved_at ASC, id ASC LIMIT 50'),
        pool.query('SELECT payload, saved_at AS "savedAt" FROM run_snapshots ORDER BY saved_at DESC, id DESC LIMIT 100')
    ]);
    data.highScores = scores.rows.map(row => ({ name: row.name, score: Number(row.score), savedAt: Number(row.savedAt) }));
    data.runSnapshots = snapshots.rows.map(row => ({ ...row.payload, savedAt: Number(row.savedAt) }));
}

async function saveHighScore(entry) {
    if (!pool) {
        data.highScores.push(entry);
        data.highScores.sort((a, b) => b.score - a.score);
        data.highScores = data.highScores.slice(0, 50);
        persistData();
        return;
    }
    await pool.query('INSERT INTO high_scores (name, score, saved_at) VALUES ($1, $2, $3)', [entry.name, entry.score, entry.savedAt]);
    await pool.query(`
        DELETE FROM high_scores
        WHERE id IN (
            SELECT id FROM high_scores
            ORDER BY score DESC, saved_at ASC, id ASC
            OFFSET 50
        )
    `);
    const scores = await pool.query('SELECT name, score, saved_at AS "savedAt" FROM high_scores ORDER BY score DESC, saved_at ASC, id ASC LIMIT 50');
    data.highScores = scores.rows.map(row => ({ name: row.name, score: Number(row.score), savedAt: Number(row.savedAt) }));
}

async function saveRunSnapshot(payload) {
    const savedAt = Date.now();
    const snapshot = { ...payload, savedAt };
    if (!pool) {
        data.runSnapshots.unshift(snapshot);
        if (data.runSnapshots.length > 100) data.runSnapshots.length = 100;
        persistData();
        return snapshot;
    }
    await pool.query('INSERT INTO run_snapshots (payload, saved_at) VALUES ($1::jsonb, $2)', [JSON.stringify(payload), savedAt]);
    await pool.query(`
        DELETE FROM run_snapshots
        WHERE id IN (
            SELECT id FROM run_snapshots
            ORDER BY saved_at DESC, id DESC
            OFFSET 100
        )
    `);
    data.runSnapshots.unshift(snapshot);
    if (data.runSnapshots.length > 100) data.runSnapshots.length = 100;
    return snapshot;
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

app.post('/api/high-scores', async (req, res) => {
    if (rateLimited(req)) return res.status(429).json({ error: 'slow down' });
    const body = req.body;
    if (body && body.type === 'run_snapshot') {
        const payload = body.payload || {};
        if (payload.playerName) payload.playerName = sanitizeName(payload.playerName);
        try {
            const snapshot = await saveRunSnapshot(payload);
            broadcastWS({ type: 'run_snapshot', payload: snapshot });
            return res.json({ ok: true });
        } catch (error) {
            console.error('Failed to save run snapshot:', error);
            return res.status(500).json({ error: 'could not save run snapshot' });
        }
    }

    if (!body || typeof body.name !== 'string' || !validScore(body.score)) {
        return res.status(400).json({ error: 'Expected {name, score} or {type:"run_snapshot", payload}' });
    }

    const entry = {
        name: sanitizeName(body.name),
        score: Math.floor(body.score),
        savedAt: Date.now()
    };
    try {
        await saveHighScore(entry);
        broadcastWS({ type: 'high_scores', data: data.highScores.slice(0, 50) });
        res.json({ ok: true });
    } catch (error) {
        console.error('Failed to save high score:', error);
        res.status(500).json({ error: 'could not save high score' });
    }
});

// Admin cleanup endpoint: remove entries matching a predicate or clear all
app.post('/api/high-scores/cleanup', async (req, res) => {
    const token = req.get('x-admin-token') || req.body.adminToken || process.env.ADMIN_TOKEN || '';
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({ error: 'forbidden' });
    }
    const mode = req.body && req.body.mode ? req.body.mode : 'remove-test';
    try {
        if (pool) {
            if (mode === 'clear-all') {
                await pool.query('DELETE FROM high_scores');
            } else {
                await pool.query("DELETE FROM high_scores WHERE name ~* 'test'");
            }
        }
        data.highScores = mode === 'clear-all'
            ? []
            : (data.highScores || []).filter(e => !/test/i.test(e.name));
        if (!pool) persistData();
    } catch (error) {
        console.error('Failed to clean up high scores:', error);
        return res.status(500).json({ error: 'could not clean up high scores' });
    }
    broadcastWS({ type: 'high_scores', data: data.highScores.slice(0, 50) });
    res.json({ ok: true, mode, count: data.highScores.length });
});

app.post('/api/run-snapshot', async (req, res) => {
    if (rateLimited(req)) return res.status(429).json({ error: 'slow down' });
    const body = req.body;
    if (!body || body.type !== 'run_snapshot' || !body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
        return res.status(400).json({ error: 'Expected {type:"run_snapshot", payload}' });
    }

    const payload = { ...body.payload };
    if (payload.playerName) payload.playerName = sanitizeName(payload.playerName);
    try {
        const snapshot = await saveRunSnapshot(payload);
        broadcastWS({ type: 'run_snapshot', payload: snapshot });
        res.json({ ok: true });
    } catch (error) {
        console.error('Failed to save run snapshot:', error);
        res.status(500).json({ error: 'could not save run snapshot' });
    }
});

const port = process.env.PORT || 3000;
const host = process.env.BIND_ADDR || '0.0.0.0';
const server = http.createServer(app);

// Attach WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (socket, req) => {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
        socket.close(1008, 'Origin is not allowed');
        return;
    }
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

loadPersistedData()
    .then(() => {
        server.listen(port, host, () => {
            console.log(`SAT SPRINT backend running at http://${host}:${port}`);
            console.log('Serving game assets from:', rootPath);
            console.log('WebSocket endpoint: /ws');
            console.log(pool ? 'Persistence: PostgreSQL' : 'Persistence: local JSON file');
        });
    })
    .catch(error => {
        console.error('Failed to initialize persistence:', error);
        process.exit(1);
    });
