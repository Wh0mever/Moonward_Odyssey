
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { useGLTF } from '@react-three/drei';

interface ModelLoaderProps {
  url: string;
  scale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/* 
 * Usage for future GLB integration:
 * 1. Place .glb files in public folder
 * 2. <ModelLoader url="/alien.glb" scale={1.5} />
 */
export const ModelLoader: React.FC<ModelLoaderProps> = ({ url, scale = 1, position = [0,0,0], rotation = [0,0,0] }) => {
  try {
    const { scene } = useGLTF(url);
    return <primitive object={scene} scale={scale} position={position} rotation={rotation} />;
  } catch (e) {
    console.warn("Failed to load model", url, e);
    // Fallback mesh if model fails to load
    return (
        <mesh position={position}>
            <boxGeometry />
            <meshStandardMaterial color="magenta" wireframe />
        </mesh>
    );
  }
};
