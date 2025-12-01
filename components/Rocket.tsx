
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { PlayerStats } from '../types';

interface RocketProps {
  stats: PlayerStats;
}

export const Rocket: React.FC<RocketProps> = ({ stats }) => {
  const group = useRef<THREE.Group>(null);
  
  // Procedural Rocket Mesh
  const bodyGeo = useMemo(() => new THREE.CylinderGeometry(2, 3, 15, 8), []);
  const noseGeo = useMemo(() => new THREE.ConeGeometry(2, 5, 8), []);
  const finGeo = useMemo(() => new THREE.BoxGeometry(1, 4, 4), []);
  
  const metalMat = useMemo(() => new THREE.MeshStandardMaterial({ 
      color: '#eeeeee', 
      roughness: 0.2, 
      metalness: 0.8 
  }), []);
  
  const glowMat = useMemo(() => new THREE.MeshStandardMaterial({ 
      color: '#00ffff', 
      emissive: '#00ffff',
      emissiveIntensity: 0.5 
  }), []);

  useFrame((state) => {
      // Stationary rocket, slight ambient float effect removed for solid ground feel
      // or kept very subtle if desired.
  });

  const canLaunch = stats.fuel >= 100 || stats.artifacts >= 4;

  return (
    <group ref={group} position={[0, 7.5, 0]}>
      {/* Body with interaction data */}
      <mesh 
        geometry={bodyGeo} 
        material={metalMat} 
        castShadow 
        userData={{ id: 'ROCKET', interactable: true }}
      />
      
      {/* Nose */}
      <mesh position={[0, 10, 0]} geometry={noseGeo} material={metalMat} />
      
      {/* Fins */}
      <mesh position={[2, -5, 0]} geometry={finGeo} material={glowMat} />
      <mesh position={[-2, -5, 0]} geometry={finGeo} material={glowMat} />
      <mesh position={[0, -5, 2]} geometry={finGeo} material={glowMat} rotation={[0, Math.PI/2, 0]} />
      <mesh position={[0, -5, -2]} geometry={finGeo} material={glowMat} rotation={[0, Math.PI/2, 0]} />

      {/* Info Display */}
      <group position={[0, 5, 4]}>
         <Text 
            color={canLaunch ? "#00ff00" : "#ffffff"} 
            fontSize={0.8} 
            anchorX="center" 
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#000000"
         >
            {canLaunch ? "READY FOR LAUNCH" : "AWAITING RESOURCES"}
         </Text>
         <Text 
            position={[0, -1, 0]}
            color="#aa00ff" 
            fontSize={0.5} 
            anchorX="center" 
            anchorY="middle"
         >
            FUEL: {Math.floor(stats.fuel)} / 100
         </Text>
         <Text 
            position={[0, -1.6, 0]}
            color="#00ffff" 
            fontSize={0.5} 
            anchorX="center" 
            anchorY="middle"
         >
            ARTIFACTS: {stats.artifacts} / 4
         </Text>
         
         <Text 
            position={[0, -3, 0]}
            color="#cccccc" 
            fontSize={0.3} 
            anchorX="center" 
            anchorY="middle"
         >
            [ LOOK & PRESS E TO INTERACT ]
         </Text>
      </group>
      
      {/* Launch Pad Light */}
      <pointLight position={[0, -5, 0]} color="#00ffff" distance={20} intensity={2} />
    </group>
  );
};
