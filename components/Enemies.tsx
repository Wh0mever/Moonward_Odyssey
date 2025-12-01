
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Enemy, EnemyType, Cactus } from '../types';
import { getTerrainHeight } from '../services/geminiService';

interface EnemiesManagerProps {
  playerPos: { x: number, y: number, z: number };
  onPlayerHit: (damage: number, reason: string) => void;
  enemies: Enemy[];
  cacti: Cactus[];
  setEnemies: React.Dispatch<React.SetStateAction<Enemy[]>>;
}

export const EnemiesManager: React.FC<EnemiesManagerProps> = ({ playerPos, onPlayerHit, enemies, cacti, setEnemies }) => {
  const lastDamageTime = useRef(0);

  // GLB Placeholder: Cacti
  const cactusGeo = useMemo(() => new THREE.ConeGeometry(0.5, 3, 6), []);
  const cactusMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f6a31', roughness: 0.8 }), []);

  // GLB Placeholder: Zombies
  const zombieGeo = useMemo(() => new THREE.CapsuleGeometry(0.6, 1.8, 4, 8), []);
  const zombieMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6a0dad', emissive: '#330044', roughness: 0.5 }), []);

  useFrame((state, delta) => {
    const time = Date.now();
    const newEnemies = [...enemies];
    let enemiesChanged = false;

    // --- Zombie Logic ---
    newEnemies.forEach((enemy, index) => {
      const dx = playerPos.x - enemy.position[0];
      const dy = playerPos.y - enemy.position[1];
      const dz = playerPos.z - enemy.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Movement (Chase Player)
      const speed = 4.0 * delta;
      if (dist > 1.5 && dist < 50) { // Only chase if visible and not touching
        enemy.position[0] += (dx / dist) * speed;
        enemy.position[2] += (dz / dist) * speed;

        // Snap to terrain
        const terrainH = getTerrainHeight(enemy.position[0], enemy.position[2]);
        enemy.position[1] = terrainH + 0.9; // Half height
        enemiesChanged = true;
      }

      // Attack
      if (dist < 1.8) {
        if (time - lastDamageTime.current > 1000) {
          onPlayerHit(15, "Alien Mauling");
          lastDamageTime.current = time;
        }
      }
    });

    if (enemiesChanged) {
      setEnemies(newEnemies);
    }

    // --- Cacti Logic ---
    cacti.forEach(cactus => {
      const dx = playerPos.x - cactus.position[0];
      const dz = playerPos.z - cactus.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 1.5) {
        if (time - lastDamageTime.current > 1000) {
          onPlayerHit(15, "Pricked by Space Cactus");
          lastDamageTime.current = time;
        }
      }
    });
  });

  return (
    <group>
      {/* Render Cacti */}
      {cacti.map(c => (
        <mesh
          key={c.id}
          position={new THREE.Vector3(...c.position)}
          geometry={cactusGeo}
          material={cactusMat}
          castShadow
          receiveShadow
        >
          {/* FUTURE: <ModelLoader url="/cactus.glb" /> */}
        </mesh>
      ))}

      {/* Render Zombies */}
      {enemies.map(e => (
        <group key={e.id} position={new THREE.Vector3(...e.position)}>
          <mesh geometry={zombieGeo} material={zombieMat} castShadow receiveShadow>
            {/* FUTURE: <ModelLoader url="/zombie.glb" /> */}
          </mesh>
          {/* Eyes */}
          <mesh position={[0.2, 0.5, 0.4]} scale={0.15}>
            <sphereGeometry />
            <meshBasicMaterial color="red" />
          </mesh>
          <mesh position={[-0.2, 0.5, 0.4]} scale={0.15}>
            <sphereGeometry />
            <meshBasicMaterial color="red" />
          </mesh>
        </group>
      ))}
    </group>
  );
};
