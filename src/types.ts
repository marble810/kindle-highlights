/**
 * Core TypeScript interfaces for Kindle MCP Server
 * Phase 2: Type Definitions
 */

/**
 * Amazon regions/endpoints available for Kindle
 */
export type AmazonRegion =
  | 'com'    // US (amazon.com)
  | 'co.jp'   // Japan (amazon.co.jp)
  | 'co.uk'   // UK (amazon.co.uk)
  | 'de'      // Germany (amazon.de)
  | 'fr'      // France (amazon.fr)
  | 'es'      // Spain (amazon.es)
  | 'it'      // Italy (amazon.it)
  | 'ca'      // Canada (amazon.ca)
  | 'com.au'  // Australia (amazon.com.au)
  | 'in'      // India (amazon.in)
  | 'com.mx'; // Mexico (amazon.com.mx)

/**
 * Get base URL for Amazon region
 */
export function getAmazonBaseUrl(region: AmazonRegion): string {
  return `https://www.amazon.${region}`;
}

/**
 * Get Kindle Notebook URL for Amazon region
 */
export function getNotebookUrl(region: AmazonRegion): string {
  return `https://read.amazon.${region}/notebook`;
}

/**
 * Highlight color options available in Kindle
 * Note: Kindle supports 5 highlight colors
 */
export type HighlightColor = 'yellow' | 'blue' | 'pink' | 'orange' | 'purple';

/**
 * Single highlight/note entry from Kindle
 */
export interface KindleHighlight {
  /** The highlighted text content */
  text: string;
  /** User's note attached to the highlight, null if no note */
  note: string | null;
  /** Highlight color */
  color: HighlightColor;
  /** Location in the book (e.g., "Loc 345") */
  location: string;
}

/**
 * Complete book data with metadata and highlights
 */
export interface KindleBookData {
  /** Book title */
  title: string;
  /** Book author */
  author: string;
  /** Array of highlights and notes */
  highlights: KindleHighlight[];
}

/**
 * Arguments for fetch_notes tool
 */
export interface FetchNotesArgs {
  /** Number of recent books to fetch (default: 1) */
  limit?: number;
  /** Maximum highlights per book to prevent token overflow */
  maxHighlights?: number;
}

/**
 * Browser configuration options
 */
export interface BrowserConfig {
  /** Run browser in headless mode */
  headless: boolean;
  /** Path to user data directory for persistent session */
  userDataDir: string;
  /** Additional browser launch arguments */
  args?: string[];
}

/**
 * Custom error types for better error handling
 */
export class AuthError extends Error {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthError';
  }
}

export class SelectorError extends Error {
  constructor(selector: string) {
    super(`Selector not found: ${selector}`);
    this.name = 'SelectorError';
  }
}

export class ScrapingError extends Error {
  constructor(message: string) {
    super(`Scraping failed: ${message}`);
    this.name = 'ScrapingError';
  }
}

/**
 * Result type for scraping operations
 */
export interface ScrapingResult<T> {
  /** Whether the operation was successful */
  success: boolean;
  /** The data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
}
