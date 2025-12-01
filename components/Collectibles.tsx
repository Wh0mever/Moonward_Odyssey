
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Collectible, CollectibleType } from '../types';

interface CollectiblesManagerProps {
  playerPos: { x: number, y: number, z: number };
  onCollect: (item: Collectible) => void;
  collectibles: Collectible[];
}

const ArtifactCube: React.FC<{ item: Collectible }> = ({ item }) => {
    // We try to load texture, if fail fallback to color
    let textureUrl = "";
    switch(item.artifactId) {
        case 0: 
            textureUrl = "https://habrastorage.org/getpro/moikrug/uploads/company/100/006/968/4/logo/medium_f3ccdd27d2000e3f9255a7e3e2c48800.jpg"; 
            break;
        case 1: 
            textureUrl = "https://play-lh.googleusercontent.com/tnx148d2RuzetzXpTrRowzhbAAlY3rwNARBcpPPHIYQWfUW9fkELUKCoIK1c03h-_6E"; 
            break;
        case 2: 
            textureUrl = "https://media.licdn.com/dms/image/v2/D4D0BAQEx4HDGdk3EwQ/company-logo_200_200/B4DZgR.wCoHYAM-/0/1752648326832/uzbekspace_logo?e=2147483647&v=beta&t=ZrM9PKhNCyJ4xTp0GsOl8l2_z11Pe2SkUD55HgZ0s44"; 
            break;
        case 3: 
            textureUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Yandex_icon.svg/1024px-Yandex_icon.svg.png"; 
            break;
        default:
            textureUrl = "";
    }

    // Safely try to load texture if url exists
    const texture = useTexture(textureUrl || "https://via.placeholder.com/150");
    if (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
    }

    return (
        <mesh 
            position={new THREE.Vector3(...item.position)} 
            castShadow
            userData={{ id: item.id, interactable: true }}
        >
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <meshStandardMaterial map={texture} emissiveMap={texture} emissiveIntensity={0.5} color="white" />
            <pointLight distance={3} intensity={1} color="cyan" />
        </mesh>
    );
};

export const CollectiblesManager: React.FC<CollectiblesManagerProps> = ({ playerPos, onCollect, collectibles }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Geometries
  const geoSphere = useMemo(() => new THREE.IcosahedronGeometry(0.5, 0), []);
  const geoBox = useMemo(() => new THREE.BoxGeometry(0.5, 0.5, 0.5), []);
  const geoCyl = useMemo(() => new THREE.CylinderGeometry(0.2, 0.2, 0.8, 8), []);

  // Materials
  const matOxygen = useMemo(() => new THREE.MeshStandardMaterial({ color: '#00ffff', emissive: '#00aaaa', emissiveIntensity: 2 }), []);
  const matXP = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffd700', emissive: '#aa8800', emissiveIntensity: 1 }), []);
  const matAmmo = useMemo(() => new THREE.MeshStandardMaterial({ color: '#00ff00', emissive: '#004400', emissiveIntensity: 0.5 }), []); // Green Box
  const matFuel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#aa00ff', emissive: '#4400aa', emissiveIntensity: 2 }), []); // Purple Fuel

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (groupRef.current) {
        groupRef.current.children.forEach((child, i) => {
            child.rotation.y = time + i;
            child.position.y += Math.sin(time * 2 + i) * 0.002; 
        });
    }
  });

  return (
    <group ref={groupRef}>
      {collectibles.map((item) => {
          if (item.type === CollectibleType.ARTIFACT) {
              return <ArtifactCube key={item.id} item={item} />
          }
          
          let geo: THREE.BufferGeometry = geoSphere;
          let mat = matOxygen;
          
          if (item.type === CollectibleType.XP) { mat = matXP; }
          else if (item.type === CollectibleType.AMMO) { geo = geoBox; mat = matAmmo; }
          else if (item.type === CollectibleType.FUEL) { geo = geoCyl; mat = matFuel; }

          return (
            <mesh 
                key={item.id} 
                position={new THREE.Vector3(...item.position)}
                geometry={geo}
                material={mat}
                castShadow
                userData={{ id: item.id, interactable: true }}
            >
                {item.type === CollectibleType.FUEL && <pointLight distance={3} intensity={1} color="#aa00ff" />}
            </mesh>
          );
      })}
    </group>
  );
};
