/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { Settings, Play, Home, Volume2, VolumeX, Sun, MousePointer, ChevronLeft } from 'lucide-react';
import type { GameSettings } from '../types';

interface PauseMenuProps {
    onResume: () => void;
    onMainMenu: () => void;
    settings: GameSettings;
    onSettingsChange: (settings: GameSettings) => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({ onResume, onMainMenu, settings, onSettingsChange }) => {
    const [showSettings, setShowSettings] = useState(false);

    return (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 text-white">

            {/* Title */}
            <div className="text-center mb-8 absolute top-16">
                <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-600 drop-shadow-[0_0_15px_rgba(0,255,255,0.5)]">
                    PAUSED
                </h1>
            </div>

            {/* Menu Container - Same style as MainMenu */}
            <div className="w-full max-w-md bg-zinc-900/90 border border-white/10 p-8 rounded-2xl shadow-2xl backdrop-blur-md relative overflow-hidden">

                {/* Decorative top line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>

                {!showSettings ? (
                    <div className="flex flex-col gap-4">
                        {/* Resume */}
                        <button
                            onClick={onResume}
                            className="group relative px-6 py-4 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/50 rounded-xl transition-all duration-300 flex items-center gap-4"
                        >
                            <div className="p-3 rounded-lg bg-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500/30 transition-all">
                                <Play size={24} />
                            </div>
                            <div className="text-left">
                                <span className="block font-bold text-lg text-white">CONTINUE</span>
                                <span className="block text-sm text-gray-400">Resume gameplay</span>
                            </div>
                        </button>

                        {/* Settings */}
                        <button
                            onClick={() => setShowSettings(true)}
                            className="group relative px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all duration-300 flex items-center gap-4"
                        >
                            <div className="p-3 rounded-lg bg-gray-500/20 text-gray-400 group-hover:bg-gray-500/30 transition-all">
                                <Settings size={24} />
                            </div>
                            <div className="text-left">
                                <span className="block font-bold text-lg text-white">SETTINGS</span>
                                <span className="block text-sm text-gray-400">Audio, Controls & Display</span>
                            </div>
                        </button>

                        {/* Main Menu */}
                        <button
                            onClick={onMainMenu}
                            className="group relative px-6 py-4 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/50 rounded-xl transition-all duration-300 flex items-center gap-4"
                        >
                            <div className="p-3 rounded-lg bg-red-500/20 text-red-400 group-hover:bg-red-500/30 transition-all">
                                <Home size={24} />
                            </div>
                            <div className="text-left">
                                <span className="block font-bold text-lg text-white">EXIT</span>
                                <span className="block text-sm text-gray-400">Return to Main Menu</span>
                            </div>
                        </button>

                        {/* ESC Hint */}
                        <p className="text-center text-gray-500 text-xs mt-4">
                            Press <kbd className="px-2 py-1 bg-zinc-800 rounded text-gray-400 text-xs">ESC</kbd> to resume
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Settings Panel */}
                        <h2 className="text-xl font-bold text-center mb-6 text-white uppercase tracking-wider">Settings</h2>

                        <div className="space-y-5">
                            {/* Sensitivity */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <MousePointer size={18} className="text-cyan-400" />
                                    <span className="text-white font-medium">Sensitivity</span>
                                    <span className="ml-auto text-cyan-400 font-mono">{settings.sensitivity.toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="2"
                                    step="0.1"
                                    value={settings.sensitivity}
                                    onChange={(e) => onSettingsChange({ ...settings, sensitivity: parseFloat(e.target.value) })}
                                    className="w-full accent-cyan-500"
                                />
                            </div>

                            {/* Brightness */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <Sun size={18} className="text-yellow-400" />
                                    <span className="text-white font-medium">Brightness</span>
                                    <span className="ml-auto text-yellow-400 font-mono">{Math.round(settings.brightness * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="1"
                                    step="0.05"
                                    value={settings.brightness}
                                    onChange={(e) => onSettingsChange({ ...settings, brightness: parseFloat(e.target.value) })}
                                    className="w-full accent-yellow-500"
                                />
                            </div>

                            {/* Sound Toggle */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {settings.sound ? <Volume2 size={18} className="text-green-400" /> : <VolumeX size={18} className="text-red-400" />}
                                    <span className="text-white font-medium">Sound</span>
                                </div>
                                <button
                                    onClick={() => onSettingsChange({ ...settings, sound: !settings.sound })}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${settings.sound ? 'bg-green-600/80 text-white' : 'bg-zinc-700 text-gray-400'
                                        }`}
                                >
                                    {settings.sound ? 'ON' : 'OFF'}
                                </button>
                            </div>
                        </div>

                        {/* Back Button */}
                        <button
                            onClick={() => setShowSettings(false)}
                            className="w-full mt-6 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2"
                        >
                            <ChevronLeft size={20} />
                            Back
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
