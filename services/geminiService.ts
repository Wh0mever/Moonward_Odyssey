/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D();

export const SEED = Math.random() * 10000;

export const CHUNK_SIZE = 32;
export const CHUNK_RES = 32; // Vertices per chunk side

// Lunar terrain parameters
const SCALE_BASE = 0.02;
const AMP_BASE = 10;
const SCALE_DETAIL = 0.1;
const AMP_DETAIL = 1;
const CRATER_SCALE = 0.008;

export const getTerrainHeight = (x: number, z: number): number => {
  // Base rolling hills
  let y = noise2D(x * SCALE_BASE, z * SCALE_BASE) * AMP_BASE;
  
  // Detail
  y += noise2D(x * SCALE_DETAIL, z * SCALE_DETAIL) * AMP_DETAIL;

  // Craters (Inverted ridges)
  const craterNoise = noise2D(x * CRATER_SCALE + SEED, z * CRATER_SCALE + SEED);
  if (craterNoise > 0.6) {
    y -= (craterNoise - 0.6) * 60; // Deep craters
  }

  return y;
};

// Check if a position is in a "Death Hole"
export const isDangerZone = (y: number, x: number, z: number): boolean => {
   // If the procedural height is significantly lower than average, it's a deep chasm
   return y < -25; 
};
