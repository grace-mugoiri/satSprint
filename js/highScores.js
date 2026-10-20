(function () {
    'use strict';

    const STORAGE_KEY = 'sat_sprint_high_scores_v1';
    const PER_PAGE = 5;
    let entries = [];
    let page = 0;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function cleanName(name) {
        return String(name || '').replace(/[<>&"'/\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Player';
    }

    function leaderboardEntries(source) {
        const bestByPlayer = new Map();
        (Array.isArray(source) ? source : []).forEach(entry => {
            const name = cleanName(entry.name);
            const score = Number(entry.score) || 0;
            if (!score || name.toLocaleLowerCase() === 'player') return;
            const key = entry.playerId || name.toLocaleLowerCase();
            const candidate = { name, playerId: entry.playerId || null, score, savedAt: Number(entry.savedAt) || 0 };
            const current = bestByPlayer.get(key);
            if (!current || candidate.score > current.score || (candidate.score === current.score && candidate.savedAt < current.savedAt)) {
                bestByPlayer.set(key, candidate);
            }
        });
        return [...bestByPlayer.values()]
            .sort((a, b) => b.score - a.score || a.savedAt - b.savedAt)
            .slice(0, 50);
    }

    function pageCount() { return Math.max(1, Math.ceil(entries.length / PER_PAGE)); }

    function render() {
        const list = document.getElementById('highScoresList');
        if (!list) return;
        if (!entries.length) {
            list.innerHTML = '<div style="opacity:.7;">No high scores yet.</div>';
        } else {
            page = Math.min(page, pageCount() - 1);
            const start = page * PER_PAGE;
            list.innerHTML = entries.slice(start, start + PER_PAGE).map((entry, index) =>
                `<div class="highScoreRow"><span class="highScoreRank">${start + index + 1}</span><strong>${escapeHtml(entry.name)}</strong><span class="highScoreValue">${Number(entry.score) || 0}m</span></div>`
            ).join('');
        }

        const label = document.getElementById('highScorePageLabel');
        const prev = document.getElementById('highScorePrevBtn');
        const next = document.getElementById('highScoreNextBtn');
        if (label) label.textContent = `${page + 1}/${pageCount()}`;
        if (prev) prev.disabled = page <= 0;
        if (next) next.disabled = page >= pageCount() - 1;
    }

    async function fetchRemote() {
        const api = window.SAT_SPRINT_HIGH_SCORE_API;
        if (!api) return null;
        try {
            const response = await fetch(api, { method: 'GET', headers: { Accept: 'application/json' } });
            if (!response.ok) return null;
            const data = await response.json();
            return Array.isArray(data) ? data : null;
        } catch (error) { return null; }
    }

    async function load() {
        const remote = await fetchRemote();
        if (window.SAT_SPRINT_HIGH_SCORE_API) {
            if (Array.isArray(remote)) {
                entries = leaderboardEntries(remote);
                updateSyncMessage('Live global leaderboard. Best score per player.');
            } else {
                entries = [];
                updateSyncMessage('Global scores are temporarily unavailable.');
            }
        } else {
            try { entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') || []; } catch (error) { entries = []; }
            entries = leaderboardEntries(entries);
            updateSyncMessage('Showing scores saved on this device.');
        }
        page = 0;
        render();
    }

    function saveLocal() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch (error) { /* storage may be unavailable */ }
    }

    function updateSyncMessage(message) {
        const reminder = document.getElementById('highScoreSyncReminder');
        if (reminder) reminder.textContent = message;
    }

    async function saveRemote(entry) {
        const api = window.SAT_SPRINT_HIGH_SCORE_API;
        if (!api) return false;
        try {
            const response = await fetch(api, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry)
            });
            return response.ok;
        } catch (error) { return false; }
    }

    async function add(name, score, playerId) {
        const entry = { name: cleanName(name), playerId: playerId || null, score };
        if (window.SAT_SPRINT_HIGH_SCORE_API) {
            if (await saveRemote(entry)) await load();
            else updateSyncMessage('Could not sync this score to the global leaderboard.');
            return;
        }
        entries = leaderboardEntries([...entries, entry]);
        saveLocal();
        render();
    }

    document.getElementById('highScorePrevBtn')?.addEventListener('click', function () {
        if (page > 0) { page -= 1; render(); }
    });
    document.getElementById('highScoreNextBtn')?.addEventListener('click', function () {
        if (page < pageCount() - 1) { page += 1; render(); }
    });

    window.SatSprintHighScores = {
        add,
        cleanName,
        escapeHtml,
        load,
        pageCount,
        render,
        set(entriesFromServer, resetPage) {
            entries = leaderboardEntries(entriesFromServer);
            if (resetPage) page = 0;
            render();
        },
        get page() { return page; },
        set page(value) { page = value; },
        get entries() { return entries; }
    };
})();
