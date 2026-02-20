/**
 * Configuration management for Kindle MCP Server
 * Supports three-tier configuration priority:
 * 1. CLI arguments (--region=co.jp) - highest priority
 * 2. Environment variables (KINDLE_REGION)
 * 3. Config file (kindle-region.config.json)
 * 4. Default value (co.jp) - fallback
 */

import { readFileSync, existsSync } from 'fs';
import type { AmazonRegion } from './types.js';

const CONFIG_FILE = './kindle-region.config.json';

/**
 * Amazon region configuration metadata
 */
export interface RegionConfig {
  /** The Amazon region code */
  region: AmazonRegion;
  /** Source of the configuration */
  source: 'cli' | 'env' | 'file' | 'default';
  /** Human-readable region name */
  name: string;
}

/**
 * Amazon region information
 */
export interface RegionInfo {
  name: string;
  url: string;
}

/**
 * The only supported Amazon region (Japan)
 */
export const REGIONS: Record<AmazonRegion, RegionInfo> = {
  'co.jp': { name: 'Japan', url: 'https://www.amazon.co.jp' },
};

/**
 * Default region
 */
export const DEFAULT_REGION: AmazonRegion = 'co.jp';

/**
 * Validate if a string is a supported Amazon region code
 */
export function isValidRegion(region: string): region is AmazonRegion {
  return region === 'co.jp';
}

/**
 * Get region information for the supported region
 */
export function getRegionInfo(region: AmazonRegion): RegionInfo {
  return REGIONS[region];
}

/**
 * Read region from config file
 * @returns Region code from config file, or null if file doesn't exist or is invalid
 */
function readConfigFile(): AmazonRegion | null {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return null;
    }
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    const region = config.region;

    if (typeof region === 'string' && isValidRegion(region)) {
      return region;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get region from environment variable
 * @returns Region code from KINDLE_REGION env var, or null if not set or invalid
 */
function readEnvVariable(): AmazonRegion | null {
  const envRegion = process.env.KINDLE_REGION;
  if (typeof envRegion === 'string' && isValidRegion(envRegion)) {
    return envRegion;
  }
  return null;
}

/**
 * Get region configuration with three-tier priority
 */
export function getRegionConfig(cliArg: string | null): RegionConfig {
  // 1. Check CLI argument (highest priority)
  if (cliArg && isValidRegion(cliArg)) {
    return {
      region: cliArg,
      source: 'cli',
      name: REGIONS[cliArg].name,
    };
  }

  // 2. Check environment variable
  const envRegion = readEnvVariable();
  if (envRegion) {
    return {
      region: envRegion,
      source: 'env',
      name: REGIONS[envRegion].name,
    };
  }

  // 3. Check config file
  const fileRegion = readConfigFile();
  if (fileRegion) {
    return {
      region: fileRegion,
      source: 'file',
      name: REGIONS[fileRegion].name,
    };
  }

  // 4. Use default value
  return {
    region: DEFAULT_REGION,
    source: 'default',
    name: REGIONS[DEFAULT_REGION].name,
  };
}

/**
 * Get a list of valid region codes
 */
export function getValidRegions(): string[] {
  return ['co.jp'];
}

/**
 * Format region configuration for logging
 */
export function formatRegionConfig(config: RegionConfig): string {
  const sourceLabel = {
    cli: 'CLI argument',
    env: 'Environment variable (KINDLE_REGION)',
    file: 'Config file (kindle-region.config.json)',
    default: 'Default',
  };
  return `${config.region} (${config.name}) [via ${sourceLabel[config.source]}]`;
}
