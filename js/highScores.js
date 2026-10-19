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
                `<div>${start + index + 1}. <strong>${escapeHtml(entry.name)}</strong> — ${Number(entry.score) || 0}m</div>`
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
        if (remote && remote.length) {
            entries = remote.map(entry => ({ name: cleanName(entry.name), score: Number(entry.score) || 0 }));
        } else {
            try { entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') || []; } catch (error) { entries = []; }
            entries = entries.map(entry => ({ name: cleanName(entry.name), score: Number(entry.score) || 0 }));
        }
        page = 0;
        render();
    }

    function saveLocal() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch (error) { /* storage may be unavailable */ }
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

    async function add(name, score) {
        const entry = { name: cleanName(name), score };
        entries.push(entry);
        entries.sort((a, b) => b.score - a.score);
        entries = entries.slice(0, 50);
        saveLocal();
        render();
        if (await saveRemote(entry)) load();
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
            entries = entriesFromServer.map(entry => ({ name: cleanName(entry.name), score: Number(entry.score) || 0 }));
            if (resetPage) page = 0;
            render();
        },
        get page() { return page; },
        set page(value) { page = value; },
        get entries() { return entries; }
    };
})();
