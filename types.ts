
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Augment the JSX namespace to include React Three Fiber elements
import { ThreeElements } from '@react-three/fiber';

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements { }
  }
}

export enum GameState {
  MENU,
  PLAYING,
  DEAD,
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  SEVERE = 'SEVERE'
}

export interface GameSettings {
  difficulty: Difficulty;
  sensitivity: number; // 0.1 to 2.0
  sound: boolean;
}

export interface PlayerStats {
  health: number;
  maxHealth: number;
  oxygen: number;
  maxOxygen: number;
  xp: number;
  level: number;
  position: { x: number; y: number; z: number };
}

export interface Meteor {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  radius: number;
  warningTime: number; // When the warning starts
  impactTime: number;  // When the meteor starts falling
  isFalling: boolean;
}

export enum CollectibleType {
  OXYGEN = 'OXYGEN',
  XP = 'XP'
}

export interface Collectible {
  id: string;
  type: CollectibleType;
  position: [number, number, number];
  value: number;
}

export enum EnemyType {
  ZOMBIE = 'ZOMBIE',
  CRAWLER = 'CRAWLER' // Future type
}

export interface Enemy {
  id: string;
  type: EnemyType;
  position: [number, number, number];
  health: number;
}

export interface Cactus {
  id: string;
  position: [number, number, number];
}

export interface SaveData {
  stats: PlayerStats;
  timestamp: number;
}
