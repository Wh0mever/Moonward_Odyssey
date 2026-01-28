/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface WeaponProps {
  isShooting: boolean;
  isEquipped: boolean;
  laserTarget?: THREE.Vector3 | null;
}

export const Weapon: React.FC<WeaponProps> = ({ isShooting, isEquipped, laserTarget }) => {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const recoilOffset = useRef(0);
  const [showFlash, setShowFlash] = useState(false);
  const [showLaser, setShowLaser] = useState(false);
  const equipOffset = useRef(isEquipped ? 0 : 1.0);

  useEffect(() => {
    if (isShooting && isEquipped) {
      recoilOffset.current = 0.08;
      setShowFlash(true);
      setShowLaser(true);
      setTimeout(() => setShowFlash(false), 60);
      setTimeout(() => setShowLaser(false), 200);
    }
  }, [isShooting, isEquipped]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Animate recoil recovery
    recoilOffset.current = THREE.MathUtils.lerp(recoilOffset.current, 0, delta * 10);

    // Animate equip/unequip
    const targetEquip = isEquipped ? 0 : 0.5;
    equipOffset.current = THREE.MathUtils.lerp(equipOffset.current, targetEquip, delta * 8);

    // Get camera's world position and direction
    const cameraPos = camera.position.clone();
    const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

    // Position weapon in front of camera
    const weaponPos = cameraPos.clone()
      .add(cameraRight.multiplyScalar(0.35))
      .add(cameraUp.multiplyScalar(-0.25 - equipOffset.current * 0.3))
      .add(cameraDir.multiplyScalar(0.6 + recoilOffset.current));

    groupRef.current.position.copy(weaponPos);
    groupRef.current.quaternion.copy(camera.quaternion);
    groupRef.current.rotateX(equipOffset.current * 0.4);
  });

  return (
    <group ref={groupRef}>
      {/* Bright dedicated light */}
      <pointLight position={[0, 0.1, 0]} intensity={10} distance={3} color="#ffffff" />

      {/* === SPACESUIT ARMS - BRIGHT WHITE/GRAY FOR VISIBILITY === */}

      {/* RIGHT ARM - Main holding arm */}
      <group position={[0.08, -0.1, 0.08]}>
        {/* Upper Arm - WHITE */}
        <mesh rotation={[0.5, 0, -0.2]}>
          <boxGeometry args={[0.06, 0.18, 0.06]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {/* Elbow Joint - GRAY */}
        <mesh position={[0.02, -0.1, -0.04]}>
          <sphereGeometry args={[0.04]} />
          <meshBasicMaterial color="#aaaaaa" />
        </mesh>
        {/* Forearm - LIGHT GRAY */}
        <mesh position={[0.03, -0.14, -0.08]} rotation={[0.7, 0, 0]}>
          <boxGeometry args={[0.05, 0.15, 0.05]} />
          <meshBasicMaterial color="#cccccc" />
        </mesh>
        {/* Glove - ORANGE for visibility */}
        <mesh position={[0.04, -0.22, -0.14]}>
          <boxGeometry args={[0.07, 0.05, 0.06]} />
          <meshBasicMaterial color="#ff6600" />
        </mesh>
      </group>

      {/* LEFT ARM - Supporting arm */}
      <group position={[-0.1, -0.08, -0.08]}>
        {/* Upper Arm - WHITE */}
        <mesh rotation={[0.4, 0, 0.25]}>
          <boxGeometry args={[0.055, 0.15, 0.055]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {/* Elbow Joint */}
        <mesh position={[-0.03, -0.08, -0.03]}>
          <sphereGeometry args={[0.035]} />
          <meshBasicMaterial color="#aaaaaa" />
        </mesh>
        {/* Forearm - LIGHT GRAY */}
        <mesh position={[-0.05, -0.12, -0.06]} rotation={[0.5, 0, 0.15]}>
          <boxGeometry args={[0.045, 0.12, 0.045]} />
          <meshBasicMaterial color="#cccccc" />
        </mesh>
        {/* Glove - ORANGE */}
        <mesh position={[-0.07, -0.18, -0.1]}>
          <boxGeometry args={[0.06, 0.045, 0.055]} />
          <meshBasicMaterial color="#ff6600" />
        </mesh>
      </group>

      {/* === WEAPON === */}

      {/* LASER BEAM */}
      {showLaser && (
        <mesh position={[0, 0.02, -3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 6]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.85} />
        </mesh>
      )}

      {/* MUZZLE FLASH */}
      {showFlash && (
        <mesh position={[0, 0.02, -0.25]}>
          <sphereGeometry args={[0.05]} />
          <meshBasicMaterial color="#ffff44" />
        </mesh>
      )}

      {/* Main Body - Dark gun metal */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.035, 0.055, 0.18]} />
        <meshBasicMaterial color="#2a2a2a" />
      </mesh>

      {/* Stock */}
      <mesh position={[0, -0.015, 0.1]}>
        <boxGeometry args={[0.028, 0.07, 0.12]} />
        <meshBasicMaterial color="#1a1a1a" />
      </mesh>

      {/* Grip */}
      <mesh position={[0, -0.055, 0.02]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.025, 0.08, 0.035]} />
        <meshBasicMaterial color="#111111" />
      </mesh>

      {/* Handguard */}
      <mesh position={[0, 0, -0.12]}>
        <boxGeometry args={[0.03, 0.04, 0.15]} />
        <meshBasicMaterial color="#222222" />
      </mesh>

      {/* Barrel */}
      <mesh position={[0, 0.012, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.06]} />
        <meshBasicMaterial color="#111111" />
      </mesh>

      {/* Magazine */}
      <mesh position={[0, -0.075, -0.02]} rotation={[0.08, 0, 0]}>
        <boxGeometry args={[0.028, 0.11, 0.05]} />
        <meshBasicMaterial color="#1f1f1f" />
      </mesh>

      {/* Sight */}
      <mesh position={[0, 0.042, 0]}>
        <boxGeometry args={[0.028, 0.025, 0.04]} />
        <meshBasicMaterial color="#151515" />
      </mesh>
      {/* Red Dot */}
      <mesh position={[0, 0.042, -0.025]}>
        <circleGeometry args={[0.006]} />
        <meshBasicMaterial color="#ff0000" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};
