
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef } from 'react';
import { PlayerStats, Meteor, GameState, Enemy } from '../types';
import { Heart, Wind, Zap, AlertTriangle, Skull, Save } from 'lucide-react';

interface HUDProps {
  stats: PlayerStats;
  meteors: Meteor[];
  enemies: Enemy[];
  gameState: GameState;
  onRestart: () => void;
  deathReason: string | null;
}

const Radar: React.FC<{ playerPos: { x: number, z: number }, meteors: Meteor[], enemies: Enemy[] }> = ({ playerPos, meteors, enemies }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const size = 120;
    const range = 60; // Radar range in meters

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Draw Background
    ctx.fillStyle = 'rgba(0, 20, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw Player
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw Meteors
    // Draw Meteors
    meteors.forEach(m => {
      const dx = m.position[0] - playerPos.x;
      const dz = m.position[2] - playerPos.z;

      const rx = (dx / range) * (size / 2);
      const rz = (dz / range) * (size / 2);

      if (Math.abs(rx) < size / 2 && Math.abs(rz) < size / 2) {
        if (!m.isFalling) {
          // WARNING PHASE
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 1;
          ctx.beginPath();
          // Draw impact radius scaled to radar
          const impactRadiusOnRadar = (m.radius / range) * (size / 2) * 4; // *4 to make it more visible
          ctx.arc(size / 2 + rx, size / 2 + rz, Math.max(3, impactRadiusOnRadar), 0, Math.PI * 2);
          ctx.stroke();

          // Draw "!"
          ctx.fillStyle = '#ff0000';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('!', size / 2 + rx, size / 2 + rz);
        } else {
          // FALLING PHASE
          ctx.fillStyle = '#ff4400';
          ctx.beginPath();
          ctx.arc(size / 2 + rx, size / 2 + rz, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // Draw Enemies
    enemies.forEach(e => {
      const dx = e.position[0] - playerPos.x;
      const dz = e.position[2] - playerPos.z;
      const rx = (dx / range) * (size / 2);
      const rz = (dz / range) * (size / 2);

      if (Math.abs(rx) < size / 2 && Math.abs(rz) < size / 2) {
        ctx.fillStyle = '#a020f0'; // Purple
        ctx.beginPath();
        ctx.arc(size / 2 + rx, size / 2 + rz, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

  }, [playerPos, meteors, enemies]);

  return <canvas ref={canvasRef} width={120} height={120} className="rounded-full border border-green-800 bg-black/50" />;
};

const HUD: React.FC<HUDProps> = ({ stats, meteors, enemies, gameState, onRestart, deathReason }) => {
  if (gameState === GameState.DEAD) {
    return (
      <div className="absolute inset-0 bg-red-900/40 backdrop-blur-sm flex flex-col items-center justify-center z-50">
        <Skull className="w-24 h-24 text-red-500 mb-4 animate-pulse" />
        <h1 className="text-6xl font-black text-white mb-2 uppercase tracking-widest">Wasted</h1>
        <p className="text-xl text-red-200 mb-8">{deathReason || "You died."}</p>

        <div className="bg-black/80 p-6 rounded-lg border border-red-500/50 text-center mb-8">
          <p className="text-gray-400">Level Reached: <span className="text-yellow-400">{stats.level}</span></p>
          <p className="text-xs text-red-500 mt-2">SAVE DATA DELETED</p>
        </div>

        <button
          onClick={onRestart}
          className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-[0_0_20px_rgba(220,38,38,0.6)] transition-all hover:scale-105"
        >
          RESPAWN
        </button>
      </div>
    );
  }

  const oxPercent = (stats.oxygen / stats.maxOxygen) * 100;

  return (
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <div className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 w-64">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                <Heart size={12} /> Health
              </span>
              <span className="text-xs font-mono text-green-400">{Math.ceil(stats.health)} / {stats.maxHealth}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: `${(stats.health / stats.maxHealth) * 100}%` }}></div>
            </div>

            <div className="flex justify-between items-center mt-3 mb-1">
              <span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                <Wind size={12} /> Oxygen
              </span>
              <span className={`text-xs font-mono ${stats.oxygen < 20 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                {Math.ceil(stats.oxygen)}
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${oxPercent}%` }}></div>
            </div>
          </div>
          {stats.oxygen < 20 && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-2 rounded flex items-center gap-2 animate-pulse">
              <AlertTriangle size={16} /> CRITICAL OXYGEN LEVELS
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
            <p className="text-xs text-gray-400 uppercase tracking-wider flex items-center justify-end gap-1">
              <Save size={10} /> Experience
            </p>
            <div className="flex items-center gap-2 justify-end">
              <Zap className="text-yellow-400" size={20} />
              <span className="text-3xl font-bold font-mono text-white">{stats.xp}</span>
            </div>
            <p className="text-yellow-400 font-bold mt-1">LVL {stats.level}</p>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Radar playerPos={{ x: stats.position.x, z: stats.position.z }} meteors={meteors} enemies={enemies} />
          <p className="text-xs text-gray-500 font-mono">SECTOR: {Math.floor(stats.position.x / 100)} : {Math.floor(stats.position.z / 100)}</p>
        </div>

        <div className="text-right opacity-50">
          <p className="text-[10px] uppercase text-gray-400">System Integrity: 98%</p>
          <p className="text-[10px] uppercase text-gray-400">Gravity: 1.62 m/s²</p>
          <p className="text-[10px] uppercase text-green-600 mt-1">Autosave Enabled</p>
        </div>
      </div>

      {/* Center Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-50">
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white"></div>
        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white"></div>
      </div>
    </div>
  );
};

export default HUD;
