
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_RES, getTerrainHeight } from '../services/geminiService';
import '../types'; // Ensure global JSX types are loaded

const ACID_LEVEL = -12;

interface ChunkProps {
  x: number;
  z: number;
}

const Chunk: React.FC<ChunkProps> = React.memo(({ x, z }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_RES, CHUNK_RES);
    const posAttribute = geo.attributes.position;
    
    // Displace vertices
    for (let i = 0; i < posAttribute.count; i++) {
      const localX = posAttribute.getX(i);
      const localY = posAttribute.getY(i); 
      
      const worldX = x + localX;
      const worldZ = z - localY; 
      
      const height = getTerrainHeight(worldX, worldZ);
      posAttribute.setZ(i, height); 
    }
    
    geo.computeVertexNormals();
    return geo;
  }, [x, z]);

  return (
    <group>
        <mesh 
        ref={meshRef} 
        position={[x, 0, z]} 
        rotation={[-Math.PI / 2, 0, 0]} 
        receiveShadow 
        castShadow
        >
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial 
            color="#555555" 
            roughness={0.9} 
            metalness={0.1} 
            flatShading={true}
        />
        </mesh>
        
        {/* Acid Plane for this chunk */}
        <mesh position={[x, ACID_LEVEL, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[CHUNK_SIZE, CHUNK_SIZE]} />
            <meshBasicMaterial color="#00ff00" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
    </group>
  );
});

interface TerrainManagerProps {
  playerPosition: { x: number, z: number };
}

export const TerrainManager: React.FC<TerrainManagerProps> = ({ playerPosition }) => {
  // Calculate visible chunks
  const currentChunkX = Math.round(playerPosition.x / CHUNK_SIZE) * CHUNK_SIZE;
  const currentChunkZ = Math.round(playerPosition.z / CHUNK_SIZE) * CHUNK_SIZE;

  const chunks = [];
  const range = 2; 
  
  for (let xOffset = -range; xOffset <= range; xOffset++) {
    for (let zOffset = -range; zOffset <= range; zOffset++) {
      chunks.push({
        x: currentChunkX + (xOffset * CHUNK_SIZE),
        z: currentChunkZ + (zOffset * CHUNK_SIZE)
      });
    }
  }

  return (
    <group>
      {chunks.map(chunk => (
        <Chunk key={`${chunk.x},${chunk.z}`} x={chunk.x} z={chunk.z} />
      ))}
    </group>
  );
};
