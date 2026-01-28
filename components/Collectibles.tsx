
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
    switch (item.artifactId) {
        case 0:
            textureUrl = "https://habrastorage.org/getpro/moikrug/uploads/company/100/006/968/4/logo/medium_f3ccdd27d2000e3f9255a7e3e2c48800.jpg";
            break;
        case 1:
            // East Games - using base64 embedded logo
            textureUrl = "data:image/png;base64,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";
            break;
        case 2:
            // UzbekSpace logo - using reliable PNG
            textureUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Flag_of_Uzbekistan.svg/200px-Flag_of_Uzbekistan.svg.png";
            break;
        case 3:
            textureUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Yandex_icon.svg/1024px-Yandex_icon.svg.png";
            break;
        case 4:
            // WHOMEVER logo - LOCAL FILE
            textureUrl = "/whomever_logo.jpg";
            break;
        default:
            textureUrl = "";
    }

    // Safely try to load texture if url exists
    const texture = useTexture(textureUrl || "https://via.placeholder.com/150");
    if (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
    }

    const pos = new THREE.Vector3(...item.position);

    // WHOMEVER artifact (#4) gets special GOLD/PURPLE color, others get CYAN
    const isWhomever = item.artifactId === 4;
    const beamColor = isWhomever ? "#ffd700" : "#00ffff";  // Gold vs Cyan
    const coreColor = isWhomever ? "#ff00ff" : "#ffffff";  // Magenta vs White
    const glowColor = isWhomever ? "#ffaa00" : "#00ffff";  // Orange vs Cyan

    return (
        <group position={pos}>
            {/* ARTIFACT CUBE */}
            <mesh
                castShadow
                userData={{ id: item.id, interactable: true }}
            >
                <boxGeometry args={[0.8, 0.8, 0.8]} />
                <meshStandardMaterial map={texture} emissiveMap={texture} emissiveIntensity={0.5} color="white" />
            </mesh>

            {/* Glow light at artifact */}
            <pointLight distance={isWhomever ? 50 : 10} intensity={isWhomever ? 20 : 5} color={glowColor} />

            {/* === BEACON LIGHT BEAM === */}
            {/* WHOMEVER gets MEGA TALL BEAM (1000m) for visibility at 3-5km */}
            <mesh position={[0, isWhomever ? 500 : 250, 0]} userData={{ ignoreRaycast: true }}>
                <cylinderGeometry args={[isWhomever ? 1.0 : 0.3, isWhomever ? 1.0 : 0.3, isWhomever ? 1000 : 500]} />
                <meshBasicMaterial
                    color={beamColor}
                    transparent
                    opacity={isWhomever ? 0.7 : 0.4}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Inner brighter core beam */}
            <mesh position={[0, isWhomever ? 500 : 250, 0]} userData={{ ignoreRaycast: true }}>
                <cylinderGeometry args={[isWhomever ? 0.4 : 0.1, isWhomever ? 0.4 : 0.1, isWhomever ? 1000 : 500]} />
                <meshBasicMaterial
                    color={coreColor}
                    transparent
                    opacity={isWhomever ? 0.9 : 0.7}
                />
            </mesh>

            {/* Base glow ring - larger for WHOMEVER */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} userData={{ ignoreRaycast: true }}>
                <ringGeometry args={[isWhomever ? 2.0 : 0.6, isWhomever ? 5.0 : 1.2, 32]} />
                <meshBasicMaterial color={beamColor} transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
        </group>
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
