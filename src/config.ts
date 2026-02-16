/**
 * Set Amazon region for Kindle MCP Server
 * Run this before using npm scripts
 */

import { readFileSync } from 'fs';

const CONFIG_FILE = './kindle-region.config.json';

export function getRegion(): string {
  try {
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    return config.region || 'com'; // Default to US
  } catch {
    return 'com'; // Default to US
  }
}

export function getRegionName(): string {
  try {
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    return config.name || 'United States';
  } catch {
    return 'United States';
  }
}
