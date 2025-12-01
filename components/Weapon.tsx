
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WeaponProps {
  isShooting: boolean;
  isEquipped: boolean;
  laserTarget?: THREE.Vector3 | null;
}

export const Weapon: React.FC<WeaponProps> = ({ isShooting, isEquipped, laserTarget }) => {
  const groupRef = useRef<THREE.Group>(null);
  const recoilOffset = useRef(0);
  const flashOpacity = useRef(0);
  const equipOffset = useRef(1.0); // 0 = equipped, 1 = unequipped (lowered)

  useEffect(() => {
    if (isShooting && isEquipped) {
      recoilOffset.current = 0.2;
      flashOpacity.current = 1.0;
    }
  }, [isShooting, isEquipped]);

  useFrame((state, delta) => {
    // Recoil recovery
    recoilOffset.current = THREE.MathUtils.lerp(recoilOffset.current, 0, delta * 15);
    flashOpacity.current = THREE.MathUtils.lerp(flashOpacity.current, 0, delta * 25);

    // Equip Animation
    const targetEquip = isEquipped ? 0 : 1.0;
    equipOffset.current = THREE.MathUtils.lerp(equipOffset.current, targetEquip, delta * 8);

    if (groupRef.current) {
      // VISIBILITY FIX:
      // X: 0.3 (Right side)
      // Y: -0.25 (Standard height) minus equip offset (slides down when unequipped)
      // Z: -0.5 (In front of camera, but not too far to get clipped)
      groupRef.current.position.set(0.3, -0.25 - (equipOffset.current * 0.6), -0.5 + recoilOffset.current);
      
      // Rotation: Slight inward aim for natural feel
      groupRef.current.rotation.set(
          (recoilOffset.current * 0.5) + (equipOffset.current * 0.5), 
          0.05, 
          0
      );
    }
  });

  // Laser Beam Visual
  const laserElement = useMemo(() => {
     return (
        <mesh position={[0, 0.05, -25]} rotation={[Math.PI/2, 0, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 50]} />
            <meshBasicMaterial color="cyan" transparent opacity={0.6} />
        </mesh>
     );
  }, []);

  return (
    <group ref={groupRef} scale={1.5}> {/* SCALED UP 1.5x for visibility */}
      {/* Internal Lighting to ensure weapon is always lit */}
      <pointLight position={[0, 0.5, 0]} intensity={3} distance={2} color="#ffffff" />
      <ambientLight intensity={2} />

      {isShooting && laserElement}

      {/* --- M4A4 MODEL --- */}

      {/* Main Receiver */}
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[0.08, 0.12, 0.4]} />
        <meshStandardMaterial color="#555" roughness={0.3} metalness={0.6} />
      </mesh>
      
      {/* Stock */}
      <mesh position={[0, -0.05, 0.25]}>
         <boxGeometry args={[0.06, 0.15, 0.3]} />
         <meshStandardMaterial color="#222" roughness={0.8} />
      </mesh>

      {/* Pistol Grip */}
      <mesh position={[0, -0.15, 0.0]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.05, 0.2, 0.08]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      
      {/* Handguard / Rails */}
      <mesh position={[0, 0, -0.4]}>
          <boxGeometry args={[0.06, 0.08, 0.4]} />
          <meshStandardMaterial color="#333" />
      </mesh>

      {/* Barrel */}
      <mesh position={[0, 0.02, -0.65]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.15]} />
        <meshStandardMaterial color="#111" metalness={0.8} />
      </mesh>

      {/* Magazine */}
      <mesh position={[0, -0.2, -0.1]} rotation={[0.1, 0, 0]}>
        <boxGeometry args={[0.055, 0.25, 0.12]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Optical Sight */}
      <mesh position={[0, 0.08, -0.1]}>
        <boxGeometry args={[0.06, 0.06, 0.1]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, 0.08, -0.15]}>
        <planeGeometry args={[0.04, 0.04]} />
        <meshBasicMaterial color="#00ff00" transparent opacity={0.8} />
      </mesh>

      {/* Muzzle Flash */}
      <mesh position={[0, 0.02, -0.75]}>
        <planeGeometry args={[0.4, 0.4]} />
        <meshBasicMaterial 
          color="#fff7cc" 
          transparent 
          opacity={flashOpacity.current} 
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};
