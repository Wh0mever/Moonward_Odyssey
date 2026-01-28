
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, Suspense, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { TerrainManager } from './components/Terrain';
import { TrainingFloor } from './components/TrainingFloor';
import { Player } from './components/Player';
import { MeteorSystem } from './components/Meteors';
import { CollectiblesManager } from './components/Collectibles';
import { EnemiesManager } from './components/Enemies';
import { Rocket } from './components/Rocket';
import HUD from './components/HUD';
import { MainMenu } from './components/MainMenu';
import { GameState, PlayerStats, Meteor, Collectible, CollectibleType, Enemy, EnemyType, Cactus, GameSettings, Difficulty } from './types';
import { getTerrainHeight } from './services/geminiService';
import { soundService } from './services/soundService';
import { saveGame, loadGame, clearSave } from './services/storageService';
import { DamageFeedback } from './components/DamageFeedback';
import { Tutorial } from './components/Tutorial';
import { PauseMenu } from './components/PauseMenu';
import { VictoryScreen } from './components/VictoryScreen';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { OtherPlayers } from './components/OtherPlayers';
import { multiplayerService } from './services/multiplayerService';
import { generateId } from './utils/generateId';

const INITIAL_STATS: PlayerStats = {
  health: 100,
  maxHealth: 100,
  oxygen: 100,
  maxOxygen: 100,
  stamina: 100,
  maxStamina: 100,
  xp: 0,
  level: 1,
  ammo: 50,
  fuel: 0,
  artifacts: 0,
  position: { x: 0, y: 10, z: 0 }
};

