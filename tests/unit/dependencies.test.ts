import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Dependencies Verification', () => {
  const rootDir = process.cwd();
  const packagePath = join(rootDir, 'package.json');
  const packageContent = JSON.parse(readFileSync(packagePath, 'utf-8'));

  describe('Package.json Dependencies', () => {
    it('should have @modelcontextprotocol/sdk in dependencies', () => {
      expect(packageContent.dependencies).toHaveProperty('@modelcontextprotocol/sdk');
    });

    it('should have playwright in dependencies', () => {
      expect(packageContent.dependencies).toHaveProperty('playwright');
    });

    it('should have playwright-extra in dependencies', () => {
      expect(packageContent.dependencies).toHaveProperty('playwright-extra');
    });

    it('should have puppeteer-extra-plugin-stealth in dependencies', () => {
      expect(packageContent.dependencies).toHaveProperty('puppeteer-extra-plugin-stealth');
    });

    it('should have zod in dependencies', () => {
      expect(packageContent.dependencies).toHaveProperty('zod');
    });

    it('should have winston in dependencies', () => {
      expect(packageContent.dependencies).toHaveProperty('winston');
    });

    it('should have dotenv in dependencies', () => {
      expect(packageContent.dependencies).toHaveProperty('dotenv');
    });
  });

  describe('DevDependencies', () => {
    it('should have typescript in devDependencies', () => {
      expect(packageContent.devDependencies).toHaveProperty('typescript');
    });

    it('should have vitest in devDependencies', () => {
      expect(packageContent.devDependencies).toHaveProperty('vitest');
    });

    it('should have tsx in devDependencies', () => {
      expect(packageContent.devDependencies).toHaveProperty('tsx');
    });
  });

  describe('Playwright Browser', () => {
    it('should be able to launch Chromium', async () => {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      expect(browser).toBeDefined();
      await browser.close();
    }, 30000);
  });
});
