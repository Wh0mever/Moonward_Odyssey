
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { Enemy, EnemyType, Cactus } from '../types';
import { getTerrainHeight } from '../services/geminiService';
import { DamageFeedback } from './DamageFeedback';

interface EnemiesManagerProps {
    playerPos: { x: number, y: number, z: number };
    onPlayerHit: (damage: number, reason: string) => void;
    enemies: Enemy[];
    cacti: Cactus[];
    setEnemies: React.Dispatch<React.SetStateAction<Enemy[]>>;
    isTutorial?: boolean;
}

const SpiderLeg: React.FC<{ phase: number }> = ({ phase }) => {
    const legRef = useRef<THREE.Group>(null);
    useFrame((state) => {
        if (legRef.current) {
            const t = state.clock.elapsedTime * 10;
            // Simple up/down scuttle animation
            legRef.current.rotation.z = Math.sin(t + phase) * 0.3;
        }
    });

    return (
        <group ref={legRef} rotation={[0, 0, -0.5]}>
            <mesh position={[0.4, 0, 0]} rotation={[0, 0, -0.2]}>
                <cylinderGeometry args={[0.04, 0.02, 0.8]} />
                <meshStandardMaterial color="#111" />
            </mesh>
            <mesh position={[0.8, -0.3, 0]} rotation={[0, 0, 0.8]}>
                <cylinderGeometry args={[0.02, 0.01, 0.8]} />
                <meshStandardMaterial color="#220000" />
            </mesh>
        </group>
    );
};

const SpiderMesh: React.FC<{ id: string }> = ({ id }) => {
    return (
        <group>
            {/* LARGE Body Hitbox */}
            <mesh castShadow receiveShadow userData={{ id, type: 'ENEMY', part: 'BODY' }}>
                <sphereGeometry args={[1.0, 16, 16]} />
                <meshStandardMaterial color="#110000" roughness={0.4} />
            </mesh>
            {/* Abdomen */}
            <mesh position={[0, 0.2, -0.5]} castShadow userData={{ id, type: 'ENEMY', part: 'BODY' }}>
                <sphereGeometry args={[0.9, 16, 16]} />
                <meshStandardMaterial color="#220022" emissive="#110011" />
            </mesh>
            {/* LARGE Head Hitbox */}
            <mesh position={[0, 0, 0.6]} userData={{ id, type: 'ENEMY', part: 'HEAD' }}>
                <sphereGeometry args={[0.6]} />
                <meshStandardMaterial color="#000" />
            </mesh>
            {/* Eyes */}
            <mesh position={[0.15, 0.1, 0.8]}>
                <sphereGeometry args={[0.08]} />
                <meshBasicMaterial color="#ff0000" />
            </mesh>
            <mesh position={[-0.15, 0.1, 0.8]}>
                <sphereGeometry args={[0.08]} />
                <meshBasicMaterial color="#ff0000" />
            </mesh>

            {/* Legs - Visual only */}
            <group position={[0.3, 0, 0.1]} rotation={[0, 0.5, 0]}><SpiderLeg phase={0} /></group>
            <group position={[-0.3, 0, 0.1]} rotation={[0, -0.5, 0]} scale={[-1, 1, 1]}><SpiderLeg phase={Math.PI} /></group>
            <group position={[0.35, 0, -0.1]} rotation={[0, 1.0, 0]}><SpiderLeg phase={1} /></group>
            <group position={[-0.35, 0, -0.1]} rotation={[0, -1.0, 0]} scale={[-1, 1, 1]}><SpiderLeg phase={Math.PI + 1} /></group>
            <group position={[0.35, 0, -0.3]} rotation={[0, 1.8, 0]}><SpiderLeg phase={2} /></group>
            <group position={[-0.35, 0, -0.3]} rotation={[0, -1.8, 0]} scale={[-1, 1, 1]}><SpiderLeg phase={Math.PI + 2} /></group>
            <group position={[0.3, 0, 0.3]} rotation={[0, 0.2, 0]}><SpiderLeg phase={3} /></group>
            <group position={[-0.3, 0, 0.3]} rotation={[0, -0.2, 0]} scale={[-1, 1, 1]}><SpiderLeg phase={Math.PI + 3} /></group>
        </group>
    );
}

