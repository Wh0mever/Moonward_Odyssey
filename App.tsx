
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, Suspense, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { TerrainManager } from './components/Terrain';
import { Player } from './components/Player';
import { MeteorSystem } from './components/Meteors';
import { CollectiblesManager } from './components/Collectibles';
import { EnemiesManager } from './components/Enemies';
import HUD from './components/HUD';
import { MainMenu } from './components/MainMenu';
import { GameState, PlayerStats, Meteor, Collectible, CollectibleType, Enemy, EnemyType, Cactus, GameSettings, Difficulty } from './types';
import { getTerrainHeight } from './services/geminiService';
import { saveGame, loadGame, clearSave } from './services/storageService';

const INITIAL_STATS: PlayerStats = {
  health: 100,
  maxHealth: 100,
  oxygen: 100,
  maxOxygen: 100,
  xp: 0,
  level: 1,
  position: { x: 0, y: 10, z: 0 }
};

const DEFAULT_SETTINGS: GameSettings = {
  difficulty: Difficulty.EASY,
  sensitivity: 1.0,
  sound: true
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS);
  const [activeMeteors, setActiveMeteors] = useState<Meteor[]>([]);
  const [collectibles, setCollectibles] = useState<Collectible[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [cacti, setCacti] = useState<Cactus[]>([]);
  const [deathReason, setDeathReason] = useState<string | null>(null);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);

  const [gameKey, setGameKey] = useState(0);
  const lastEntitySpawn = useRef(0);
  const loadedOnce = useRef(false);

  // Load game on start
  useEffect(() => {
    if (!loadedOnce.current) {
      const saved = loadGame();
      if (saved) {
        console.log("Save found, loading...", saved);
        setStats(saved);
      }
      loadedOnce.current = true;
    }
  }, []);

  const handleStartGame = (newSettings: GameSettings) => {
    setSettings(newSettings);
    setGameState(GameState.PLAYING);
  };

  const getDifficultyMultiplier = () => {
    switch (settings.difficulty) {
      case Difficulty.EASY: return 1.0;
      case Difficulty.MEDIUM: return 1.5;
      case Difficulty.HARD: return 2.0;
      case Difficulty.SEVERE: return 3.0;
      default: return 1.0;
    }
  };

  const handleStatsUpdate = (newStats: PlayerStats) => {
    setStats(newStats);
    saveGame(newStats); // Auto-save

    // Spawn Logic
    const now = Date.now();
    // Faster spawns on higher difficulty
    const spawnRate = 1500 / getDifficultyMultiplier();

    if (now - lastEntitySpawn.current > spawnRate) {
      spawnEntities(newStats.position);
      lastEntitySpawn.current = now;
    }
  };

  const spawnEntities = (playerPos: { x: number, z: number }) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 15 + Math.random() * 25;
    const x = playerPos.x + Math.cos(angle) * distance;
    const z = playerPos.z + Math.sin(angle) * distance;
    const terrainH = getTerrainHeight(x, z);
    const y = terrainH + 1.5;

    const rand = Math.random();
    const multiplier = getDifficultyMultiplier();

    // 30% Chance Collectible
    if (rand < 0.3 && collectibles.length < 15) {
      const type = Math.random() > 0.7 ? CollectibleType.XP : CollectibleType.OXYGEN;
      setCollectibles(prev => [...prev, {
        id: Math.random().toString(),
        type,
        position: [x, y, z],
        value: type === CollectibleType.OXYGEN ? 25 : 100
      }]);
    }
    // 20% Chance Enemy (Scaled by Difficulty)
    else if (rand < 0.5 && enemies.length < 5 * multiplier) {
      setEnemies(prev => [...prev, {
        id: Math.random().toString(),
        type: EnemyType.ZOMBIE,
        position: [x, terrainH + 1, z],
        health: 100
      }]);
    }
    // 20% Chance Cactus
    else if (rand < 0.7 && cacti.length < 10) {
      setCacti(prev => [...prev, {
        id: Math.random().toString(),
        position: [x, terrainH + 1.5, z]
      }]);
    }
  };

  const handleCollect = (item: Collectible) => {
    setCollectibles(prev => prev.filter(c => c.id !== item.id));
    setStats(prev => {
      const next = { ...prev };
      if (item.type === CollectibleType.OXYGEN) {
        next.oxygen = Math.min(next.oxygen + item.value, next.maxOxygen);
      } else {
        next.xp += item.value;
      }
      return next;
    });
  };

  const handlePlayerDamage = (amount: number, reason: string) => {
    setStats(prev => {
      const newHealth = prev.health - amount;
      if (newHealth <= 0) {
        handleDie(reason);
        return { ...prev, health: 0 };
      }
      return { ...prev, health: newHealth };
    });
  };

  const handleDie = (reason: string) => {
    if (gameState !== GameState.DEAD) {
      setGameState(GameState.DEAD);
      setDeathReason(reason);
      clearSave(); // Wipe save on death (Permadeath mechanic)
    }
  };

  const handleRestart = () => {
    setGameState(GameState.PLAYING);
    setStats(INITIAL_STATS);
    setCollectibles([]);
    setEnemies([]);
    setCacti([]);
    setDeathReason(null);
    setGameKey(prev => prev + 1);
  };

  return (
    <div className="w-screen h-screen bg-black relative">
      {gameState === GameState.MENU && (
        <MainMenu onStart={handleStartGame} initialSettings={settings} />
      )}

      {/* 
        We render the Canvas always in the background for the cool spin effect 
        if we were fancy, but to save performance we can just render stars/terrain 
        or pause physics. For now, we render it but pause updates via "isDead" flag essentially 
        or just let it run if state is PLAYING/DEAD 
      */}
      <Canvas
        key={gameKey}
        shadows
        camera={{ fov: 75, near: 0.1, far: 1000 }}
      >
        <Suspense fallback={null}>
          <fog attach="fog" args={['#111', 50, 180]} />
          <ambientLight intensity={0.4} />
          <hemisphereLight args={['#ffffff', '#444444', 0.2]} />
          <directionalLight
            position={[50, 50, 25]}
            intensity={1.2}
            castShadow
            shadow-mapSize={[2048, 2048]}
            color="#ddeeff"
          >
            <orthographicCamera attach="shadow-camera" args={[-50, 50, 50, -50]} />
          </directionalLight>

          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

          {gameState !== GameState.MENU && (
            <>
              <Player
                onStatsUpdate={handleStatsUpdate}
                onDie={handleDie}
                isDead={gameState === GameState.DEAD}
                initialPosition={stats.position}
                currentStats={stats}
                sensitivity={settings.sensitivity}
              />

              <MeteorSystem
                playerPos={stats.position}
                onMeteorHit={() => handleDie("Meteor Impact")}
                onRegisterMeteors={setActiveMeteors}
                difficultyLevel={stats.level * getDifficultyMultiplier()}
              />

              <CollectiblesManager
                playerPos={stats.position}
                collectibles={collectibles}
                onCollect={handleCollect}
              />

              <EnemiesManager
                playerPos={stats.position}
                enemies={enemies}
                cacti={cacti}
                onPlayerHit={handlePlayerDamage}
                setEnemies={setEnemies}
              />
            </>
          )}

          {/* Render terrain in background even on menu for visuals? Or just simple */}
          <TerrainManager playerPosition={{ x: stats.position.x, z: stats.position.z }} />

        </Suspense>
      </Canvas>

      {(gameState === GameState.PLAYING || gameState === GameState.DEAD) && (
        <HUD
          stats={stats}
          meteors={activeMeteors}
          enemies={enemies}
          gameState={gameState}
          onRestart={handleRestart}
          deathReason={deathReason}
        />
      )}

      {gameState === GameState.PLAYING && stats.xp === 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 text-center pointer-events-none animate-pulse">
          <div className="bg-black/50 backdrop-blur px-6 py-4 rounded-xl border border-white/10">
            <p className="text-cyan-400 font-bold mb-1">MISSION START</p>
            <p className="text-gray-300 text-sm">WASD to Move | SPACE to Jump</p>
            <p className="text-gray-400 text-xs mt-2">
              Avoid <span className="text-red-400">Acid Pools</span> & <span className="text-green-400">Cacti</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
