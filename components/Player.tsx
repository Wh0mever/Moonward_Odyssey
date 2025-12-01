
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree, createPortal } from '@react-three/fiber';
import { Vector3, Raycaster, Group, Vector2 } from 'three';
import { PointerLockControls } from '@react-three/drei';
import { getTerrainHeight } from '../services/geminiService';
import { PlayerStats } from '../types';
import { Weapon } from './Weapon';

interface PlayerProps {
  currentStats: PlayerStats;
  onStatsUpdate: (stats: PlayerStats) => void;
  onDie: (reason: string) => void;
  onShoot: (targetId: string | null, isHeadshot: boolean, hitPoint: Vector3) => void;
  onInteract: (targetId?: string) => void;
  onToggleEquip: () => void;
  onHover: (isHovering: boolean) => void;
  isEquipped: boolean;
  isDead: boolean;
  initialPosition?: { x: number, y: number, z: number };
  sensitivity?: number;
  isTutorial?: boolean;
}

const MOVE_ACCEL = 60.0;
const MAX_SPEED = 16.0;
const FRICTION = 5.0; 
const AIR_RESISTANCE = 0.5;
const JUMP_FORCE = 10.0; 
const STAMINA_JUMP_COST = 10;
const STAMINA_REGEN_RATE = 1.0; 
const GRAVITY = 9.0; 
const OXYGEN_DEPLETION_RATE = 1.0;
const ACID_LEVEL = -12;

