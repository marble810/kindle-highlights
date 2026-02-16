#!/usr/bin/env node
/**
 * Set Amazon region for Kindle MCP Server
 * Creates a config file to store the region preference
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const CONFIG_FILE = './kindle-region.config.json';
const REGIONS = [
  { code: 'com', name: 'United States (US)', url: 'read.amazon.com/notebook' },
  { code: 'co.jp', name: 'Japan', url: 'read.amazon.co.jp/notebook' },
  { code: 'co.uk', name: 'United Kingdom', url: 'read.amazon.co.uk/notebook' },
  { code: 'de', name: 'Germany', url: 'read.amazon.de/notebook' },
  { code: 'fr', name: 'France', url: 'read.amazon.fr/notebook' },
  { code: 'es', name: 'Spain', url: 'read.amazon.es/notebook' },
  { code: 'it', name: 'Italy', url: 'read.amazon.it/notebook' },
  { code: 'ca', name: 'Canada', url: 'read.amazon.ca/notebook' },
  { code: 'com.au', name: 'Australia', url: 'read.amazon.com.au/notebook' },
  { code: 'in', name: 'India', url: 'read.amazon.in/notebook' },
  { code: 'com.mx', name: 'Mexico', url: 'read.amazon.com.mx/notebook' },
];

function setRegion(regionCode: string) {
  const region = REGIONS.find(r => r.code === regionCode);
  if (!region) {
    console.error(`Invalid region code: ${regionCode}`);
    console.error('\nAvailable regions:');
    REGIONS.forEach(r => {
      console.error(`  ${r.code.padEnd(6)} - ${r.name}`);
    });
    process.exit(1);
  }

  writeFileSync(CONFIG_FILE, JSON.stringify({ region: regionCode, name: region.name }, null, 2));
  console.log(`Amazon region set to: ${region.name} (${regionCode})`);
  console.log(`Notebook URL: https://${region.url}`);
}

function showCurrent() {
  if (!existsSync(CONFIG_FILE)) {
    console.log('No region configured. Using default: United States (com)');
    return;
  }

  const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  console.log(`Current region: ${config.name} (${config.region})`);
}

function showHelp() {
  console.log('Amazon Region Configuration for Kindle MCP Server\n');
  console.log('Usage: node tools/set-region.js <region-code>\n');
  console.log('Available regions:');
  REGIONS.forEach(r => {
    console.log(`  ${r.code.padEnd(6)} - ${r.name}`);
  });
}

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'set':
    if (args[1]) {
      setRegion(args[1]);
    } else {
      console.error('Error: Region code required');
      console.error('Usage: node tools/set-region.js set <region-code>');
      showHelp();
      process.exit(1);
    }
    break;

  case 'show':
    showCurrent();
    break;

  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;

  default:
    if (!command) {
      showCurrent();
    } else {
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
    }
}

process.exit(0);
