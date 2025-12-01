
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { Difficulty, GameSettings } from '../types';
import { Play, Settings, XCircle, ChevronLeft, Volume2, VolumeX, MousePointer2 } from 'lucide-react';

interface MainMenuProps {
  onStart: (settings: GameSettings) => void;
  initialSettings: GameSettings;
}

type MenuState = 'MAIN' | 'DIFFICULTY' | 'SETTINGS';

export const MainMenu: React.FC<MainMenuProps> = ({ onStart, initialSettings }) => {
  const [menuState, setMenuState] = useState<MenuState>('MAIN');
  const [settings, setSettings] = useState<GameSettings>(initialSettings);

  const handleDifficultySelect = (diff: Difficulty) => {
    onStart({ ...settings, difficulty: diff });
  };

  const handleExit = () => {
    window.close();
    alert("Please close the browser tab to exit.");
  };

  // Helper to render logo images
  const renderLogo = (name: string, src: string, link: string) => (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="h-12 px-4 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center transition-all hover:scale-105 border border-white/5 backdrop-blur-sm group"
      title={name}
    >
      <img
        src={src}
        alt={name}
        className="max-h-8 max-w-[100px] object-contain opacity-70 group-hover:opacity-100 transition-opacity filter grayscale group-hover:grayscale-0"
      />
    </a>
  );

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white">

      {/* Branding Header */}
      <div className="text-center mb-12 animate-fade-in-down">
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-600 mb-2 drop-shadow-[0_0_15px_rgba(0,255,255,0.5)]">
          MOONWARD
        </h1>
        <h2 className="text-4xl md:text-6xl font-light tracking-[0.2em] text-white uppercase mb-4">
          ODYSSEY
        </h2>
        <p className="text-gray-400 text-sm tracking-widest uppercase">
          Developed by Team <span className="text-cyan-400 font-bold">WHOMEVER</span>
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
          "21 School",
          "https://habrastorage.org/getpro/moikrug/uploads/company/100/006/968/4/logo/medium_f3ccdd27d2000e3f9255a7e3e2c48800.jpg",
          "https://21-school.uz/"
        )}
        {renderLogo(
          "East Games",
          "https://play-lh.googleusercontent.com/tnx148d2RuzetzXpTrRowzhbAAlY3rwNARBcpPPHIYQWfUW9fkELUKCoIK1c03h-_6E", // Approximate, replace with local if needed
          "https://eastgames.uz/"
        )}
        {renderLogo(
          "UzSpace",
          "https://media.licdn.com/dms/image/v2/D4D0BAQEx4HDGdk3EwQ/company-logo_200_200/B4DZgR.wCoHYAM-/0/1752648326832/uzbekspace_logo?e=2147483647&v=beta&t=ZrM9PKhNCyJ4xTp0GsOl8l2_z11Pe2SkUD55HgZ0s44", // Standard Uzspace logo
          "https://uzspace.uz/uz"
        )}
        {renderLogo(
          "Yandex Uzbekistan",
          "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Yandex_icon.svg/1024px-Yandex_icon.svg.png",
          "https://yandex.uz/"
        )}
      </div>
    </div>
  );
};