export const Player: React.FC<PlayerProps> = ({ 
    currentStats, onStatsUpdate, onDie, onShoot, onInteract, onToggleEquip, onHover, isEquipped, isDead, initialPosition, sensitivity = 1.0, isTutorial = false
}) => {
  const { camera, scene } = useThree();
  const position = useRef(new Vector3(0, 20, 0));
  const velocity = useRef(new Vector3(0, 0, 0));
  const isGrounded = useRef(false);
  const keys = useRef<{ [key: string]: boolean }>({});
  const stats = useRef<PlayerStats>({ ...currentStats });
  const [isShooting, setIsShooting] = useState(false);
  
  // Laser Target for visual effect
  const [laserTarget, setLaserTarget] = useState<Vector3 | null>(null);
  
  // Recoil State
  const recoilAccumulator = useRef(0);
  
  // Raycaster for interactions and shooting
  const raycaster = useRef(new Raycaster());
  
  // Refs for callbacks to prevent stale closures
  const onInteractRef = useRef(onInteract);
  const onShootRef = useRef(onShoot);
  const onToggleEquipRef = useRef(onToggleEquip);
  const onHoverRef = useRef(onHover);
  const onStatsUpdateRef = useRef(onStatsUpdate); // Critical for spawning logic
  
  useEffect(() => { onInteractRef.current = onInteract; }, [onInteract]);
  useEffect(() => { onShootRef.current = onShoot; }, [onShoot]);
  useEffect(() => { onToggleEquipRef.current = onToggleEquip; }, [onToggleEquip]);
  useEffect(() => { onHoverRef.current = onHover; }, [onHover]);
  useEffect(() => { onStatsUpdateRef.current = onStatsUpdate; }, [onStatsUpdate]);

  // Sync Stats
  useEffect(() => {
    stats.current.health = currentStats.health;
    stats.current.oxygen = currentStats.oxygen;
    stats.current.xp = currentStats.xp;
    stats.current.level = currentStats.level;
    stats.current.maxStamina = currentStats.maxStamina;
    stats.current.ammo = currentStats.ammo;
    stats.current.fuel = currentStats.fuel;
    stats.current.artifacts = currentStats.artifacts;
  }, [currentStats]);

  // Init Pos
  useEffect(() => {
    if (initialPosition) {
        position.current.set(initialPosition.x, initialPosition.y + 2, initialPosition.z);
        camera.position.copy(position.current);
        stats.current.position = initialPosition;
        stats.current.stamina = currentStats.stamina; 
    }
  }, []);

  // Controls Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (isDead) return;
        keys.current[e.code] = true;
        
        // INTERACTION (E)
        if (e.code === 'KeyE') {
            raycaster.current.setFromCamera(new Vector2(0, 0), camera);
            const intersects = raycaster.current.intersectObjects(scene.children, true);
            const hit = intersects.find(i => i.object.userData.interactable && i.distance < 4.0);
            
            if (hit) {
                onInteractRef.current(hit.object.userData.id);
            } else {
                onInteractRef.current(undefined);
            }
        }

        // TOGGLE WEAPON (1)
        if (e.code === 'Digit1') {
            onToggleEquipRef.current();
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => (keys.current[e.code] = false);
    
    const handleMouseDown = () => {
        if (!isDead && isEquipped && stats.current.ammo > 0) {
            setIsShooting(true);
            setTimeout(() => setIsShooting(false), 100);
            
            // RAYCAST SHOOTING LOGIC
            const dir = new Vector3();
            camera.getWorldDirection(dir);
            // Accuracy Spread
            const spread = isGrounded.current ? 0.005 : 0.15; 
            dir.x += (Math.random() - 0.5) * spread;
            dir.y += (Math.random() - 0.5) * spread;
            dir.z += (Math.random() - 0.5) * spread;
            dir.normalize();

            raycaster.current.set(camera.position, dir);
            
            // Only intersect things that matter (Enemies, Terrain)
            const intersects = raycaster.current.intersectObjects(scene.children, true);
            
            let hitTargetId: string | null = null;
            let isHeadshot = false;
            let hitPoint = new Vector3().copy(camera.position).add(dir.multiplyScalar(100)); // Default max range

            // Find first valid hit
            for (let i = 0; i < intersects.length; i++) {
                const hit = intersects[i];
                if (hit.object.userData.type === 'ENEMY') {
                    hitTargetId = hit.object.userData.id;
                    isHeadshot = hit.object.userData.part === 'HEAD';
                    hitPoint = hit.point;
                    break;
                } else if (!hit.object.userData.ignoreRaycast) { // Stop at terrain
                    hitPoint = hit.point;
                    break;
                }
            }

            onShootRef.current(hitTargetId, isHeadshot, hitPoint);
            setLaserTarget(hitPoint);
            setTimeout(() => setLaserTarget(null), 100);

            // Recoil
            const kick = 0.02 * sensitivity; 
            recoilAccumulator.current += kick;
            camera.rotation.x += kick; 
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isDead, camera, scene, isEquipped, sensitivity]);

  const lastUpdate = useRef(Date.now());

  useFrame((state, delta) => {
    if (isDead) return;

    // Hover Interaction Check
    if (state.clock.elapsedTime % 0.1 < 0.02) { // Throttle check
        raycaster.current.setFromCamera(new Vector2(0, 0), camera);
        const intersects = raycaster.current.intersectObjects(scene.children, true);
        const hit = intersects.find(i => i.object.userData.interactable && i.distance < 4.0);
        onHoverRef.current(!!hit);
    }

    const time = Date.now();
    const dt = Math.min(delta, 0.1);

    // RECOIL RECOVERY
    if (recoilAccumulator.current > 0) {
        const recoverySpeed = 5.0; 
        const recoveryAmount = recoilAccumulator.current * recoverySpeed * dt;
        recoilAccumulator.current = Math.max(0, recoilAccumulator.current - recoveryAmount);
        camera.rotation.x -= recoveryAmount;
    }

    // Stats Drain & Regen
    if (time - lastUpdate.current > 1000) {
      if (!isTutorial) {
        stats.current.oxygen -= OXYGEN_DEPLETION_RATE;
        if (stats.current.oxygen <= 0) onDie("Asphyxiation");
      }
      
      if (stats.current.stamina < stats.current.maxStamina) {
          stats.current.stamina = Math.min(stats.current.maxStamina, stats.current.stamina + STAMINA_REGEN_RATE);
      }

      // USE REF HERE to use the FRESH closure from App.tsx
      onStatsUpdateRef.current({ ...stats.current, position: { ...position.current } });
      lastUpdate.current = time;
    }

    // Movement Physics
    const frontVector = new Vector3(0, 0, Number(keys.current['KeyS'] || 0) - Number(keys.current['KeyW'] || 0));
    const sideVector = new Vector3(Number(keys.current['KeyA'] || 0) - Number(keys.current['KeyD'] || 0), 0, 0);
    const direction = new Vector3().subVectors(frontVector, sideVector).normalize();

    const camDir = new Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    camDir.normalize();
    const camRight = new Vector3().crossVectors(camera.up, camDir).normalize(); 
    
    const moveForce = new Vector3()
        .addScaledVector(camRight, sideVector.x)
        .addScaledVector(camDir, -frontVector.z)
        .normalize();

    if (isGrounded.current) {
        velocity.current.x += moveForce.x * MOVE_ACCEL * dt;
        velocity.current.z += moveForce.z * MOVE_ACCEL * dt;
        
        const hSpeed = Math.sqrt(velocity.current.x**2 + velocity.current.z**2);
        if (hSpeed > MAX_SPEED) {
             const ratio = MAX_SPEED / hSpeed;
             velocity.current.x *= ratio;
             velocity.current.z *= ratio;
        }

        velocity.current.x -= velocity.current.x * FRICTION * dt;
        velocity.current.z -= velocity.current.z * FRICTION * dt;

        if (keys.current['Space']) {
            if (stats.current.stamina >= STAMINA_JUMP_COST) {
                velocity.current.y = JUMP_FORCE;
                stats.current.stamina -= STAMINA_JUMP_COST;
                isGrounded.current = false;
                onStatsUpdateRef.current({ ...stats.current, position: { ...position.current } });
            }
        }
    } else {
        velocity.current.x += moveForce.x * (MOVE_ACCEL * 0.2) * dt;
        velocity.current.z += moveForce.z * (MOVE_ACCEL * 0.2) * dt;
        velocity.current.x -= velocity.current.x * AIR_RESISTANCE * dt;
        velocity.current.z -= velocity.current.z * AIR_RESISTANCE * dt;
    }

    velocity.current.y -= GRAVITY * dt;

    position.current.x += velocity.current.x * dt;
    position.current.z += velocity.current.z * dt;
    position.current.y += velocity.current.y * dt;

    // Collision
    if (!isTutorial && position.current.y < ACID_LEVEL + 1) { 
         onDie("Dissolved in Acid Pool");
         return;
    }

    // Determine Ground Height (Flat 0 for tutorial, noise for game)
    const terrainHeight = isTutorial ? 0 : getTerrainHeight(position.current.x, position.current.z);
    const playerHeight = 1.8; 

    if (position.current.y < terrainHeight + playerHeight) {
      position.current.y = terrainHeight + playerHeight;
      velocity.current.y = Math.max(0, velocity.current.y);
      isGrounded.current = true;
    } else {
      isGrounded.current = false;
    }

    // Apply physics to camera
    camera.position.copy(position.current);
  });

  return (
    <>
        {!isDead && (
            <>
                <PointerLockControls />
                {createPortal(
                    <group>
                        {/* Handheld Weapon - Adjusted Position for FPS View */}
                        <Weapon isShooting={isShooting} isEquipped={isEquipped} laserTarget={laserTarget} />
                        
                        {/* Flashlight */}
                        <spotLight 
                            position={[0.2, -0.2, 0]} 
                            intensity={3} 
                            angle={0.6} 
                            penumbra={0.5} 
                            distance={60} 
                            color="#ffffdd"
                            castShadow
                        />
                    </group>,
                    camera
                )}
            </>
        )}
    </>
  );
};
