
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Meteor, MeteorState } from '../types';
import { getTerrainHeight } from '../services/geminiService';
import { generateId } from '../utils/generateId';

interface MeteorSystemProps {
  playerPos: { x: number, y: number, z: number };
  onMeteorHit: () => void;
  onRegisterMeteors: (meteors: Meteor[]) => void;
  difficultyLevel: number;
}

export const MeteorSystem: React.FC<MeteorSystemProps> = ({ playerPos, onMeteorHit, onRegisterMeteors, difficultyLevel }) => {
  const meteors = useRef<Meteor[]>([]);

  // Mesh for the physical falling meteor
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Mesh for the warning marker on the ground
  const warningRef = useRef<THREE.InstancedMesh>(null);

  const lastSpawn = useRef(0);

  // Meteor Visuals
  const geometry = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ff4400',
    emissive: '#aa2200',
    emissiveIntensity: 2,
    roughness: 0.4
  }), []);

  // Warning Visuals
  const warningGeo = useMemo(() => new THREE.RingGeometry(0.1, 1, 32), []);
  const warningMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ff0000',
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide
  }), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const now = Date.now();

    // Spawn Logic
    // High difficulty = fast spawns. Low difficulty = slow spawns.
    const spawnRate = Math.max(1000, 5000 - (difficultyLevel * 800));

    if (now - lastSpawn.current > spawnRate) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * (40 - difficultyLevel * 2); // Closer on hard difficulty
      const spawnX = playerPos.x + Math.cos(angle) * dist;
      const spawnZ = playerPos.z + Math.sin(angle) * dist;

      // Calculate delay based on difficulty
      // Easy: 8s delay. Severe: 3s delay.
      const warningDelay = Math.max(3000, 10000 - (difficultyLevel * 1500));

      const terrainH = getTerrainHeight(spawnX, spawnZ);

      meteors.current.push({
        id: generateId(),
        position: [spawnX, terrainH + 100, spawnZ], // Start high up
        targetPos: { x: spawnX, z: spawnZ },
        velocity: [0, -40, 0], // Fast drop
        radius: 2 + (difficultyLevel * 0.5), // Bigger on hard difficulty
        state: MeteorState.TARGETING,
        impactTime: now + warningDelay
      });
      lastSpawn.current = now;
    }

    // Process Meteors
    for (let i = meteors.current.length - 1; i >= 0; i--) {
      const m = meteors.current[i];

      // PHASE 1: TARGETING
      if (m.state === MeteorState.TARGETING) {
        if (now >= m.impactTime) {
          m.state = MeteorState.FALLING;
          // Check immediate damage if player is standing on marker when it spawns
          const dx = m.targetPos.x - playerPos.x;
          const dz = m.targetPos.z - playerPos.z;
          if (Math.sqrt(dx * dx + dz * dz) < m.radius) {
            onMeteorHit();
          }
        }
      }
      // PHASE 2: FALLING
      else if (m.state === MeteorState.FALLING) {
        const dt = 0.016;
        m.position[1] += m.velocity[1] * dt;

        const terrainH = getTerrainHeight(m.position[0], m.position[2]);

        // Impact Check
        if (m.position[1] < terrainH) {
          // Explosion/Damage check
          const dx = m.position[0] - playerPos.x;
          const dz = m.position[2] - playerPos.z;
          if (Math.sqrt(dx * dx + dz * dz) < m.radius * 2) { // Splash damage radius
            onMeteorHit();
          }
          meteors.current.splice(i, 1);
          continue;
        }
      }
    }

    if (meteors.current.length > 50) meteors.current.shift();
    onRegisterMeteors(meteors.current);

    // Update Instanced Meshes
    if (meshRef.current && warningRef.current) {

      let fallingCount = 0;
      let targetingCount = 0;

      meteors.current.forEach((m) => {
        if (m.state === MeteorState.FALLING) fallingCount++;
        else targetingCount++;
      });

      meshRef.current.count = fallingCount;
      warningRef.current.count = targetingCount;

      let fIdx = 0;
      let tIdx = 0;

      meteors.current.forEach((m) => {
        if (m.state === MeteorState.FALLING) {
          dummy.position.set(m.position[0], m.position[1], m.position[2]);
          dummy.scale.set(m.radius, m.radius, m.radius);
          dummy.rotation.set(time, time, time);
          dummy.updateMatrix();
          meshRef.current!.setMatrixAt(fIdx++, dummy.matrix);
        } else {
          // Draw Warning Ring on Ground
          const terrainH = getTerrainHeight(m.targetPos.x, m.targetPos.z);
          dummy.position.set(m.targetPos.x, terrainH + 0.2, m.targetPos.z);
          // Scale ring based on time remaining (pulse effect)
          const timeLeft = Math.max(0, m.impactTime - now);
          const pulse = 1 + (Math.sin(time * 10) * 0.1);
          dummy.scale.set(m.radius * pulse, m.radius * pulse, 1);
          dummy.rotation.set(-Math.PI / 2, 0, 0); // Flat on ground
          dummy.updateMatrix();
          warningRef.current!.setMatrixAt(tIdx++, dummy.matrix);
        }
      });

      meshRef.current.instanceMatrix.needsUpdate = true;
      warningRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[geometry, material, 50]} castShadow />
      <instancedMesh ref={warningRef} args={[warningGeo, warningMat, 50]} />
    </group>
  );
};
