import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { multiplayerService, RemotePlayer } from '../services/multiplayerService';

interface OtherPlayersProps {
    localPlayerId: string | undefined;
}

interface InterpolatedPlayer extends RemotePlayer {
    targetPosition: THREE.Vector3;
    currentPosition: THREE.Vector3;
    targetRotation: number;
    currentRotation: number;
}

export const OtherPlayers: React.FC<OtherPlayersProps> = ({ localPlayerId }) => {
    const [players, setPlayers] = useState<Map<string, InterpolatedPlayer>>(new Map());
    const playersRef = useRef<Map<string, InterpolatedPlayer>>(new Map());

    useEffect(() => {
        const unsubscribe = multiplayerService.onPlayerUpdate((remotePlayers) => {
            const newPlayers = new Map(playersRef.current);

            // Update existing players and add new ones
            remotePlayers.forEach((player) => {
                // Skip local player
                if (player.id === localPlayerId) return;

                const existing = newPlayers.get(player.id);
                if (existing) {
                    // Update target position for interpolation
                    existing.targetPosition.set(...player.position);
                    existing.targetRotation = player.rotation;
                    existing.health = player.health;
                    existing.username = player.username;
                } else {
                    // New player
                    const interpolated: InterpolatedPlayer = {
                        ...player,
                        targetPosition: new THREE.Vector3(...player.position),
                        currentPosition: new THREE.Vector3(...player.position),
                        targetRotation: player.rotation,
                        currentRotation: player.rotation
                    };
                    newPlayers.set(player.id, interpolated);
                }
            });

            // Remove players that are no longer in the list
            const remoteIds = new Set(remotePlayers.map(p => p.id));
            newPlayers.forEach((_, id) => {
                if (!remoteIds.has(id)) {
                    newPlayers.delete(id);
                }
            });

            playersRef.current = newPlayers;
            setPlayers(new Map(newPlayers));
        });

        return () => unsubscribe();
    }, [localPlayerId]);

    useFrame((_, delta) => {
        // Interpolate positions
        playersRef.current.forEach((player) => {
            player.currentPosition.lerp(player.targetPosition, delta * 10);
            player.currentRotation += (player.targetRotation - player.currentRotation) * delta * 10;
        });
    });

    return (
        <>
            {Array.from(players.values()).map((player) => (
                <RemotePlayerMesh key={player.id} player={player} />
            ))}
        </>
    );
};

interface RemotePlayerMeshProps {
    player: InterpolatedPlayer;
}

const RemotePlayerMesh: React.FC<RemotePlayerMeshProps> = ({ player }) => {
    const groupRef = useRef<THREE.Group>(null);
    const healthBarRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.position.copy(player.currentPosition);
            groupRef.current.rotation.y = player.currentRotation;
        }

        // Update health bar
        if (healthBarRef.current) {
            healthBarRef.current.scale.x = Math.max(0, player.health / 100);
        }
    });

    return (
        <group ref={groupRef}>
            {/* Body */}
            <mesh position={[0, 0.9, 0]} castShadow>
                <capsuleGeometry args={[0.4, 1.0, 8, 16]} />
                <meshStandardMaterial color="#6366f1" metalness={0.3} roughness={0.4} />
            </mesh>

            {/* Helmet */}
            <mesh position={[0, 1.7, 0]} castShadow>
                <sphereGeometry args={[0.35, 16, 16]} />
                <meshStandardMaterial
                    color="#1e293b"
                    metalness={0.8}
                    roughness={0.2}
                    emissive="#6366f1"
                    emissiveIntensity={0.2}
                />
            </mesh>

            {/* Visor */}
            <mesh position={[0, 1.7, 0.25]} castShadow>
                <sphereGeometry args={[0.2, 16, 16, 0, Math.PI]} />
                <meshStandardMaterial
                    color="#fbbf24"
                    metalness={0.9}
                    roughness={0.1}
                    transparent
                    opacity={0.8}
                />
            </mesh>

            {/* Backpack */}
            <mesh position={[0, 1.0, -0.35]} castShadow>
                <boxGeometry args={[0.5, 0.6, 0.2]} />
                <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.5} />
            </mesh>

            {/* Username label */}
            <Text
                position={[0, 2.3, 0]}
                fontSize={0.2}
                color="white"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor="black"
            >
                {player.username}
            </Text>

            {/* Health bar background */}
            <mesh position={[0, 2.1, 0]}>
                <planeGeometry args={[0.6, 0.08]} />
                <meshBasicMaterial color="#1f2937" transparent opacity={0.8} />
            </mesh>

            {/* Health bar */}
            <mesh ref={healthBarRef} position={[-0.3 + (player.health / 100) * 0.3, 2.1, 0.01]}>
                <planeGeometry args={[0.6, 0.06]} />
                <meshBasicMaterial
                    color={player.health > 50 ? '#22c55e' : player.health > 25 ? '#eab308' : '#ef4444'}
                />
            </mesh>

            {/* Glow effect */}
            <pointLight
                position={[0, 1, 0]}
                color="#6366f1"
                intensity={0.5}
                distance={3}
            />
        </group>
    );
};