const HealthBar: React.FC<{ health: number; maxHealth: number; offset: number }> = ({ health, maxHealth, offset }) => {
    const percent = Math.max(0, health / maxHealth);
    return (
        <Billboard position={[0, offset, 0]}>
            <mesh position={[-0.5 + (percent / 2), 0, 0.01]}>
                <planeGeometry args={[percent, 0.1]} />
                <meshBasicMaterial color={percent > 0.5 ? "#00ff00" : "#ff0000"} />
            </mesh>
            {/* Background */}
            <mesh position={[0, 0, 0]}>
                <planeGeometry args={[1.04, 0.14]} />
                <meshBasicMaterial color="black" />
            </mesh>
        </Billboard>
    )
}

export const EnemiesManager: React.FC<EnemiesManagerProps> = ({ playerPos, onPlayerHit, enemies, cacti, setEnemies, isTutorial = false }) => {
    const lastDamageTime = useRef(0);

    // Reusable Geometries/Materials
    const cactusGeo = useMemo(() => new THREE.ConeGeometry(0.5, 3, 6), []);
    const cactusMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f6a31', roughness: 0.8 }), []);

    const zombieGeo = useMemo(() => new THREE.CapsuleGeometry(0.8, 1.4, 4, 8), []); // Wider body and increased size
    const zombieMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6a0dad', emissive: '#330044', roughness: 0.5 }), []);
    const headGeo = useMemo(() => new THREE.SphereGeometry(0.6), []); // Bigger head

    useFrame((state, delta) => {
        const time = Date.now();
        const newEnemies = [...enemies];
        let enemiesChanged = false;

        newEnemies.forEach((enemy) => {
            const dx = playerPos.x - enemy.position[0];
            const dy = playerPos.y - enemy.position[1];
            const dz = playerPos.z - enemy.position[2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // Movement Logic
            if (dist > 1.5 && dist < 50) {
                let speed = 3.5;
                if (enemy.type === EnemyType.SPIDER) speed = 5.25;

                const moveSpeed = speed * delta;

                enemy.position[0] += (dx / dist) * moveSpeed;
                enemy.position[2] += (dz / dist) * moveSpeed;

                const terrainH = isTutorial ? 0 : getTerrainHeight(enemy.position[0], enemy.position[2]);
                const heightOffset = enemy.type === EnemyType.SPIDER ? 0.6 : 1.0;
                enemy.position[1] = terrainH + heightOffset;

                enemiesChanged = true;
            }

            // Damage Logic
            if (dist < (enemy.type === EnemyType.SPIDER ? 2.0 : 1.5)) {
                if (time - lastDamageTime.current > 1000) {
                    const dmg = enemy.type === EnemyType.SPIDER ? 20 : 10;
                    const reason = enemy.type === EnemyType.SPIDER ? "Devoured by Void Spider" : "Alien Mauling";
                    onPlayerHit(dmg, reason);
                    lastDamageTime.current = time;
                }
            }
        });

        if (enemiesChanged) setEnemies(newEnemies);

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
            {cacti.map(c => (
                <mesh
                    key={c.id}
                    position={new THREE.Vector3(...c.position)}
                    geometry={cactusGeo}
                    material={cactusMat}
                    castShadow
                    userData={{ type: 'CACTUS' }}
                />
            ))}

            {enemies.map(e => (
                <group key={e.id} position={new THREE.Vector3(...e.position)}>
                    {/* Health Bar */}
                    <HealthBar
                        health={e.health}
                        maxHealth={e.type === EnemyType.SPIDER ? 150 : 100}
                        offset={e.type === EnemyType.SPIDER ? 1.5 : 2.5}
                    />

                    {e.type === EnemyType.SPIDER ? (
                        <SpiderMesh id={e.id} />
                    ) : (
                        <group>
                            {/* Zombie Body Hitbox - Visible + Physics - Increased Size */}
                            <mesh geometry={zombieGeo} material={zombieMat} castShadow receiveShadow userData={{ id: e.id, type: 'ENEMY', part: 'BODY' }} />

                            {/* Zombie Head Hitbox - Increased Size */}
                            <mesh position={[0, 1.2, 0]} geometry={headGeo} material={zombieMat} userData={{ id: e.id, type: 'ENEMY', part: 'HEAD' }} />

                            {/* Eyes */}
                            <mesh position={[0.2, 1.3, 0.4]} scale={0.15}><sphereGeometry /><meshBasicMaterial color="red" /></mesh>
                            <mesh position={[-0.2, 1.3, 0.4]} scale={0.15}><sphereGeometry /><meshBasicMaterial color="red" /></mesh>
                        </group>
                    )}
                </group>
            ))}
        </group>
    );
};
