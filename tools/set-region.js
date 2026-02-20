#!/usr/bin/env node
/**
 * Set Amazon region for Kindle MCP Server
 * This project supports co.jp only.
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';

const CONFIG_FILE = './kindle-region.config.json';
const ONLY_REGION = { code: 'co.jp', name: 'Japan', url: 'read.amazon.co.jp/notebook' };

function setRegion(regionCode: string) {
  if (regionCode !== ONLY_REGION.code) {
    console.error(`Invalid region code: ${regionCode}`);
    console.error(`Only supported region: ${ONLY_REGION.code} (${ONLY_REGION.name})`);
    process.exit(1);
  }

  writeFileSync(CONFIG_FILE, JSON.stringify({ region: ONLY_REGION.code, name: ONLY_REGION.name }, null, 2));
  console.log(`Amazon region set to: ${ONLY_REGION.name} (${ONLY_REGION.code})`);
  console.log(`Notebook URL: https://${ONLY_REGION.url}`);
}

function showCurrent() {
  if (!existsSync(CONFIG_FILE)) {
    console.log(`No region configured. Using default: ${ONLY_REGION.name} (${ONLY_REGION.code})`);
    return;
  }

  const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  console.log(`Current region: ${config.name} (${config.region})`);
}

function showHelp() {
  console.log('Amazon Region Configuration for Kindle MCP Server\n');
  console.log('Usage: node tools/set-region.js set co.jp\n');
  console.log(`Supported region: ${ONLY_REGION.code} - ${ONLY_REGION.name}`);
}

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'set':
    if (args[1]) {
      setRegion(args[1]);
    } else {
      console.error('Error: Region code required');
      console.error('Usage: node tools/set-region.js set co.jp');
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
