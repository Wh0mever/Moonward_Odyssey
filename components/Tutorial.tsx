/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState, useRef } from 'react';
import { PlayerStats, Collectible, CollectibleType, Enemy, EnemyType } from '../types';

interface TutorialProps {
    stats: PlayerStats;
    setCollectibles: React.Dispatch<React.SetStateAction<Collectible[]>>;
    setEnemies: React.Dispatch<React.SetStateAction<Enemy[]>>;
    collectibles: Collectible[];
    enemies: Enemy[];
    isEquipped: boolean;
    onReturnToMenu: () => void;
}

const steps = [
    { id: 0, text: "WELCOME TO TRAINING. USE [ W, A, S, D ] TO MOVE." },
    { id: 1, text: "GOOD. NOW PRESS [ SPACE ] TO JUMP." },
    { id: 2, text: "COLLECT RESOURCES. WALK TO THE ITEMS." },
    { id: 3, text: "PRESS [ 1 ] TO EQUIP YOUR WEAPON." },
    { id: 4, text: "ELIMINATE THE TARGET. LEFT CLICK TO SHOOT." },
    { id: 5, text: "TRAINING COMPLETE." }
];

export const Tutorial: React.FC<TutorialProps> = ({
    stats, setCollectibles, setEnemies, collectibles, enemies, isEquipped, onReturnToMenu
}) => {
    const [step, setStep] = useState(0);
    const startPos = useRef(stats.position);
    const hasMoved = useRef(false);
    const hasJumped = useRef(false);
    const spawnedItems = useRef(false);
    const spawnedEnemy = useRef(false);

    useEffect(() => {
        // Step 0: Move
        if (step === 0) {
            const dx = stats.position.x - startPos.current.x;
            const dz = stats.position.z - startPos.current.z;
            if (Math.sqrt(dx * dx + dz * dz) > 3) {
                hasMoved.current = true;
                setStep(1);
            }
        }

        // Step 1: Jump
        if (step === 1) {
            if (stats.position.y > 3) { // Jump height threshold
                hasJumped.current = true;
                setStep(2);
            }
        }

        // Step 2: Collect
        if (step === 2) {
            if (!spawnedItems.current) {
                setCollectibles([
                    { id: 'tut-xp', type: CollectibleType.XP, position: [5, 1, 0], value: 50 },
                    { id: 'tut-ox', type: CollectibleType.OXYGEN, position: [8, 1, 0], value: 50 },
                    { id: 'tut-fuel', type: CollectibleType.FUEL, position: [11, 1, 0], value: 50 },
                    { id: 'tut-art', type: CollectibleType.ARTIFACT, position: [14, 1, 0], value: 1, artifactId: 0 },
                ]);
                spawnedItems.current = true;
            }
            if (spawnedItems.current && collectibles.length === 0) {
                setStep(3);
            }
        }

        // Step 3: Equip
        if (step === 3) {
            if (isEquipped) {
                setStep(4);
            }
        }

        // Step 4: Combat
        if (step === 4) {
            if (!spawnedEnemy.current) {
                setEnemies([{
                    id: 'tut-zombie',
                    type: EnemyType.ZOMBIE,
                    position: [0, 2, 10],
                    health: 100
                }]);
                spawnedEnemy.current = true;
            }
            if (spawnedEnemy.current && enemies.length === 0) {
                setStep(5);
                setTimeout(() => {
                    // Unlock pointer before returning to menu
                    if (document.pointerLockElement) {
                        document.exitPointerLock();
                    }
                    onReturnToMenu();
                }, 4000);
            }
        }

    }, [step, stats, isEquipped, collectibles, enemies]);

    return (
        <div className="absolute top-24 left-0 w-full flex justify-center pointer-events-none">
            <div className="bg-black/80 backdrop-blur-md px-8 py-6 rounded-2xl border border-green-500/50 text-center animate-fade-in-down shadow-[0_0_30px_rgba(0,255,0,0.2)]">
                <h2 className="text-2xl font-black text-green-400 mb-2">TRAINING PROTOCOL</h2>
                <p className="text-xl text-white font-mono">{steps[step].text}</p>
                {step === 5 && <p className="text-sm text-gray-400 mt-2">Returning to Menu...</p>}
            </div>
        </div>
    );
};