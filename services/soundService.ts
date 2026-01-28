/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Procedural Sound Effects using Web Audio API
 */

class SoundService {
    private audioContext: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private enabled: boolean = true;

    constructor() {
        this.initAudio();
    }

    private initAudio() {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.audioContext.destination);
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    private ensureContext() {
        if (this.audioContext?.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
    }

    setVolume(volume: number) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    // ===== LASER SHOT =====
    playLaserShot() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Oscillator for the "pew" sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    // ===== ENEMY DEATH =====
    playEnemyDeath() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Low explosion rumble
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.3);

        // High pitched pop
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(600, now);
        osc2.frequency.exponentialRampToValueAtTime(100, now + 0.1);

        gain2.gain.setValueAtTime(0.2, now);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc2.connect(gain2);
        gain2.connect(this.masterGain);

        osc2.start(now);
        osc2.stop(now + 0.1);
    }

    // ===== FOOTSTEP (Moon/Spacesuit) =====
    playFootstep() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Muffled thud (suit absorbing impact on lunar surface)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(50 + Math.random() * 20, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.15);

        filter.type = 'lowpass';
        filter.frequency.value = 200;

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.15);

        // Suit servo/hiss
        const bufferSize = ctx.sampleRate * 0.05;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.1 * Math.exp(-i / (bufferSize * 0.5));
        }

        const hiss = ctx.createBufferSource();
        const hissGain = ctx.createGain();
        const hissFilter = ctx.createBiquadFilter();

        hiss.buffer = buffer;
        hissFilter.type = 'highpass';
        hissFilter.frequency.value = 2000;
        hissGain.gain.value = 0.1;

        hiss.connect(hissFilter);
        hissFilter.connect(hissGain);
        hissGain.connect(this.masterGain);

        hiss.start(now);
    }

    // ===== ENEMY SPAWN (Screamer/Horror) =====
    playEnemySpawn() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Creepy rising growl
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.5);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.exponentialRampToValueAtTime(800, now + 0.3);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.5);

        // Dissonant screech
        const screech = ctx.createOscillator();
        const screechGain = ctx.createGain();

        screech.type = 'square';
        screech.frequency.setValueAtTime(400, now + 0.1);
        screech.frequency.exponentialRampToValueAtTime(600, now + 0.25);
        screech.frequency.exponentialRampToValueAtTime(300, now + 0.4);

        screechGain.gain.setValueAtTime(0, now);
        screechGain.gain.linearRampToValueAtTime(0.15, now + 0.15);
        screechGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        screech.connect(screechGain);
        screechGain.connect(this.masterGain);

        screech.start(now + 0.1);
        screech.stop(now + 0.4);
    }

    // ===== JUMP =====
    playJump() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Rising pitch "whoosh"
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    // ===== METEOR IMPACT =====
    playMeteorImpact() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Deep explosion
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.5);

        // Crackle noise
        const bufferSize = ctx.sampleRate * 0.3;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }

        const noise = ctx.createBufferSource();
        const noiseGain = ctx.createGain();

        noise.buffer = buffer;
        noiseGain.gain.setValueAtTime(0.3, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        noise.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noise.start(now);
    }

    // ===== COLLECT ITEM =====
    playCollect() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Pleasant rising tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        osc.frequency.setValueAtTime(800, now + 0.2);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.setValueAtTime(0.2, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    // ===== PLAYER HIT =====
    playPlayerHit() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Painful impact
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    // ===== PLAYER DEATH =====
    playPlayerDeath() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Descending wail
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 1.0);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 1.0);
    }

    // ===== HEADSHOT =====
    playHeadshot() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Satisfying crunch + chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.1);

        // Chime
        const chime = ctx.createOscillator();
        const chimeGain = ctx.createGain();

        chime.type = 'sine';
        chime.frequency.setValueAtTime(1200, now + 0.05);

        chimeGain.gain.setValueAtTime(0.15, now + 0.05);
        chimeGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        chime.connect(chimeGain);
        chimeGain.connect(this.masterGain);

        chime.start(now + 0.05);
        chime.stop(now + 0.3);
    }

    // ===== LEVEL COMPLETE =====
    playLevelComplete() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Victory fanfare
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            const start = now + i * 0.15;
            gain.gain.setValueAtTime(0.2, start);
            gain.gain.exponentialRampToValueAtTime(0.01, start + 0.4);

            osc.connect(gain);
            gain.connect(this.masterGain!);

            osc.start(start);
            osc.stop(start + 0.4);
        });
    }
}

// Singleton instance
export const soundService = new SoundService();
