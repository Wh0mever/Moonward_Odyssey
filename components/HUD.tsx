
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef, useState } from 'react';
import { PlayerStats, Meteor, GameState, Enemy, MeteorState, Collectible, CollectibleType } from '../types';
import { Heart, Wind, Zap, Skull, Save, Disc, Battery, Crosshair } from 'lucide-react';

interface HUDProps {
  stats: PlayerStats;
  meteors: Meteor[];
  enemies: Enemy[];
  collectibles: Collectible[];
  gameState: GameState;
  onRestart: () => void;
  deathReason: string | null;
  isEquipped: boolean;
  isHovering?: boolean;
}

const Radar: React.FC<{ playerPos: {x:number, z:number}, meteors: Meteor[], enemies: Enemy[], collectibles: Collectible[] }> = ({ playerPos, meteors, enemies, collectibles }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const size = 210; // Increased size by ~30% (was 160)
    const range = 80; 
    const radius = size / 2;

    ctx.clearRect(0, 0, size, size);
    
    // Background
    ctx.fillStyle = 'rgba(0, 20, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Player Dot
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(radius, radius, 2, 0, Math.PI * 2);
    ctx.fill();

    // Home Arrow / Icon Logic (Pointing to 0,0)
    const homeDx = 0 - playerPos.x;
    const homeDz = 0 - playerPos.z;
    const homeDist = Math.sqrt(homeDx * homeDx + homeDz * homeDz);
    
    // Calculate position on radar
    let homeRx = (homeDx / range) * radius;
    let homeRz = (homeDz / range) * radius;
    
    const distOnRadar = Math.sqrt(homeRx * homeRx + homeRz * homeRz);
    
    ctx.save();
    ctx.translate(radius, radius);

    if (distOnRadar > radius - 10) {
        // Clamp to edge
        const angle = Math.atan2(homeRz, homeRx);
        const clampRadius = radius - 8;
        const arrowX = Math.cos(angle) * clampRadius;
        const arrowY = Math.sin(angle) * clampRadius;
        
        ctx.translate(arrowX, arrowY);
        ctx.rotate(angle);
        
        // Draw Arrow pointing out
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-8, -4);
        ctx.lineTo(-8, 4);
        ctx.fill();
    } else {
        // Draw Home Icon inside
        ctx.fillStyle = '#00ffff';
        ctx.translate(homeRx, homeRz);
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(5, 0);
        ctx.lineTo(3, 0);
        ctx.lineTo(3, 5);
        ctx.lineTo(-3, 5);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-5, 0);
        ctx.fill();
    }
    ctx.restore();


    // Draw Meteors
    meteors.forEach(m => {
      const tX = m.state === MeteorState.TARGETING ? m.targetPos.x : m.position[0];
      const tZ = m.state === MeteorState.TARGETING ? m.targetPos.z : m.position[2];
      const dx = tX - playerPos.x;
      const dz = tZ - playerPos.z;
      const rx = (dx / range) * radius;
      const rz = (dz / range) * radius;

      if (Math.abs(rx) < radius && Math.abs(rz) < radius && (rx*rx + rz*rz) < radius*radius) {
        if (m.state === MeteorState.TARGETING) {
             ctx.strokeStyle = '#ff0000';
             ctx.beginPath();
             ctx.arc(radius + rx, radius + rz, 4, 0, Math.PI * 2);
             ctx.stroke();
        } else {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(radius + rx, radius + rz, 3, 0, Math.PI * 2);
            ctx.fill();
        }
      }
    });

    // Draw Enemies
    enemies.forEach(e => {
        const dx = e.position[0] - playerPos.x;
        const dz = e.position[2] - playerPos.z;
        const rx = (dx / range) * radius;
        const rz = (dz / range) * radius;

        if ((rx*rx + rz*rz) < radius*radius) {
            ctx.fillStyle = '#a020f0'; 
            ctx.beginPath();
            ctx.arc(radius + rx, radius + rz, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Draw Collectibles (ONLY Oxygen and XP)
    collectibles.forEach(c => {
        if (c.type !== CollectibleType.OXYGEN && c.type !== CollectibleType.XP) return;

        const dx = c.position[0] - playerPos.x;
        const dz = c.position[2] - playerPos.z;
        const rx = (dx / range) * radius;
        const rz = (dz / range) * radius;

        if ((rx*rx + rz*rz) < radius*radius) {
            ctx.fillStyle = c.type === CollectibleType.OXYGEN ? '#00ffff' : '#ffd700'; 
            ctx.beginPath();
            ctx.arc(radius + rx, radius + rz, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    });

  }, [playerPos, meteors, enemies, collectibles]);

  return <canvas ref={canvasRef} width={210} height={210} className="rounded-full border border-green-800 bg-black/50" />;
};

const HUD: React.FC<HUDProps> = ({ stats, meteors, enemies, collectibles, gameState, onRestart, deathReason, isEquipped, isHovering }) => {
  const [showTutorial, setShowTutorial] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowTutorial(false), 4000);
    return () => clearTimeout(t);
  }, []);

  if (gameState === GameState.DEAD) {
    return (
      <div className="absolute inset-0 bg-red-900/40 backdrop-blur-sm flex flex-col items-center justify-center z-50">
        <Skull className="w-24 h-24 text-red-500 mb-4 animate-pulse" />
        <h1 className="text-6xl font-black text-white mb-2 uppercase tracking-widest">Wasted</h1>
        <p className="text-xl text-red-200 mb-8">{deathReason || "You died."}</p>
        <button onClick={onRestart} className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-[0_0_20px_rgba(220,38,38,0.6)]">RESPAWN</button>
      </div>
    );
  }

  const oxPercent = (stats.oxygen / stats.maxOxygen) * 100;
  const stPercent = (stats.stamina / stats.maxStamina) * 100;

  return (
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
      
      {/* Center Crosshair - Visible always when alive */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_5px_cyan]"></div>
        <div className="w-6 h-6 border border-cyan-400/30 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      {/* Top Left: Health & Objectives */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
            <div className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 w-64">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><Heart size={12} /> Health</span>
                    <span className="text-xs font-mono text-green-400">{Math.ceil(stats.health)} / {stats.maxHealth}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-green-500" style={{ width: `${(stats.health / stats.maxHealth) * 100}%` }}></div>
                </div>

                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><Wind size={12} /> Oxygen</span>
                    <span className="text-xs font-mono text-cyan-400">{Math.ceil(stats.oxygen)}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-cyan-500" style={{ width: `${oxPercent}%` }}></div>
                </div>

                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><Battery size={12} /> Stamina</span>
                    <span className="text-xs font-mono text-yellow-400">{Math.ceil(stats.stamina)}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500" style={{ width: `${stPercent}%` }}></div>
                </div>
            </div>

            {/* Mission Objective */}
            <div className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-purple-500/30 w-64 mt-2">
                <p className="text-[10px] font-bold text-purple-400 uppercase mb-2">Current Objective</p>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-white">Rocket Fuel</span>
                    <span className={`text-xs font-mono ${stats.fuel >= 100 ? 'text-green-400' : 'text-purple-300'}`}>{stats.fuel}/100</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs text-white">Artifacts</span>
                    <span className={`text-xs font-mono ${stats.artifacts >= 4 ? 'text-green-400' : 'text-blue-300'}`}>{stats.artifacts}/4</span>
                </div>
                <p className="text-[9px] text-gray-400 mt-2 italic">Deposit at Landing Site to Launch</p>
            </div>
        </div>

        {/* Top Right: XP */}
        <div className="text-right">
            <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
                <p className="text-xs text-gray-400 uppercase flex items-center justify-end gap-1"><Save size={10} /> Experience</p>
                <div className="flex items-center gap-2 justify-end">
                    <Zap className="text-yellow-400" size={20} />
                    <span className="text-3xl font-bold font-mono text-white">{stats.xp}</span>
                </div>
                <p className="text-yellow-400 font-bold mt-1">LVL {stats.level}</p>
            </div>
        </div>
      </div>

      {/* Center Interaction Hint */}
      {(showTutorial || isHovering) && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center mt-8">
            <div className="w-1 h-1 bg-white rounded-full mb-2"></div>
            <div className="text-white/80 text-xs tracking-widest font-mono bg-black/50 px-2 py-1 rounded border border-white/20">
                [ E ] TO INTERACT
            </div>
        </div>
      )}

      {/* Bottom Bar: Radar + Inventory + Ammo */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
            <Radar 
                playerPos={{x: stats.position.x, z: stats.position.z}} 
                meteors={meteors} 
                enemies={enemies}
                collectibles={collectibles}
            />
        </div>
        
        {/* Inventory Hotbar */}
        <div className="flex gap-2 bg-black/50 p-2 rounded-lg border border-white/10 backdrop-blur">
            <div className={`w-12 h-12 border-2 ${isEquipped ? 'border-yellow-400 bg-yellow-400/20' : 'border-gray-600 bg-black/40'} rounded flex items-center justify-center relative`}>
                <span className="absolute top-0 left-1 text-[10px] text-white">1</span>
                <Crosshair size={24} className={isEquipped ? 'text-white' : 'text-gray-500'} />
            </div>
            <div className="w-12 h-12 border-2 border-gray-700 bg-black/60 rounded flex items-center justify-center opacity-50 relative">
                <span className="absolute top-0 left-1 text-[10px] text-gray-500">2</span>
            </div>
            <div className="w-12 h-12 border-2 border-gray-700 bg-black/60 rounded flex items-center justify-center opacity-50 relative">
                 <span className="absolute top-0 left-1 text-[10px] text-gray-500">3</span>
            </div>
        </div>

        {/* Ammo Counter */}
        <div className="flex items-end gap-4">
             <div className="bg-black/60 backdrop-blur-md px-6 py-4 rounded-lg border border-green-900/50">
                <div className="flex items-center gap-3">
                    <Disc size={32} className="text-gray-400" />
                    <div className="text-right">
                        <p className="text-4xl font-bold font-mono text-white leading-none">{stats.ammo}</p>
                        <p className="text-[10px] text-gray-500 uppercase">Ammunition</p>
                    </div>
                </div>
             </div>
        </div>
      </div>
      
      {/* Start Game Hint */}
      {stats.xp === 0 && stats.level === 1 && showTutorial && (
         <div className="absolute top-24 left-1/2 -translate-x-1/2 text-center pointer-events-none animate-fade-in-down">
            <div className="bg-black/80 backdrop-blur px-6 py-4 rounded-xl border border-cyan-500/30 shadow-[0_0_20px_rgba(0,255,255,0.2)]">
                <p className="text-cyan-400 font-bold mb-1">MISSION: EXTRACTION</p>
                <p className="text-gray-300 text-sm mb-2">Find <span className="text-purple-400">100 Fuel</span> OR <span className="text-blue-400">4 Artifacts</span></p>
                <p className="text-gray-400 text-xs">Left Click: Shoot | E: Interact | Space: Jump</p>
            </div>
         </div>
      )}
    </div>
  );
};

export default HUD;
