import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Project Setup Verification', () => {
  const rootDir = process.cwd();

  describe('Configuration Files', () => {
    it('should have package.json', () => {
      const packagePath = join(rootDir, 'package.json');
      expect(existsSync(packagePath)).toBe(true);
    });

    it('should have tsconfig.json', () => {
      const tsconfigPath = join(rootDir, 'tsconfig.json');
      expect(existsSync(tsconfigPath)).toBe(true);
    });

    it('should have .gitignore', () => {
      const gitignorePath = join(rootDir, '.gitignore');
      expect(existsSync(gitignorePath)).toBe(true);
    });
  });

  describe('Package.json Structure', () => {
    const packagePath = join(rootDir, 'package.json');
    const packageContent = JSON.parse(readFileSync(packagePath, 'utf-8'));

    it('should have required scripts', () => {
      const requiredScripts = ['build', 'dev', 'test', 'login'];
      requiredScripts.forEach(script => {
        expect(packageContent.scripts).toHaveProperty(script);
      });
    });

    it('should have MCP SDK dependency', () => {
      expect(packageContent.dependencies).toHaveProperty('@modelcontextprotocol/sdk');
    });

    it('should have playwright dependency', () => {
      expect(packageContent.dependencies).toHaveProperty('playwright');
    });

    it('should be configured as ES module', () => {
      expect(packageContent.type).toBe('module');
    });
  });

  describe('Security Configuration (.gitignore)', () => {
    const gitignorePath = join(rootDir, '.gitignore');
    const gitignoreContent = readFileSync(gitignorePath, 'utf-8');

    it('should ignore browser profile directory', () => {
      expect(gitignoreContent).toContain('kindle-mcp-profile/');
    });

    it('should ignore environment variables', () => {
      expect(gitignoreContent).toContain('.env');
    });

    it('should ignore build output', () => {
      expect(gitignoreContent).toContain('dist/');
    });

    it('should ignore node_modules', () => {
      expect(gitignoreContent).toContain('node_modules/');
    });
  });

  describe('TypeScript Configuration', () => {
    const tsconfigPath = join(rootDir, 'tsconfig.json');
    const tsconfigContent = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    it('should target ES2022', () => {
      expect(tsconfigContent.compilerOptions.target).toBe('ES2022');
    });

    it('should use NodeNext module resolution', () => {
      expect(tsconfigContent.compilerOptions.moduleResolution).toBe('NodeNext');
    });

    it('should output to dist directory', () => {
      expect(tsconfigContent.compilerOptions.outDir).toBe('./dist');
    });

    it('should have strict mode enabled', () => {
      expect(tsconfigContent.compilerOptions.strict).toBe(true);
    });
  });
});
