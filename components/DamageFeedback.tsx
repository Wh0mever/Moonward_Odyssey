/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

interface DamageEvent {
  id: string;
  position: [number, number, number];
  amount: number;
  isCritical: boolean;
}

interface DamageFeedbackProps {
  events: DamageEvent[];
  onRemove: (id: string) => void;
}

const FloatingText: React.FC<{ event: DamageEvent; onRemove: (id: string) => void }> = ({ event, onRemove }) => {
  const groupRef = useRef<THREE.Group>(null);
  const startTime = useMemo(() => Date.now(), []);

  useFrame(() => {
    const elapsed = Date.now() - startTime;
    if (elapsed > 1000) {
      onRemove(event.id);
    } else if (groupRef.current) {
      // Float up
      groupRef.current.position.y += 0.03;
      // Fade out logic could go here if material allowed, but Text handles color well
    }
  });

  return (
    <group ref={groupRef} position={new THREE.Vector3(...event.position)}>
        <Billboard>
            <Text
                color={event.isCritical ? "#ff0000" : "#ffff00"}
                fontSize={0.6}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.05}
                outlineColor="#000000"
                fontWeight="bold"
            >
                {Math.round(event.amount)}
            </Text>
        </Billboard>
    </group>
  );
};

export const DamageFeedback: React.FC<DamageFeedbackProps> = ({ events, onRemove }) => {
  return (
    <group>
      {events.map((event) => (
        <FloatingText key={event.id} event={event} onRemove={onRemove} />
      ))}
    </group>
  );
};