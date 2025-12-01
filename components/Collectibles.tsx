/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Collectible, CollectibleType } from '../types';

interface CollectiblesManagerProps {
  playerPos: { x: number, y: number, z: number };
  onCollect: (item: Collectible) => void;
  collectibles: Collectible[];
}

export const CollectiblesManager: React.FC<CollectiblesManagerProps> = ({ playerPos, onCollect, collectibles }) => {
  const groupRef = useRef<THREE.Group>(null);
  const geometries = useMemo(() => ({
    [CollectibleType.OXYGEN]: new THREE.IcosahedronGeometry(0.5, 0),
    [CollectibleType.XP]: new THREE.OctahedronGeometry(0.5, 0)
  }), []);

  const materials = useMemo(() => ({
    [CollectibleType.OXYGEN]: new THREE.MeshStandardMaterial({ 
        color: '#00ffff', 
        emissive: '#00aaaa', 
        emissiveIntensity: 2,
        roughness: 0.2
    }),
    [CollectibleType.XP]: new THREE.MeshStandardMaterial({ 
        color: '#ffd700', 
        emissive: '#aa8800', 
        emissiveIntensity: 1.5,
        roughness: 0.1
    })
  }), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    // Animate items
    if (groupRef.current) {
        groupRef.current.children.forEach((child, i) => {
            child.rotation.y = time + i;
            child.position.y += Math.sin(time * 2 + i) * 0.005; // Float
        });
    }

    // Check collision
    for (const item of collectibles) {
        const dx = playerPos.x - item.position[0];
        const dy = playerPos.y - item.position[1];
        const dz = playerPos.z - item.position[2];
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

        if (dist < 2.0) {
            onCollect(item);
        }
    }
  });

  return (
    <group ref={groupRef}>
      {collectibles.map((item) => (
        <mesh 
            key={item.id} 
            position={new THREE.Vector3(...item.position)}
            geometry={geometries[item.type]}
            material={materials[item.type]}
            castShadow
        >
            <pointLight distance={3} intensity={2} color={item.type === CollectibleType.OXYGEN ? '#00ffff' : '#ffd700'} />
        </mesh>
      ))}
    </group>
  );
};