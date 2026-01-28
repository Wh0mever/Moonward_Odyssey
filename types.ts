/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum GameState {
  MENU,
  PLAYING,
  PAUSED,
  DEAD,
  TUTORIAL,
  VICTORY
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
  brightness: number; // 0.05 to 1.0
}

export interface PlayerStats {
  health: number;
  maxHealth: number;
  oxygen: number;
  maxOxygen: number;
  stamina: number;
  maxStamina: number;
  xp: number;
  level: number;
  ammo: number;
  fuel: number;
  artifacts: number;
  position: { x: number; y: number; z: number };
}

export enum MeteorState {
  TARGETING,
  FALLING
}

export interface Meteor {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  radius: number;
  state: MeteorState;
  impactTime: number;
  targetPos: { x: number, z: number };
}

export enum CollectibleType {
  OXYGEN = 'OXYGEN',
  XP = 'XP',
  AMMO = 'AMMO',
  FUEL = 'FUEL',
  ARTIFACT = 'ARTIFACT'
}

export interface Collectible {
  id: string;
  type: CollectibleType;
  position: [number, number, number];
  value: number;
  artifactId?: number; // 0-3 for the 4 logos
}

export enum EnemyType {
  ZOMBIE = 'ZOMBIE',
  SPIDER = 'SPIDER'
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