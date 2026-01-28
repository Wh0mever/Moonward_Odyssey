/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { Difficulty, GameSettings } from '../types';
import { Play, Settings, XCircle, ChevronLeft, Volume2, VolumeX, MousePointer2, Sun, GraduationCap, Users } from 'lucide-react';

interface MainMenuProps {
  onStart: (settings: GameSettings, isTutorial?: boolean) => void;
  initialSettings: GameSettings;
  onMultiplayer?: () => void;
}

type MenuState = 'MAIN' | 'DIFFICULTY' | 'SETTINGS';

export const MainMenu: React.FC<MainMenuProps> = ({ onStart, initialSettings, onMultiplayer }) => {
  const [menuState, setMenuState] = useState<MenuState>('MAIN');
  const [settings, setSettings] = useState<GameSettings>(initialSettings);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const lfosRef = useRef<OscillatorNode[]>([]);
  const masterGainRef = useRef<GainNode | null>(null);

  // Sync music with sound setting
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = settings.sound ? 0.3 : 0;
    }
  }, [settings.sound]);

  // Cinematic Space Music
  useEffect(() => {
    const startCinematicMusic = () => {
      if (audioContextRef.current) return;

      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = ctx;

        const masterGain = ctx.createGain();
        masterGain.gain.value = settings.sound ? 0.3 : 0;
        masterGain.connect(ctx.destination);
        masterGainRef.current = masterGain;

        // === PAD LAYER (Ethereal sustained chords) ===
        const createPad = (freq: number, vol: number, panValue: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          const panner = ctx.createStereoPanner();

          osc.type = 'sine';
          osc.frequency.value = freq;

          // Slow vibrato
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          lfo.frequency.value = 0.15;
          lfoGain.gain.value = freq * 0.008;
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          lfo.start();
          lfosRef.current.push(lfo);

          filter.type = 'lowpass';
          filter.frequency.value = 600;
          filter.Q.value = 1;

          gain.gain.value = vol;
          panner.pan.value = panValue;

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(panner);
          panner.connect(masterGain);

          osc.start();
          oscillatorsRef.current.push(osc);
        };

        // Amin7 chord spread across stereo
        createPad(110, 0.25, -0.6);   // A2
        createPad(164.81, 0.2, 0.3);  // E3
        createPad(220, 0.15, -0.2);   // A3
        createPad(261.63, 0.12, 0.5); // C4
        createPad(329.63, 0.08, 0);   // E4

        // === ARPEGGIO LAYER (Gentle repeating notes) ===
        const arpNotes = [220, 261.63, 329.63, 440, 329.63, 261.63]; // A3, C4, E4, A4, E4, C4
        let arpIndex = 0;

        const playArpNote = () => {
          if (!audioContextRef.current) return;

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = 'triangle';
          osc.frequency.value = arpNotes[arpIndex];

          filter.type = 'lowpass';
          filter.frequency.value = 1200;

          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(masterGain);

          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 1.5);

          arpIndex = (arpIndex + 1) % arpNotes.length;
        };

        // Start arpeggio loop
        playArpNote();
        const arpInterval = setInterval(playArpNote, 800);
        (audioContextRef.current as any).arpInterval = arpInterval;

      } catch (e) {
        console.warn('Could not start cinematic music');
      }
    };

    // Start on first interaction
    const handleInteraction = () => {
      startCinematicMusic();
      document.removeEventListener('click', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      oscillatorsRef.current.forEach(osc => {
        try { osc.stop(); } catch (e) { }
      });
      lfosRef.current.forEach(lfo => {
        try { lfo.stop(); } catch (e) { }
      });
      oscillatorsRef.current = [];
      lfosRef.current = [];
      if (audioContextRef.current) {
        clearInterval((audioContextRef.current as any).arpInterval);
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  const handleDifficultySelect = (diff: Difficulty) => {
    // Stop ambient music when starting game
    oscillatorsRef.current.forEach(osc => {
      try { osc.stop(); } catch (e) { }
    });
    onStart({ ...settings, difficulty: diff }, false);
  };

  const handleTutorialStart = () => {
    oscillatorsRef.current.forEach(osc => {
      try { osc.stop(); } catch (e) { }
    });
    onStart(settings, true);
  };

  const handleExit = () => {
    window.close();
    alert("Please close the browser tab to exit.");
  };

  // Helper to render logo images or text fallback
  const renderLogo = (name: string, src: string, link: string, noGrayscale = false) => (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="h-12 px-4 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all hover:scale-105 border border-white/10 backdrop-blur-sm group"
      title={name}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className={`max-h-8 max-w-[120px] object-contain transition-opacity ${noGrayscale ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}
          onError={(e) => {
            // Fallback to text if image fails
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <span className={`text-sm font-bold text-white/80 group-hover:text-white ${src ? 'hidden' : ''}`}>
        {name}
      </span>
    </a>
  );

  // Calculate brightness overlay opacity (lower brightness = darker overlay)
  const brightnessOverlay = 1 - settings.brightness;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white">

      {/* Brightness overlay */}
      <div
        className="absolute inset-0 bg-black pointer-events-none z-[60] transition-opacity duration-300"
        style={{ opacity: brightnessOverlay * 0.8 }}
      />

      {/* Branding Header */}
      <div className="text-center mb-12 animate-fade-in-down">
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-600 mb-2 drop-shadow-[0_0_15px_rgba(0,255,255,0.5)]">
          MOONWARD
        </h1>
        <h2 className="text-4xl md:text-6xl font-light tracking-[0.2em] text-white uppercase mb-4">
          ODYSSEY 2
        </h2>
        <p className="text-gray-400 text-sm tracking-widest uppercase">
          Developed by Team <span className="text-cyan-400 font-bold">WHOMEVER</span>
        </p>
        <p className="text-gray-500 text-xs mt-1">
          GGJ School 21 Tashkent • 27-01-2026
        </p>
      </div>

      {/* Menu Container */}
      <div className="w-full max-w-md bg-zinc-900/90 border border-white/10 p-8 rounded-2xl shadow-2xl backdrop-blur-md relative overflow-hidden">

        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>

        {menuState === 'MAIN' && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setMenuState('DIFFICULTY')}
              className="group relative px-6 py-4 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/50 rounded-xl transition-all duration-300 flex items-center gap-4"
            >
              <div className="p-2 bg-cyan-500/20 rounded-lg group-hover:bg-cyan-500 text-cyan-400 group-hover:text-black transition-colors">
                <Play size={24} fill="currentColor" />
              </div>
              <div className="text-left">
                <div className="font-bold text-lg">START GAME</div>
                <div className="text-xs text-gray-400 group-hover:text-cyan-200">Begin your survival journey</div>
              </div>
            </button>

            <button
              onClick={handleTutorialStart}
              className="group relative px-6 py-4 bg-white/5 hover:bg-green-500/20 border border-white/10 hover:border-green-500/50 rounded-xl transition-all duration-300 flex items-center gap-4"
            >
              <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500 text-green-400 group-hover:text-black transition-colors">
                <GraduationCap size={24} />
              </div>
              <div className="text-left">
                <div className="font-bold text-lg">TRAINING POLYGON</div>
                <div className="text-xs text-gray-400 group-hover:text-green-200">Learn controls & combat</div>
              </div>
            </button>

            {onMultiplayer && (
              <button
                onClick={onMultiplayer}
                className="group relative px-6 py-4 bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all duration-300 flex items-center gap-4"
              >
                <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500 text-purple-400 group-hover:text-white transition-colors">
                  <Users size={24} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">MULTIPLAYER</div>
                  <div className="text-xs text-gray-400 group-hover:text-purple-200">Play with friends online</div>
                </div>
              </button>
            )}

            <button
              onClick={() => setMenuState('SETTINGS')}
              className="group relative px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-xl transition-all duration-300 flex items-center gap-4"
            >
              <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white text-gray-300 group-hover:text-black transition-colors">
                <Settings size={24} />
              </div>
              <div className="text-left">
                <div className="font-bold text-lg">SETTINGS</div>
                <div className="text-xs text-gray-400">Audio, Controls & Display</div>
              </div>
            </button>

            <button
              onClick={handleExit}
              className="group relative px-6 py-4 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 rounded-xl transition-all duration-300 flex items-center gap-4"
            >
              <div className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500 text-red-400 group-hover:text-white transition-colors">
                <XCircle size={24} />
              </div>
              <div className="text-left">
                <div className="font-bold text-lg">EXIT</div>
                <div className="text-xs text-gray-400 group-hover:text-red-200">Close Application</div>
              </div>
            </button>
          </div>
        )}

        {menuState === 'DIFFICULTY' && (
          <div className="flex flex-col gap-3 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setMenuState('MAIN')} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft /></button>
              <h3 className="text-xl font-bold">SELECT DIFFICULTY</h3>
            </div>

            {[
              { id: Difficulty.EASY, label: 'EASY', desc: 'Standard resources. Low meteor activity.', color: 'border-green-500/50 text-green-400' },
              { id: Difficulty.MEDIUM, label: 'MEDIUM', desc: 'More enemies. Frequent meteors.', color: 'border-yellow-500/50 text-yellow-400' },
              { id: Difficulty.HARD, label: 'HARD', desc: 'Scarce oxygen. Intense storms.', color: 'border-orange-500/50 text-orange-400' },
              { id: Difficulty.SEVERE, label: 'SEVERE', desc: 'A true nightmare. Good luck.', color: 'border-red-500/50 text-red-400' },
            ].map((diff) => (
              <button
                key={diff.id}
                onClick={() => handleDifficultySelect(diff.id)}
                className={`w-full p-4 border ${diff.color} bg-black/20 hover:bg-white/5 rounded-lg text-left transition-all hover:scale-[1.02]`}
              >
                <div className="font-bold">{diff.label}</div>
                <div className="text-xs text-gray-500">{diff.desc}</div>
              </button>
            ))}
          </div>
        )}

        {menuState === 'SETTINGS' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setMenuState('MAIN')} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft /></button>
              <h3 className="text-xl font-bold">PARAMETERS</h3>
            </div>

            <div className="space-y-4">
              {/* Sensitivity */}
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                  <MousePointer2 size={16} /> Aim Sensitivity
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={settings.sensitivity}
                    onChange={(e) => setSettings({ ...settings, sensitivity: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="font-mono text-cyan-400 w-8">{settings.sensitivity}</span>
                </div>
              </div>

              {/* Brightness */}
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                  <Sun size={16} /> Brightness
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={settings.brightness}
                    onChange={(e) => setSettings({ ...settings, brightness: parseFloat(e.target.value) })}
                    className="w-full accent-yellow-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="font-mono text-yellow-400 w-8">{Math.round(settings.brightness * 100)}%</span>
                </div>
              </div>

              {/* Audio */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <span className="flex items-center gap-2 text-sm text-gray-300">
                  {settings.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  Master Audio
                </span>
                <button
                  onClick={() => setSettings({ ...settings, sound: !settings.sound })}
                  className={`w-12 h-6 rounded-full relative transition-colors ${settings.sound ? 'bg-cyan-600' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.sound ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Partner Logos Footer */}
      <div className="absolute bottom-8 flex gap-6 flex-wrap justify-center items-center px-4 w-full max-w-5xl">
        {renderLogo(
          "WHOMEVER",
          "/whomever_logo.jpg",
          "https://whomever.uz/",
          true
        )}
        {renderLogo(
          "21 School",
          "https://habrastorage.org/getpro/moikrug/uploads/company/100/006/968/4/logo/medium_f3ccdd27d2000e3f9255a7e3e2c48800.jpg",
          "https://21-school.uz/",
          true
        )}
        {renderLogo(
          "East Games",
          "data:image/png;base64,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",
          "https://eastgames.uz/",
          true
        )}
      </div>
    </div>
  );
};