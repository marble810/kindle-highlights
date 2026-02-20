/**
 * Core TypeScript interfaces for Kindle MCP Server
 * Phase 2: Type Definitions
 */

/**
 * Amazon region/endpoints available for Kindle.
 * This project currently supports only Japan (co.jp).
 */
export type AmazonRegion = 'co.jp';

/**
 * Get base URL for Amazon region
 */
export function getAmazonBaseUrl(region: AmazonRegion): string {
  return `https://www.amazon.${region}`;
}

/**
 * Get Kindle Notebook URL for Amazon region
 */
export function getNotebookUrl(region: AmazonRegion, language: string = 'en_US'): string {
  return `https://read.amazon.${region}/notebook?ref_=kcr_notebook_lib&language=${language}`;
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

/**
 * Session refresh result
 */
export interface SessionRefreshResult {
  /** Whether refresh was successful */
  success: boolean;
  /** Method used for refresh */
  method: 'cookie_refresh' | 'homepage_visit' | 'failed';
  /** Result message */
  message: string;
}

/**
 * Login tool return result
 */
export interface LoginToolResult {
  /** Whether browser was successfully opened */
  success: boolean;
  /** Login status */
  status: 'browser_opened' | 'already_opened' | 'failed';
  /** Detailed login phase */
  phase?: 'waiting_manual_login' | 'failed';
  /** Optional diagnostic details for login flow */
  details?: {
    openedAt?: string;
    existingSessionRegion?: AmazonRegion;
  };
  /** Status message */
  message: string;
  /** Amazon region */
  region: AmazonRegion;
}

export type LoginAction = 'none' | 'run_login' | 'retry_later';

/**
 * check_login_status tool return result
 */
export interface LoginStatusToolResult {
  /** Whether status check ran successfully */
  success: boolean;
  /** High-level status of auth readiness */
  status: 'ready' | 'main_only' | 'needs_login' | 'failed';
  /** Next recommended action */
  action: LoginAction;
  /** Probe details */
  details: {
    mainLoggedIn: boolean;
    webReaderReady: boolean;
    mainProbeUrl: string;
    webReaderProbeUrl: string;
    initialUrl?: string;
    finalUrl?: string;
    redirectCount?: number;
    stabilizationMs?: number;
    usedStorageState?: boolean;
  };
  /** Status message */
  message: string;
  /** Amazon region */
  region: AmazonRegion;
}

/**
 * Result reasons for headed fallback repair.
 */
export type HeadedRepairReason =
  | 'ready'
  | 'signin'
  | 'captcha'
  | 'timeout'
  | 'error'
  | 'unknown';

/**
 * Request payload for the headed repair worker.
 */
export interface HeadedRepairRequest {
  region: AmazonRegion;
  userDataDir: string;
  args: string[];
  authStatePath: string;
  readNavigationTimeoutMs: number;
  repairNavigationTimeoutMs: number;
  closeDelayMs: number;
}

/**
 * Result payload returned by the headed repair worker.
 */
export interface HeadedRepairResult {
  success: boolean;
  reason: HeadedRepairReason;
  message: string;
  initialUrl?: string;
  finalUrl?: string;
  redirectCount?: number;
  stabilizationMs?: number;
}

/**
 * Inbound worker message sent by parent process.
 */
export interface HeadedRepairWorkerInboundMessage {
  type: 'run';
  payload: HeadedRepairRequest;
}

/**
 * Outbound worker message emitted by child process.
 */
export interface HeadedRepairWorkerOutboundMessage {
  type: 'result';
  payload: HeadedRepairResult;
}