const DEFAULT_SETTINGS: GameSettings = {
  difficulty: Difficulty.EASY,
  sensitivity: 1.0,
  sound: true,
  brightness: 1.0
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS);
  const [activeMeteors, setActiveMeteors] = useState<Meteor[]>([]);
  const [collectibles, setCollectibles] = useState<Collectible[]>([]);

  // Enemies State & Ref for Sync Collision
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);

  const [cacti, setCacti] = useState<Cactus[]>([]);
  const [deathReason, setDeathReason] = useState<string | null>(null);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [isEquipped, setIsEquipped] = useState(false);
  const [damageEvents, setDamageEvents] = useState<{ id: string, position: [number, number, number], amount: number, isCritical: boolean }[]>([]);
  const [isHovering, setIsHovering] = useState(false);

  // Timer state
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(3600); // seconds
  const [completionTime, setCompletionTime] = useState<number>(0); // for victory screen

  const lastEntitySpawn = useRef(0);
  const loadedOnce = useRef(false);

  // Load game
  useEffect(() => {
    if (!loadedOnce.current) {
      const saved = loadGame();
      if (saved) {
        const loaded = { ...INITIAL_STATS, ...saved };
        loaded.maxStamina = 100 + (loaded.level - 1) * 10;
        setStats(loaded);
      }
      loadedOnce.current = true;
    }
  }, []);

  // Sync ref with state
  useEffect(() => {
    enemiesRef.current = enemies;
  }, [enemies]);

  const spawnInitialArtifacts = () => {
    // First 4 artifacts at normal distances
    // 5th artifact (WHOMEVER) at EXTREME distance based on difficulty
    const isHardMode = settings.difficulty === Difficulty.HARD || settings.difficulty === Difficulty.SEVERE;
    const fifthArtifactDistance = isHardMode ? 600 : 200;  // 0.6km для HARD/SEVERE, 500m для EASY/NORMAL
    const distances = [15, 30, 50, 60, fifthArtifactDistance];
    const newArtifacts: Collectible[] = [];
    const baseAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI * 1.25];

    distances.forEach((dist, index) => {
      const angle = baseAngles[index] + (Math.random() * 0.5 - 0.25);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      let terrainH = getTerrainHeight(x, z);

      newArtifacts.push({
        id: `init-artifact-${index}`,
        type: CollectibleType.ARTIFACT,
        position: [x, terrainH + 1.0, z],
        value: 1,
        artifactId: index
      });
    });

    setCollectibles(prev => {
      const cleaned = prev.filter(c => c.type !== CollectibleType.ARTIFACT);
      return [...cleaned, ...newArtifacts];
    });
  };

  const handleStartGame = (newSettings: GameSettings, isTutorial = false) => {
    setSettings(newSettings);
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setGameState(isTutorial ? GameState.TUTORIAL : GameState.PLAYING);
      // Start timer for non-tutorial games
      if (!isTutorial) {
        setGameStartTime(Date.now());
        setTimeRemaining(newSettings.difficulty === Difficulty.EASY ? 3600 : 2700);
      }
      // Ensure y is safe for tutorial (flat ground = 0) vs game (terrain)
      setStats(prev => ({ ...prev, position: { x: 0, y: isTutorial ? 1.0 : 1.8, z: 10 } }));
      setEnemies([]);
      enemiesRef.current = [];
      setCollectibles([]);
      if (!isTutorial) {
        spawnInitialArtifacts();
      }
    }, 2000);
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

  const getTimeLimitSeconds = () => {
    return settings.difficulty === Difficulty.EASY ? 3600 : 2700; // 60 min or 45 min
  };

  // Timer update effect
  useEffect(() => {
    if (gameState !== GameState.PLAYING || !gameStartTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
      const remaining = getTimeLimitSeconds() - elapsed;
      setTimeRemaining(Math.max(0, remaining));

      if (remaining <= 0) {
        handleDie("Mission Failed - Time Expired");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, gameStartTime, settings.difficulty]);

  const handleStatsUpdate = (newStats: PlayerStats) => {
    const newLevel = 1 + Math.floor(newStats.xp / 1000);
    const newMaxStamina = 100 + (newLevel - 1) * 10;

    const updatedStats = {
      ...newStats,
      level: newLevel,
      maxStamina: newMaxStamina
    };

    setStats(prev => ({ ...updatedStats }));

    if (gameState === GameState.PLAYING) {
      saveGame(updatedStats);

      // Spawning Logic
      const now = Date.now();
      const spawnRate = 2000 / getDifficultyMultiplier();

      if (now - lastEntitySpawn.current > spawnRate) {
        spawnEntities(newStats.position);
        lastEntitySpawn.current = now;
      }
    }
  };

  const spawnEntities = (playerPos: { x: number, z: number }) => {
    let attempts = 0;
    let spawned = false;

    // Retry loop to find a non-crowded spot
    while (attempts < 15 && !spawned) {
      attempts++;
      // Random 360 degree distribution
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 50;
      const x = playerPos.x + Math.cos(angle) * distance;
      const z = playerPos.z + Math.sin(angle) * distance;
      const terrainH = getTerrainHeight(x, z);
      const y = terrainH + 1.0;

      // COLLISION CHECK using REF for latest data
      const isCrowded = enemiesRef.current.some(e => {
        const dx = e.position[0] - x;
        const dz = e.position[2] - z;
        // Increased check to 10m radius (100 distance squared) to strictly prevent stacking
        return (dx * dx + dz * dz) < 100;
      });

      if (isCrowded) continue; // Try again immediately

      const rand = Math.random();
      const multiplier = getDifficultyMultiplier();

      // 40% Collectibles
      if (rand < 0.4 && collectibles.length < 30) {
        const typeRoll = Math.random();
        let type = CollectibleType.OXYGEN;
        let value = 25;
        let artifactId = undefined;

        if (typeRoll > 0.99) {
          type = CollectibleType.ARTIFACT;
          value = 1;
          artifactId = Math.floor(Math.random() * 4);
        } else if (typeRoll > 0.8) {
          type = CollectibleType.FUEL;
          value = 15;
        } else if (typeRoll > 0.5) {
          type = CollectibleType.XP;
          value = 50;
        }

        setCollectibles(prev => [...prev, {
          id: generateId(),
          type,
          position: [x, type === CollectibleType.FUEL ? y + 0.5 : y, z],
          value,
          artifactId
        }]);
        spawned = true;
      }
      // 30% Enemies - isCrowded already checked 10m radius above
      else if (rand < 0.7 && enemiesRef.current.length < 10 * multiplier) {
        let eType = EnemyType.ZOMBIE;
        if ((settings.difficulty === Difficulty.HARD || settings.difficulty === Difficulty.SEVERE) && Math.random() > 0.6) {
          eType = EnemyType.SPIDER;
        }

        const newEnemy: Enemy = {
          id: generateId(),
          type: eType,
          position: [x, terrainH + 1, z],
          health: eType === EnemyType.SPIDER ? 150 : 100
        };

        // ⚠️ FIX RACE CONDITION: Update ref BEFORE state!
        // This ensures immediate visibility for next spawn check
        enemiesRef.current = [...enemiesRef.current, newEnemy];
        setEnemies(prev => [...prev, newEnemy]);

        // Play scary spawn sound!
        soundService.playEnemySpawn();

        spawned = true;
      }
      // 10% Cacti
      else if (rand < 0.8 && cacti.length < 15) {
        setCacti(prev => [...prev, {
          id: generateId(),
          position: [x, terrainH + 1.5, z]
        }]);
        spawned = true;
      }
    }
  };

  const handleInteract = (targetId?: string) => {
    const p = stats.position;

    // 1. Check Rocket Interaction
    if (targetId === 'ROCKET') {
      const distToRocket = Math.sqrt(p.x * p.x + p.z * p.z);
      if (distToRocket < 15.0) {
        // Require BOTH conditions: fuel at 100 AND all 5 artifacts collected
        if (stats.fuel >= 100 && stats.artifacts >= 5) {
          // Calculate completion time
          const elapsed = gameStartTime ? (Date.now() - gameStartTime) / 1000 : 0;
          setCompletionTime(elapsed);
          document.exitPointerLock();
          setGameState(GameState.VICTORY);
        }
      }
      return;
    }

    // 2. Check Collectibles via ID
    if (targetId) {
      const collected = collectibles.find(c => c.id === targetId);
      if (collected) {
        // Play collect sound
        soundService.playCollect();

        setCollectibles(prev => prev.filter(c => c.id !== collected.id));
        setStats(prev => {
          const next = { ...prev };
          if (collected.type === CollectibleType.OXYGEN) next.oxygen = Math.min(next.oxygen + collected.value, next.maxOxygen);
          else if (collected.type === CollectibleType.XP) next.xp += collected.value;
          else if (collected.type === CollectibleType.AMMO) next.ammo += collected.value;
          else if (collected.type === CollectibleType.FUEL) next.fuel = Math.min(next.fuel + collected.value, 100);
          else if (collected.type === CollectibleType.ARTIFACT) next.artifacts += 1;
          return next;
        });
      }
    }
  };

  const handleShoot = (targetId: string | null, isHeadshot: boolean, hitPoint: THREE.Vector3, isFirstHit: boolean = true) => {
    if (stats.ammo <= 0) return;

    // Only deduct ammo on first hit (penetration fix)
    if (isFirstHit) {
      setStats(prev => ({ ...prev, ammo: prev.ammo - 1 }));
    }

    if (targetId) {
      const damage = isHeadshot ? 100 : 34; // 3 shots body, 1 shot head

      // Play headshot sound for critical hit
      if (isHeadshot) {
        soundService.playHeadshot();
      }

      setDamageEvents(prev => [...prev, {
        id: generateId(),
        position: [hitPoint.x, hitPoint.y + 0.5, hitPoint.z],
        amount: damage,
        isCritical: isHeadshot
      }]);

      setEnemies(prev => {
        const next = prev.map(e => e.id === targetId ? { ...e, health: e.health - damage } : e);
        const dead = next.find(e => e.id === targetId && e.health <= 0);

        if (dead) {
          // Play enemy death sound
          soundService.playEnemyDeath();

          // Update ref immediately to allow spawning in this spot again if needed
          enemiesRef.current = enemiesRef.current.filter(e => e.id !== targetId);

          // AMMO DROP SCALING
          let ammoAmount = 15;
          if (settings.difficulty === Difficulty.MEDIUM) ammoAmount = 12;
          if (settings.difficulty === Difficulty.HARD) ammoAmount = 8;
          if (settings.difficulty === Difficulty.SEVERE) ammoAmount = 5;

          setCollectibles(c => [...c, {
            id: generateId(),
            type: CollectibleType.AMMO,
            position: [dead.position[0], dead.position[1], dead.position[2]],
            value: ammoAmount
          }]);
          return next.filter(e => e.health > 0);
        }
        return next;
      });
    }
  };

  const handleLevelComplete = () => {
    let nextDiff = Difficulty.MEDIUM;
    if (settings.difficulty === Difficulty.MEDIUM) nextDiff = Difficulty.HARD;
    if (settings.difficulty === Difficulty.HARD) nextDiff = Difficulty.SEVERE;
    if (settings.difficulty === Difficulty.SEVERE) nextDiff = Difficulty.SEVERE;

    alert(`MISSION COMPLETE! LAUNCHING TO ${nextDiff} SECTOR...`);

    setSettings(prev => ({ ...prev, difficulty: nextDiff }));
    setStats(prev => ({
      ...prev,
      fuel: 0,
      artifacts: 0,
      position: { x: 0, y: 1.8, z: 10 },
      xp: prev.xp + 2000
    }));
    setCollectibles([]);
    setEnemies([]);
    enemiesRef.current = [];
    setGameKey(k => k + 1);
    spawnInitialArtifacts();
  };

  const handlePlayerDamage = (amount: number, reason: string) => {
    if (gameState === GameState.TUTORIAL) return;

    // Play player hit sound
    soundService.playPlayerHit();

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
      clearSave();
      // Play player death sound
      soundService.playPlayerDeath();
    }
  };

  const handleRestart = () => {
    setGameState(GameState.PLAYING);
    setStats(INITIAL_STATS);
    setCollectibles([]);
    setEnemies([]);
    enemiesRef.current = [];
    setCacti([]);
    setDeathReason(null);
    setGameKey(prev => prev + 1);
    setIsEquipped(false);
    setGameStartTime(Date.now());
    setTimeRemaining(settings.difficulty === Difficulty.EASY ? 3600 : 2700);
    setStats(prev => ({ ...prev, position: { x: 0, y: 1.8, z: 10 } }));
    spawnInitialArtifacts();
  };

  const handleReturnToMenu = () => {
    // Release pointer lock so cursor appears in menu
    document.exitPointerLock();
    setGameState(GameState.MENU);
    setGameKey(p => p + 1);
  }

  // === PAUSE MENU LOGIC ===
  const handlePause = () => {
    if (gameState === GameState.PLAYING || gameState === GameState.TUTORIAL) {
      setGameState(GameState.PAUSED);
      document.exitPointerLock();
    }
  };

  const handleResume = () => {
    setGameState(GameState.PLAYING);
  };

  // ESC key handler for pause - uses pointerlockchange to detect when ESC unlocks pointer
  useEffect(() => {
    const handlePointerLockChange = () => {
      // When pointer lock is released during gameplay, open pause menu
      if (!document.pointerLockElement) {
        if (gameState === GameState.PLAYING || gameState === GameState.TUTORIAL) {
          setGameState(GameState.PAUSED);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (gameState === GameState.PAUSED) {
          handleResume();
        }
      }
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState]);

  const toggleEquip = () => {
    setIsEquipped(prev => !prev);
  }

  return (
    <div className="w-screen h-screen bg-black relative">
      {gameState === GameState.MENU && (
        <MainMenu
          onStart={handleStartGame}
          initialSettings={settings}
          onMultiplayer={() => setGameState(GameState.MULTIPLAYER_LOBBY)}
        />
      )}

      {/* MULTIPLAYER LOBBY */}
      {gameState === GameState.MULTIPLAYER_LOBBY && (
        <MultiplayerLobby
          onBack={() => setGameState(GameState.MENU)}
          onGameStart={() => {
            // Start multiplayer game
            setGameState(GameState.MULTIPLAYER_PLAYING);
            spawnInitialArtifacts();
            setGameStartTime(Date.now());
          }}
          serverUrl="http://localhost:4001"
        />
      )}

      {isGenerating && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <h2 className="text-4xl font-bold text-cyan-400 animate-pulse mb-4">GENERATING SECTOR...</h2>
        </div>
      )}

      {/* TUTORIAL UI OVERLAY */}
      {gameState === GameState.TUTORIAL && (
        <Tutorial
          stats={stats}
          setCollectibles={setCollectibles}
          setEnemies={setEnemies}
          collectibles={collectibles}
          enemies={enemies}
          isEquipped={isEquipped}
          onReturnToMenu={handleReturnToMenu}
        />
      )}

      <Canvas
        shadows
        camera={{ fov: 75, near: 0.1, far: 1000 }}
      >
        <Suspense fallback={null}>
          <fog attach="fog" args={['#050505', 50, 200]} />
          <ambientLight intensity={0.1 + (settings.brightness * 0.5)} />
          <hemisphereLight args={['#ffffff', '#444444', 0.1 + (settings.brightness * 0.3)]} />
          <directionalLight
            position={[50, 50, 25]}
            intensity={0.8 + settings.brightness}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

          <group key={gameKey}>
            {gameState !== GameState.MENU && !isGenerating && (
              <>
                {gameState !== GameState.TUTORIAL && <Rocket stats={stats} />}

                <DamageFeedback events={damageEvents} onRemove={(id) => setDamageEvents(p => p.filter(e => e.id !== id))} />

                <Player
                  currentStats={stats}
                  onStatsUpdate={handleStatsUpdate}
                  onDie={handleDie}
                  onShoot={handleShoot}
                  onInteract={handleInteract}
                  onToggleEquip={toggleEquip}
                  onHover={setIsHovering}
                  isEquipped={isEquipped}
                  isDead={gameState === GameState.DEAD}
                  initialPosition={stats.position}
                  sensitivity={settings.sensitivity}
                  isTutorial={gameState === GameState.TUTORIAL}
                />

                {gameState !== GameState.TUTORIAL && (
                  <MeteorSystem
                    playerPos={stats.position}
                    onMeteorHit={() => handleDie("Meteor Impact")}
                    onRegisterMeteors={setActiveMeteors}
                    difficultyLevel={settings.difficulty === Difficulty.SEVERE ? 4 : settings.difficulty === Difficulty.HARD ? 3 : settings.difficulty === Difficulty.MEDIUM ? 2 : 1}
                  />
                )}

                <CollectiblesManager
                  playerPos={stats.position}
                  collectibles={collectibles}
                  onCollect={() => { }}
                />

                <EnemiesManager
                  playerPos={stats.position}
                  enemies={enemies}
                  cacti={cacti}
                  onPlayerHit={handlePlayerDamage}
                  setEnemies={setEnemies}
                  isTutorial={gameState === GameState.TUTORIAL}
                />
              </>
            )}

            {/* Swappable Environment */}
            {gameState === GameState.TUTORIAL ? (
              <TrainingFloor />
            ) : (
              <TerrainManager playerPosition={{ x: stats.position.x, z: stats.position.z }} />
            )}

          </group>
        </Suspense>
      </Canvas>

      {(gameState === GameState.PLAYING || gameState === GameState.DEAD || gameState === GameState.PAUSED) && !isGenerating && (
        <HUD
          stats={stats}
          meteors={activeMeteors}
          collectibles={collectibles}
          enemies={enemies}
          gameState={gameState}
          onRestart={handleRestart}
          deathReason={deathReason}
          isEquipped={isEquipped}
          isHovering={isHovering}
          timeRemaining={timeRemaining}
        />
      )}

      {/* === PAUSE MENU === */}
      {gameState === GameState.PAUSED && (
        <PauseMenu
          onResume={handleResume}
          onMainMenu={handleReturnToMenu}
          settings={settings}
          onSettingsChange={setSettings}
        />
      )}

      {/* === VICTORY SCREEN === */}
      {gameState === GameState.VICTORY && (
        <VictoryScreen
          completionTime={completionTime}
          onReturnToMenu={handleReturnToMenu}
        />
      )}
    </div>
  );
};

export default App;
