
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { Grid, Plane } from '@react-three/drei';

export const TrainingFloor: React.FC = () => {
  return (
    <group>
      {/* Visual Grid Floor */}
      <Grid 
        position={[0, 0.01, 0]} 
        args={[100, 100]} 
        cellSize={1} 
        cellThickness={1} 
        cellColor="#00ff00" 
        sectionSize={5} 
        sectionThickness={1.5} 
        sectionColor="#004400" 
        fadeDistance={50} 
        infiniteGrid 
      />
      
      {/* Solid Floor for Shadows */}
      <Plane args={[100, 100]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#050505" roughness={0.1} metalness={0.8} />
      </Plane>

      {/* Ambient Training Lights */}
      <pointLight position={[10, 5, 10]} color="green" intensity={0.5} distance={20} />
      <pointLight position={[-10, 5, -10]} color="cyan" intensity={0.5} distance={20} />
    </group>
  );
};
