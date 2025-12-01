
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Meteor } from '../types';

interface MeteorSystemProps {
  playerPos: { x: number, y: number, z: number };
  onMeteorHit: () => void;
  onRegisterMeteors: (meteors: Meteor[]) => void;
  difficultyLevel: number;
}

export const MeteorSystem: React.FC<MeteorSystemProps> = ({ playerPos, onMeteorHit, onRegisterMeteors, difficultyLevel }) => {
  const meteors = useRef<Meteor[]>([]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lastSpawn = useRef(0);

  const geometry = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ff4400',
    emissive: '#aa2200',
    emissiveIntensity: 2,
    roughness: 0.4
  }), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const now = Date.now();

    // Spawn Logic - Increased frequency
    // Base 2000ms, reduces by 100ms per level, min 200ms
    const spawnRate = Math.max(200, 2000 - (difficultyLevel * 100));

    if (now - lastSpawn.current > spawnRate) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 25; // Closer range (5-30m)
      const spawnX = playerPos.x + Math.cos(angle) * dist;
      const spawnZ = playerPos.z + Math.sin(angle) * dist;

      // Difficulty Scaling
      // Warning time: 3s (Easy) -> 1s (Severe)
      // Size: Small (Easy) -> Large (Severe)
      const warningDuration = Math.max(1000, 3000 - (difficultyLevel * 200));
      const sizeMultiplier = 0.5 + Math.min(2.5, difficultyLevel * 0.2);

      meteors.current.push({
        id: Math.random().toString(),
        position: [spawnX, playerPos.y + 60, spawnZ],
        velocity: [
          (Math.random() - 0.5) * 5,
          -20 - (Math.random() * 15), // Faster falling
          (Math.random() - 0.5) * 5
        ],
        radius: (0.5 + Math.random() * 1.5) * sizeMultiplier,
        warningTime: now,
        impactTime: now + warningDuration,
        isFalling: false
      });
      lastSpawn.current = now;
    }

    // Update Meteors
    for (let i = meteors.current.length - 1; i >= 0; i--) {
      const m = meteors.current[i];
      const dt = 0.016;

      // Check if warning phase is over
      if (!m.isFalling) {
        if (now >= m.impactTime) {
          m.isFalling = true;
        } else {
          // Still in warning phase, don't move
          continue;
        }
      }

      // Falling Physics
      m.position[0] += m.velocity[0] * dt;
      m.position[1] += m.velocity[1] * dt;
      m.position[2] += m.velocity[2] * dt;

      if (m.position[1] < -15) {
        meteors.current.splice(i, 1);
        continue;
      }

      const dx = m.position[0] - playerPos.x;
      const dy = m.position[1] - playerPos.y;
      const dz = m.position[2] - playerPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < m.radius + 2) {
        onMeteorHit();
      }
    }

    if (meshRef.current) {
      if (meteors.current.length > 80) meteors.current.shift();

      onRegisterMeteors(meteors.current);

      // Only render FALLING meteors in the 3D world (warnings are on HUD)
      // Or we could render a transparent "ghost" or target marker in 3D too?
      // For now, let's just render falling ones to keep it clean, or maybe render them high up?
      // Actually, let's render them high up if they are not falling yet, so they "appear" when they start falling
      // OR we can just hide them by scaling to 0 if !isFalling

      meshRef.current.count = meteors.current.length;
      meteors.current.forEach((meteor, i) => {
        if (!meteor.isFalling) {
          dummy.scale.set(0, 0, 0); // Hide until falling
        } else {
          dummy.position.set(meteor.position[0], meteor.position[1], meteor.position[2]);
          dummy.scale.set(meteor.radius, meteor.radius, meteor.radius);
          dummy.rotation.x = time * 4 + i;
          dummy.rotation.y = time * 4 + i;
        }
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, 100]} castShadow />
  );
};
