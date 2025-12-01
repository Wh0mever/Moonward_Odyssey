
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { PointerLockControls } from '@react-three/drei';
import { getTerrainHeight, isDangerZone } from '../services/geminiService';
import { PlayerStats } from '../types';

interface PlayerProps {
  onStatsUpdate: (stats: PlayerStats) => void;
  onDie: (reason: string) => void;
  isDead: boolean;
  initialPosition?: { x: number, y: number, z: number };
  currentStats: PlayerStats; // Add this prop
  sensitivity?: number;
}

// Physics Constants - BUFFED SPEED
const MOVE_ACCEL = 60.0; // Increased acceleration
const MAX_SPEED = 16.0;  // Increased max speed (approx +30%)
const FRICTION = 5.0;
const AIR_RESISTANCE = 0.5;
const JUMP_FORCE = 12;   // Slightly higher jump to match speed
const GRAVITY = 4.0;
const OXYGEN_DEPLETION_RATE = 1.5; // Slightly easier oxygen
const ACID_LEVEL = -12; // Height of acid liquid

export const Player: React.FC<PlayerProps> = ({ onStatsUpdate, onDie, isDead, initialPosition, currentStats, sensitivity = 1.0 }) => {
  const { camera } = useThree();
  const position = useRef(new Vector3(0, 20, 0));
  const velocity = useRef(new Vector3(0, 0, 0));
  const isGrounded = useRef(false);
  const keys = useRef<{ [key: string]: boolean }>({});

  // Initialize from save if available
  useEffect(() => {
    if (initialPosition) {
      position.current.set(initialPosition.x, initialPosition.y + 2, initialPosition.z);
      camera.position.copy(position.current);
    }
  }, [initialPosition, camera]);

  // Initialize stats from props (loading save correctly)
  const stats = useRef<PlayerStats>({ ...currentStats });

  // Sync stats ref with props to ensure level calculation uses saved data initially
  // AND to handle external updates (like collecting items)
  useEffect(() => {
    // If external stats (from App) have higher values (e.g. gained oxygen/xp), sync local ref
    if (currentStats.oxygen > stats.current.oxygen) {
      stats.current.oxygen = currentStats.oxygen;
    }
    if (currentStats.xp > stats.current.xp) {
      stats.current.xp = currentStats.xp;
    }
    if (currentStats.level > stats.current.level) {
      stats.current.level = currentStats.level;
      stats.current.maxOxygen = currentStats.maxOxygen;
      stats.current.maxHealth = currentStats.maxHealth;
    }
    // Always sync position from physics, so don't overwrite it from props unless it's a teleport (not handled here)
  }, [currentStats]);

  const lastUpdate = useRef(Date.now());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const handleKeyUp = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    if (isDead) return;

    const time = Date.now();
    const dt = Math.min(delta, 0.1);

    // --- Stats Logic ---
    if (time - lastUpdate.current > 1000) {
      stats.current.oxygen -= OXYGEN_DEPLETION_RATE;

      // Level Up Logic
      const xpNeeded = stats.current.level * 500;
      if (stats.current.xp >= xpNeeded) {
        stats.current.level++;
        stats.current.xp -= xpNeeded;
        stats.current.maxOxygen += 10;
        stats.current.health = Math.min(stats.current.health + 20, stats.current.maxHealth);
        stats.current.oxygen = stats.current.maxOxygen;
      }

      // Death Checks
      if (stats.current.oxygen <= 0) {
        onDie("Asphyxiation (Oxygen Depleted)");
      }

      onStatsUpdate({ ...stats.current });
      lastUpdate.current = time;
    }

    // --- Physics & Movement ---
    const frontVector = new Vector3(
      0,
      0,
      Number(keys.current['KeyS'] || 0) - Number(keys.current['KeyW'] || 0)
    );
    const sideVector = new Vector3(
      Number(keys.current['KeyA'] || 0) - Number(keys.current['KeyD'] || 0),
      0,
      0
    );
    const direction = new Vector3().subVectors(frontVector, sideVector).normalize();

    const camDir = new Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    camDir.normalize();
    const camRight = new Vector3().crossVectors(camera.up, camDir).normalize();

    const moveForce = new Vector3()
      .addScaledVector(camRight, sideVector.x)
      .addScaledVector(camDir, -frontVector.z)
      .normalize();

    if (isGrounded.current) {
      velocity.current.x += moveForce.x * MOVE_ACCEL * dt;
      velocity.current.z += moveForce.z * MOVE_ACCEL * dt;

      // Cap horizontal speed
      const hSpeed = Math.sqrt(velocity.current.x ** 2 + velocity.current.z ** 2);
      if (hSpeed > MAX_SPEED) {
        const ratio = MAX_SPEED / hSpeed;
        velocity.current.x *= ratio;
        velocity.current.z *= ratio;
      }

      velocity.current.x -= velocity.current.x * FRICTION * dt;
      velocity.current.z -= velocity.current.z * FRICTION * dt;

      if (keys.current['Space']) {
        velocity.current.y = JUMP_FORCE;
        isGrounded.current = false;
      }
    } else {
      velocity.current.x += moveForce.x * (MOVE_ACCEL * 0.2) * dt;
      velocity.current.z += moveForce.z * (MOVE_ACCEL * 0.2) * dt;
      velocity.current.x -= velocity.current.x * AIR_RESISTANCE * dt;
      velocity.current.z -= velocity.current.z * AIR_RESISTANCE * dt;
    }

    velocity.current.y -= GRAVITY * dt;

    position.current.x += velocity.current.x * dt;
    position.current.z += velocity.current.z * dt;
    position.current.y += velocity.current.y * dt;

    // --- Collision ---
    const terrainHeight = getTerrainHeight(position.current.x, position.current.z);
    const playerHeight = 1.8;

    // Acid Pit Check
    if (position.current.y < ACID_LEVEL + 1) { // Tolerance
      onDie("Dissolved in Acid Pool");
      return;
    }

    // Void Check (Backup)
    if (isDangerZone(terrainHeight, position.current.x, position.current.z)) {
      if (position.current.y < terrainHeight - 15) {
        onDie("Fell into the Void");
        return;
      }
    }

    if (position.current.y < terrainHeight + playerHeight) {
      position.current.y = terrainHeight + playerHeight;
      velocity.current.y = Math.max(0, velocity.current.y);
      isGrounded.current = true;
    } else {
      isGrounded.current = false;
    }

    camera.position.copy(position.current);

    // Update internal ref so stats update works correctly
    stats.current.position = { x: position.current.x, y: position.current.y, z: position.current.z };
  });

  /* 
     PointerLockControls doesn't inherently expose "sensitivity" cleanly via props in standard drei without custom implementation 
     or editing the camera property in useFrame. However, we can approximate user intent by adjusting moving speed
     or letting standard browser pointer speed handle it. 
     For a true sensitivity slider, we'd wrap the camera rotation logic manually, but for this demo, 
     we will just pass the prop to placeholder.
  */

  return (
    <>
      <PointerLockControls />
      <group position={camera.position} rotation={camera.rotation}>
        <spotLight
          position={[0.2, -0.2, 0]}
          intensity={3}
          angle={0.6}
          penumbra={0.5}
          distance={60}
          color="#ffffdd"
          castShadow
        />
      </group>
    </>
  );
};
