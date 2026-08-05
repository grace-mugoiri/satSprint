const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const cors = require('cors');
const app = express();
const dataPath = path.join(__dirname, 'data.json');
const rootPath = path.join(__dirname, '..');

app.use(express.json());
app.use(express.static(rootPath));
// Allow CORS for development; in production lock this down to allowed origins.
app.use(cors());

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
    const body = req.body;
    if (body && body.type === 'run_snapshot') {
        const payload = body.payload || {};
        data.runSnapshots.unshift({ ...payload, savedAt: Date.now() });
        if (data.runSnapshots.length > 100) data.runSnapshots.length = 100;
        persistData();
        // Broadcast new snapshot to clients
        broadcastWS({ type: 'run_snapshot', payload });
        return res.json({ ok: true });
    }

    if (!body || typeof body.name !== 'string' || typeof body.score !== 'number') {
        return res.status(400).json({ error: 'Expected {name, score} or {type:"run_snapshot", payload}' });
    }

    const entry = {
        name: body.name.trim() || 'Player',
        score: body.score,
        savedAt: Date.now()
    };
    data.highScores.push(entry);
    data.highScores.sort((a, b) => b.score - a.score);
    data.highScores = data.highScores.slice(0, 50);
    persistData();
    // Broadcast updated high scores
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
        // default: remove entries with name containing TEST or test
        data.highScores = (data.highScores || []).filter(e => !/test/i.test(e.name));
    }
    persistData();
    // broadcast updated list
    broadcastWS({ type: 'high_scores', data: data.highScores.slice(0, 50) });
    res.json({ ok: true, mode, count: data.highScores.length });
});

app.post('/api/run-snapshot', (req, res) => {
    const body = req.body;
    if (!body || body.type !== 'run_snapshot' || typeof body.payload !== 'object') {
        return res.status(400).json({ error: 'Expected {type:"run_snapshot", payload}' });
    }

    const payload = { ...body.payload, savedAt: Date.now() };
    data.runSnapshots.unshift(payload);
    if (data.runSnapshots.length > 100) data.runSnapshots.length = 100;
    persistData();
    // Broadcast new snapshot
    broadcastWS({ type: 'run_snapshot', payload });
    res.json({ ok: true });
});

const port = process.env.PORT || 3000;
const host = process.env.BIND_ADDR || '0.0.0.0';
const server = http.createServer(app);

// Attach WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (socket, req) => {
    // send current high scores on connect
    // assign an id for this socket
    socket._id = Date.now().toString(36) + '-' + Math.floor(Math.random() * 100000).toString(36);
    // send current high scores on connect and notify client of its id
    socket.send(JSON.stringify({ type: 'welcome', id: socket._id, data: data.highScores.slice(0, 50) }));
    // optional: log
    console.log('WS client connected', req.socket.remoteAddress, 'id=', socket._id);

    // track active players by socket id
    wss.activePlayers = wss.activePlayers || {};
    wss.activePlayers[socket._id] = { id: socket._id, connectedAt: Date.now() };

    socket.on('message', (msg) => {
        try {
            const parsed = JSON.parse(msg);
            if (!parsed || !parsed.type) return;
            // simple ping/pong
            if (parsed.type === 'ping') return socket.send(JSON.stringify({ type: 'pong' }));

            // presence update (name, status)
            if (parsed.type === 'presence') {
                const payload = parsed.payload || {};
                wss.activePlayers[socket._id] = Object.assign(wss.activePlayers[socket._id] || {}, {
                    id: socket._id,
                    name: payload.name || wss.activePlayers[socket._id].name || 'Player',
                    lastSeen: Date.now()
                });
                // broadcast presence to all clients
                broadcastWS({ type: 'presence', id: socket._id, payload: wss.activePlayers[socket._id] });
                return;
            }

            // live run progress updates
            if (parsed.type === 'run_progress') {
                const payload = parsed.payload || {};
                // attach to activePlayers
                wss.activePlayers[socket._id] = Object.assign(wss.activePlayers[socket._id] || {}, {
                    id: socket._id,
                    name: payload.name || wss.activePlayers[socket._id].name || 'Player',
                    lastSeen: Date.now(),
                    progress: payload
                });
                // broadcast to others
                broadcastWS({ type: 'run_progress', id: socket._id, payload: wss.activePlayers[socket._id] });
                return;
            }

            // allow clients to ask for current active players
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
