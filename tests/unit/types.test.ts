/**
 * Type Definition Unit Tests
 * Phase 2: Verify TypeScript interfaces are correctly defined
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type HighlightColor,
  // Interfaces
  type KindleHighlight,
  type KindleBookData,
  type FetchNotesArgs,
  type BrowserConfig,
  type ScrapingResult,
  // Error Classes
  AuthError,
  SelectorError,
  ScrapingError,
} from '../../src/types';

describe('Type Definitions', () => {
  describe('HighlightColor', () => {
    it('should accept valid highlight colors', () => {
      const validColors: HighlightColor[] = ['yellow', 'blue', 'pink', 'orange'];
      expect(validColors).toHaveLength(4);
    });
  });

  describe('KindleHighlight Interface', () => {
    it('should create a valid highlight object', () => {
      const highlight: KindleHighlight = {
        text: 'This is a highlighted passage',
        note: 'My personal note about this highlight',
        color: 'yellow',
        location: 'Loc 123',
      };

      expect(highlight.text).toBe('This is a highlighted passage');
      expect(highlight.note).toBe('My personal note about this highlight');
      expect(highlight.color).toBe('yellow');
      expect(highlight.location).toBe('Loc 123');
    });

    it('should allow null note', () => {
      const highlight: KindleHighlight = {
        text: 'Highlighted text without note',
        note: null,
        color: 'blue',
        location: 'Loc 456',
      };

      expect(highlight.note).toBeNull();
    });
  });

  describe('KindleBookData Interface', () => {
    it('should create a valid book data object', () => {
      const bookData: KindleBookData = {
        title: 'The Test Book',
        author: 'John Doe',
        coverUrl: 'https://example.com/cover.jpg',
        lastAccessed: '2024-01-15T10:30:00Z',
        highlights: [
          {
            text: 'First highlight',
            note: null,
            color: 'yellow',
            location: 'Loc 10',
          },
        ],
      };

      expect(bookData.title).toBe('The Test Book');
      expect(bookData.author).toBe('John Doe');
      expect(bookData.highlights).toHaveLength(1);
      expect(bookData.highlights[0].text).toBe('First highlight');
    });
  });

  describe('FetchNotesArgs Interface', () => {
    it('should accept valid arguments with all fields', () => {
      const args: FetchNotesArgs = {
        limit: 5,
        maxHighlights: 50,
      };

      expect(args.limit).toBe(5);
      expect(args.maxHighlights).toBe(50);
    });

    it('should work with partial arguments', () => {
      const args1: FetchNotesArgs = { limit: 3 };
      const args2: FetchNotesArgs = { maxHighlights: 100 };
      const args3: FetchNotesArgs = {};

      expect(args1.limit).toBe(3);
      expect(args2.maxHighlights).toBe(100);
      expect(args3).toEqual({});
    });
  });

  describe('BrowserConfig Interface', () => {
    it('should create valid browser configuration', () => {
      const config: BrowserConfig = {
        headless: true,
        userDataDir: './kindle-mcp-profile',
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      };

      expect(config.headless).toBe(true);
      expect(config.userDataDir).toBe('./kindle-mcp-profile');
      expect(config.args).toHaveLength(2);
    });
  });

  describe('ScrapingResult Interface', () => {
    it('should represent successful result', () => {
      const successResult: ScrapingResult<KindleBookData[]> = {
        success: true,
        data: [],
      };

      expect(successResult.success).toBe(true);
      expect(successResult.data).toEqual([]);
    });

    it('should represent failed result', () => {
      const failedResult: ScrapingResult<KindleBookData[]> = {
        success: false,
        error: 'Failed to scrape data',
      };

      expect(failedResult.success).toBe(false);
      expect(failedResult.error).toBe('Failed to scrape data');
    });
  });

  describe('Error Classes', () => {
    describe('AuthError', () => {
      it('should create error with default message', () => {
        const error = new AuthError();
        expect(error.name).toBe('AuthError');
        expect(error.message).toBe('Authentication failed');
      });

      it('should create error with custom message', () => {
        const error = new AuthError('Session expired');
        expect(error.message).toBe('Session expired');
      });
    });

    describe('SelectorError', () => {
      it('should create error with selector name', () => {
        const error = new SelectorError('.book-title');
        expect(error.name).toBe('SelectorError');
        expect(error.message).toBe('Selector not found: .book-title');
      });
    });

    describe('ScrapingError', () => {
      it('should create error with message', () => {
        const error = new ScrapingError('Timeout waiting for page');
        expect(error.name).toBe('ScrapingError');
        expect(error.message).toBe('Scraping failed: Timeout waiting for page');
      });
    });
  });
});
