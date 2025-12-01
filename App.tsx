
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
import { saveGame, loadGame, clearSave } from './services/storageService';
import { DamageFeedback } from './components/DamageFeedback';
import { Tutorial } from './components/Tutorial';

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
  brightness: 0.5
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
  const [damageEvents, setDamageEvents] = useState<{id: string, position: [number, number, number], amount: number, isCritical: boolean}[]>([]);
  const [isHovering, setIsHovering] = useState(false);

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
      // Precise Distances: 15m, 30m, 50m, 60m
      const distances = [15, 30, 50, 60];
      const newArtifacts: Collectible[] = [];
      const baseAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];

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
        // Ensure y is safe for tutorial (flat ground = 0) vs game (terrain)
        setStats(prev => ({...prev, position: {x:0, y: isTutorial ? 1.0 : 1.8, z:10}}));
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

  const spawnEntities = (playerPos: {x:number, z:number}) => {
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
             return (dx*dx + dz*dz) < 100; 
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
                id: Math.random().toString(),
                type,
                position: [x, type === CollectibleType.FUEL ? y + 0.5 : y, z],
                value,
                artifactId
            }]);
            spawned = true;
         } 
         // 30% Enemies
         else if (rand < 0.7 && enemiesRef.current.length < 10 * multiplier) {
             let eType = EnemyType.ZOMBIE;
             if ((settings.difficulty === Difficulty.HARD || settings.difficulty === Difficulty.SEVERE) && Math.random() > 0.6) {
                 eType = EnemyType.SPIDER;
             }
             
             const newEnemy: Enemy = {
                 id: Math.random().toString(),
                 type: eType,
                 position: [x, terrainH + 1, z],
                 health: eType === EnemyType.SPIDER ? 150 : 100 
             };

             // Update both state and ref
             setEnemies(prev => [...prev, newEnemy]);
             enemiesRef.current.push(newEnemy); 
             spawned = true;
         }
         // 10% Cacti
         else if (rand < 0.8 && cacti.length < 15) {
             setCacti(prev => [...prev, {
                 id: Math.random().toString(),
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
        const distToRocket = Math.sqrt(p.x*p.x + p.z*p.z);
        if (distToRocket < 15.0) { 
            if (stats.fuel >= 100 || stats.artifacts >= 4) {
                handleLevelComplete();
            }
        }
        return;
      }

      // 2. Check Collectibles via ID
      if (targetId) {
          const collected = collectibles.find(c => c.id === targetId);
          if (collected) {
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

  const handleShoot = (targetId: string | null, isHeadshot: boolean, hitPoint: THREE.Vector3) => {
      if (stats.ammo <= 0) return;
      
      setStats(prev => ({ ...prev, ammo: prev.ammo - 1 }));

      if (targetId) {
          const damage = isHeadshot ? 100 : 34; // 3 shots body, 1 shot head
          
          setDamageEvents(prev => [...prev, {
              id: Math.random().toString(),
              position: [hitPoint.x, hitPoint.y + 0.5, hitPoint.z],
              amount: damage,
              isCritical: isHeadshot
          }]);

          setEnemies(prev => {
              const next = prev.map(e => e.id === targetId ? { ...e, health: e.health - damage } : e);
              const dead = next.find(e => e.id === targetId && e.health <= 0);
              
              if (dead) {
                  // Update ref immediately to allow spawning in this spot again if needed
                  enemiesRef.current = enemiesRef.current.filter(e => e.id !== targetId);

                  // AMMO DROP SCALING
                  let ammoAmount = 15;
                  if (settings.difficulty === Difficulty.MEDIUM) ammoAmount = 12;
                  if (settings.difficulty === Difficulty.HARD) ammoAmount = 8;
                  if (settings.difficulty === Difficulty.SEVERE) ammoAmount = 5;

                  setCollectibles(c => [...c, {
                      id: Math.random().toString(),
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
    setStats(prev => ({...prev, position: {x:0, y: 1.8, z:10}}));
    spawnInitialArtifacts();
  };

  const handleReturnToMenu = () => {
      setGameState(GameState.MENU);
      setGameKey(p => p + 1);
  }

  const toggleEquip = () => {
      setIsEquipped(prev => !prev);
  }

  return (
    <div className="w-screen h-screen bg-black relative">
      {gameState === GameState.MENU && (
        <MainMenu onStart={handleStartGame} initialSettings={settings} />
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
                    onCollect={() => {}} 
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

      {(gameState === GameState.PLAYING || gameState === GameState.DEAD) && !isGenerating && (
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
        />
      )}
    </div>
  );
};

export default App;
