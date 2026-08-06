/* SAT SPRINT — Procedural Audio Engine
 * Web Audio API, zero asset files.
 * Generates a techno beat that matches the game speed (BPM scales with speed)
 * plus retro SFX: jump, coin, death, lightning, quiz.
 */
(function () {
    'use strict';

    let ctx = null;
    let master = null;
    let musicGain = null;
    let sfxGain = null;
    let started = false;
    let musicOn = true;
    let sfxOn = true;

    // music scheduler state
    let schedulerTimer = null;
    let nextNoteTime = 0;
    let step = 0;
    let currentBPM = 128;
    let targetBPM = 128;
    let musicMode = 'idle'; // idle | menu | game

    // noise buffer cache
    let noiseBuf = null;

    function ensureCtx() {
        if (ctx) return true;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return false;
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = 0.8;
            master.connect(ctx.destination);
            musicGain = ctx.createGain();
            musicGain.gain.value = 0.0; // start silent, ramp on demand
            musicGain.connect(master);
            sfxGain = ctx.createGain();
            sfxGain.gain.value = 1.0;
            sfxGain.connect(master);
            makeNoiseBuffer();
        } catch (e) {
            return false;
        }
        return true;
    }

    function makeNoiseBuffer() {
        try {
            const len = ctx.sampleRate * 1.2;
            noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
            const data = noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        } catch (e) { /* ignore */ }
    }

    function resume() {
        if (!ensureCtx()) return;
        if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    }

    function unlock() {
        // called from a user gesture
        if (!ensureCtx()) return;
        resume();
        started = true;
    }

    // ---------- helpers ----------
    function env(gainNode, t, a, peak, d) {
        gainNode.gain.setValueAtTime(0.0001, t);
        gainNode.gain.linearRampToValueAtTime(peak, t + a);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }

    function playOsc(type, freq, t, dur, peak, slideTo) {
        if (!ctx || !sfxOn) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        env(g, t, 0.005, peak, dur);
        o.connect(g); g.connect(sfxGain);
        o.start(t); o.stop(t + dur + 0.05);
    }

    function playNoise(t, dur, peak, filterFreq, type) {
        if (!ctx || !noiseBuf || !sfxOn) return;
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = type || 'highpass';
        f.frequency.value = filterFreq || 4000;
        const g = ctx.createGain();
        env(g, t, 0.005, peak, dur);
        src.connect(f); f.connect(g); g.connect(sfxGain);
        src.start(t); src.stop(t + dur + 0.05);
    }

    // ---------- SFX ----------
    const sfx = {
        jump() { playOsc('square', 300, now(), 0.12, 0.12, 640); },
        doubleJump() { playOsc('square', 420, now(), 0.14, 0.12, 900); },
        coin() { playOsc('sine', 1250, now(), 0.09, 0.14, 1875); playNoise(now(), 0.05, 0.04, 6000); },
        bigCoin() { playOsc('sine', 990, now(), 0.1, 0.16, 1485); playOsc('sine', 1485, now() + 0.06, 0.12, 0.14, 1980); },
        lightning() { playNoise(now(), 0.3, 0.2, 1200, 'bandpass'); playOsc('sawtooth', 180, now(), 0.28, 0.12, 1200); },
        death() {
            playNoise(now(), 0.4, 0.3, 800, 'lowpass');
            playOsc('sawtooth', 220, now(), 0.5, 0.18, 40);
            playOsc('square', 110, now() + 0.05, 0.4, 0.1, 30);
        },
        quizCorrect() { playOsc('sine', 660, now(), 0.1, 0.12); playOsc('sine', 880, now() + 0.09, 0.15, 0.12); },
        quizWrong() { playOsc('sine', 330, now(), 0.12, 0.12); playOsc('sine', 262, now() + 0.1, 0.18, 0.12); },
        click() { playOsc('square', 880, now(), 0.04, 0.06); },
        land() { playNoise(now(), 0.06, 0.06, 300, 'lowpass'); }
    };

    function now() { return ctx ? ctx.currentTime : 0; }

    // ---------- music scheduler ----------
    const PATTERNS = {
        kick: [0, 4, 8, 12],                 // four on the floor
        kickExtra: [0, 3, 4, 8, 11, 12, 14], // heavier during game
        hat: [2, 6, 10, 14],                 // offbeat 8ths
        hatClosed: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // 16ths when hot
        clap: [4, 12],
        bassRoot: 55,                        // A1
        bassPattern: [0, 0, 12, 0, 0, 7, 12, 0],  // semitone offsets over 2 bars
        arpPattern: [0, 12, 7, 12, 3, 12, 7, 12, 5, 12, 7, 12, 3, 12, 7, 12] // minor arp
    };

    function scheduleNote(time, idx) {
        const bar = Math.floor(idx / 16) % 2;
        const pos = idx % 16;
        const hot = musicMode === 'game';

        // kick
        const kicks = hot ? PATTERNS.kickExtra : PATTERNS.kick;
        if (kicks.indexOf(pos) !== -1) {
            kick(time);
        }
        // hats
        if (hot) {
            if (PATTERNS.hatClosed.indexOf(pos) !== -1) hat(time, pos % 4 === 0 ? 0.09 : 0.05);
        } else if (PATTERNS.hat.indexOf(pos) !== -1) {
            hat(time, 0.06);
        }
        // clap / snare
        if (PATTERNS.clap.indexOf(pos) !== -1) clap(time);
        // bass — root with pattern; bar 1 plays pattern, bar 2 plays root octave
        if (pos % 2 === 0) {
            const offset = bar === 0 ? PATTERNS.bassPattern[(pos / 2) % 8] : 12;
            bass(time, PATTERNS.bassRoot + offset);
        }
        // arp sparkle every other beat, only when hot
        if (hot && pos % 4 === 2) {
            arp(time, 220 + PATTERNS.arpPattern[idx % 16]);
        }
    }

    function kick(t) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
        env(g, t, 0.002, 0.85, 0.16);
        o.connect(g); g.connect(musicGain);
        o.start(t); o.stop(t + 0.2);
    }

    function hat(t, peak) {
        playNoiseTrack(t, 0.04, peak || 0.06, 7000);
    }

    function clap(t) {
        playNoiseTrack(t, 0.16, 0.12, 1800);
        // body
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(220, t);
        env(g, t, 0.002, 0.1, 0.1);
        o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.14);
    }

    function bass(t, midi) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        o.type = 'sawtooth';
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        o.frequency.value = freq;
        f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 8;
        env(g, t, 0.004, 0.28, 0.22);
        o.connect(f); f.connect(g); g.connect(musicGain);
        o.start(t); o.stop(t + 0.24);
    }

    function arp(t, midi) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        o.frequency.value = freq;
        env(g, t, 0.003, 0.05, 0.1);
        o.connect(g); g.connect(musicGain);
        o.start(t); o.stop(t + 0.12);
    }

    function playNoiseTrack(t, dur, peak, freq) {
        if (!noiseBuf) return;
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = freq;
        const g = ctx.createGain();
        env(g, t, 0.002, peak, dur);
        src.connect(f); f.connect(g); g.connect(musicGain);
        src.start(t); src.stop(t + dur + 0.05);
    }

    function scheduler() {
        if (!ctx || !musicOn || musicMode === 'idle') return;
        const lookahead = 0.12;
        while (nextNoteTime < ctx.currentTime + lookahead) {
            scheduleNote(nextNoteTime, step);
            step++;
            nextNoteTime += 60 / currentBPM / 4; // 16th notes
        }
    }

    function startScheduler() {
        if (schedulerTimer) return;
        nextNoteTime = ctx.currentTime + 0.06;
        step = 0;
        schedulerTimer = setInterval(scheduler, 30);
    }

    function stopScheduler() {
        if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null; }
    }

    function setMusicMode(mode) {
        musicMode = mode;
        // game = faster, heavier
        targetBPM = mode === 'game' ? 132 : 124;
    }

    function updateBPM(speedFactor) {
        // speedFactor: 0..1 — map BPM from 124 up to 172
        if (musicMode === 'game') {
            targetBPM = 124 + speedFactor * 48;
        }
        // glide current BPM toward target
        currentBPM += (targetBPM - currentBPM) * 0.05;
    }

    function startMusic() {
        if (!ensureCtx()) return;
        resume();
        if (!musicOn) return;
        musicGain.gain.setTargetAtTime(0.5, ctx.currentTime, 0.3);
        startScheduler();
    }

    function stopMusic() {
        if (!ctx) return;
        musicGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.15);
        setTimeout(() => { if (musicMode === 'idle') stopScheduler(); }, 400);
    }

    function pauseMusic() {
        if (!ctx) return;
        musicGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.1);
        stopScheduler();
    }

    function resumeMusic() {
        if (!ctx || !musicOn) return;
        if (musicMode === 'idle') return;
        musicGain.gain.setTargetAtTime(0.5, ctx.currentTime, 0.2);
        startScheduler();
    }

    function setMusicEnabled(on) {
        musicOn = on;
        if (!ctx) return;
        if (on) {
            if (musicMode !== 'idle') { musicGain.gain.setTargetAtTime(0.5, ctx.currentTime, 0.2); startScheduler(); }
        } else {
            musicGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.1);
            stopScheduler();
        }
    }

    function setSfxEnabled(on) { sfxOn = on; }

    function setModeIdle() { setMusicMode('idle'); }

    window.SatAudio = {
        unlock,
        resume,
        get ready() { return !!ctx; },
        sfx,
        startMusic,
        stopMusic,
        pauseMusic,
        resumeMusic,
        setMusicMode,
        setMusicEnabled,
        setSfxEnabled,
        updateBPM,
        setModeIdle,
        get musicEnabled() { return musicOn; },
        get sfxEnabled() { return sfxOn; }
    };
})();