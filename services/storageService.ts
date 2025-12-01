
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { PlayerStats, SaveData } from '../types';

const STORAGE_KEY = 'LUNAR_SURVIVAL_SAVE_V1';

export const saveGame = (stats: PlayerStats) => {
  try {
    const data: SaveData = {
      stats,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save game", e);
  }
};

export const loadGame = (): PlayerStats | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    
    const data: SaveData = JSON.parse(raw);
    return data.stats;
  } catch (e) {
    console.error("Failed to load game", e);
    return null;
  }
};

export const clearSave = () => {
  localStorage.removeItem(STORAGE_KEY);
};
