/**
 * Browser Automation for Kindle MCP Server
 * Phase 3: Browser Automation - Playwright wrapper with login & scraping logic
 * REFACTORED: New login flow - open homepage, let user manually click to login page
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { fork } from 'child_process';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

// Get absolute path to project root (for userDataDir)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);  // Go up from src/ to project root
import type {
  BrowserConfig,
  KindleBookData,
  KindleHighlight,
  HighlightColor,
  ScrapingResult,
  AmazonRegion,
  SessionRefreshResult,
  LoginToolResult,
  LoginStatusToolResult,
  HeadedRepairRequest,
  HeadedRepairResult,
  HeadedRepairWorkerInboundMessage,
  HeadedRepairWorkerOutboundMessage,
} from './types.js';
import {
  AuthError,
  ScrapingError,
  getAmazonBaseUrl,
  getNotebookUrl,
} from './types.js';

// Default Amazon region
const DEFAULT_REGION: AmazonRegion = 'co.jp'; // Japan

// Default configuration
const DEFAULT_CONFIG: BrowserConfig = {
  headless: true,
  userDataDir: join(PROJECT_ROOT, 'kindle-mcp-profile'),
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
};

// Selectors type
type Selectors = {
  bookTitle: string;
  bookAuthor: string;
  highlightContainer: string;
  highlightText: string;
  noteText: string;
  location: string;
  colorClassPrefix: string;
};

// Selectors for Kindle Notebook page
const SELECTORS: Selectors = {
  bookTitle: 'h3.kp-notebook-metadata',
  bookAuthor: 'p.kp-notebook-searchable',
  highlightContainer: '.a-spacing-base',
  highlightText: '#highlight',
  noteText: '#note',
  location: '.a-size-small.a-color-secondary',
  colorClassPrefix: 'kp-notebook-highlight-',
};

const PROBE_TIMEOUT_MS = 10000;
const AUTH_STABILIZATION_TIMEOUT_MS = 12000;
const AUTH_STABILIZATION_POLL_INTERVAL_MS = 500;
const AUTH_STABILIZATION_REQUIRED_STREAK = 2;
const AUTH_STATE_FILE_PREFIX = 'auth-state';
const READ_NAVIGATION_TIMEOUT_MS = 30000;
const REPAIR_NAVIGATION_TIMEOUT_MS = 15000;
const HEADED_REPAIR_CLOSE_DELAY_MS = 5000;
const HEADED_REPAIR_WORKER_TIMEOUT_MS = 90000;
const HEADED_REPAIR_EXIT_GRACE_MS = 1500;
const SESSION_EXPIRED_ERROR_MESSAGE = 'Session expired or not logged in. Please run `npm run login:jp` to authenticate.';

type AuthStabilityDiagnostics = {
  initialUrl: string;
  finalUrl: string;
  redirectCount: number;
  stabilizationMs: number;
};

type AuthProbeResult = {
  loggedIn: boolean;
  url: string;
  diagnostics?: AuthStabilityDiagnostics;
  usedStorageState?: boolean;
};

type SessionEnsureResult = {
  ready: boolean;
  method: 'direct_read' | 'fallback_repair';
  attemptedFallback: boolean;
  requiresContextReload: boolean;
};

type SessionFallbackMode = 'none' | 'headless' | 'headed';

type ActiveLoginSession = {
  region: AmazonRegion;
  openedAt: number;
  browserManager: BrowserManager;
  context: BrowserContext;
  closed: Promise<void>;
};

let activeLoginSession: ActiveLoginSession | null = null;

function getAuthStatePath(region: AmazonRegion): string {
  return join(DEFAULT_CONFIG.userDataDir, `${AUTH_STATE_FILE_PREFIX}.${region}.json`);
}

function resolveStoredStatePath(region: AmazonRegion): string | null {
  const path = getAuthStatePath(region);
  return existsSync(path) ? path : null;
}

async function saveStorageState(context: BrowserContext, region: AmazonRegion): Promise<string> {
  const authStatePath = getAuthStatePath(region);
  await mkdir(dirname(authStatePath), { recursive: true });
  await context.storageState({ path: authStatePath });
  return authStatePath;
}

async function launchHeadlessContextWithStorageState(
  region: AmazonRegion
): Promise<{ browser: Browser; context: BrowserContext; usedStorageState: boolean }> {
  const storedStatePath = resolveStoredStatePath(region);
  const browser = await chromium.launch({
    headless: true,
    args: [...(DEFAULT_CONFIG.args || []), '--lang=en-US'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
    ...(storedStatePath ? { storageState: storedStatePath } : {}),
  });

  return {
    browser,
    context,
    usedStorageState: Boolean(storedStatePath),
  };
}

async function closeHeadlessBrowserSafely(browser: Browser): Promise<void> {
  await browser.close().catch(() => {
    // ignore close errors in probe cleanup
  });
}

/**
 * Browser Manager class for handling Playwright lifecycle
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private config: BrowserConfig;
  private region: AmazonRegion;
  private isPersistentContext: boolean = false;

  constructor(config: Partial<BrowserConfig> = {}, region: AmazonRegion = DEFAULT_REGION) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.region = region;
  }

  /**
   * Launch browser with persistent context
   */
  async launch(): Promise<void> {
    try {
      // Use launchPersistentContext when userDataDir is specified
      if (this.config.userDataDir) {
        this.isPersistentContext = true;
        this.context = await chromium.launchPersistentContext(this.config.userDataDir, {
          headless: this.config.headless,
          args: [...(this.config.args || []), '--lang=en-US'],
          viewport: { width: 1280, height: 720 },
          locale: 'en-US',
          extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        // Persistent context doesn't have a separate browser instance
        this.browser = null;
        console.error(`[Browser] Launched persistent context for region: ${this.region}`);
        console.error(`[Browser] Session will be saved to: ${this.config.userDataDir}`);
      } else {
        this.browser = await chromium.launch({
          headless: this.config.headless,
          args: [...(this.config.args || []), '--lang=en-US'],
        });

        this.context = await this.browser.newContext({
          viewport: { width: 1280, height: 720 },
          locale: 'en-US',
          extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        console.error(`[Browser] Launched successfully for region: ${this.region}`);
      }
    } catch (error) {
      throw new ScrapingError(`Failed to launch browser: ${error}`);
    }
  }

  /**
   * Get new page from context
   */
  async newPage(): Promise<Page> {
    if (!this.context) {
      throw new ScrapingError('Browser context not initialized');
    }
    return this.context.newPage();
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      console.error('[Browser] Closed successfully');
    } catch (error) {
      console.error('[Browser] Error during close:', error);
    }
  }

  /**
   * Get current Amazon region
   */
  getRegion(): AmazonRegion {
    return this.region;
  }

  /**
   * Get the browser context (for event listening in login flow)
   */
  getContext(): BrowserContext | null {
    return this.context;
  }
}

/**
 * Scraper class for extracting Kindle notes
 */
export class KindleScraper {
  private page: Page | null = null;
  private region: AmazonRegion;

  constructor(private browserManager: BrowserManager, region: AmazonRegion = DEFAULT_REGION) {
    this.region = region;
  }

  /**
   * Navigate to Kindle Notebook page
   */
  async navigateToNotebook(): Promise<void> {
    this.page = await this.browserManager.newPage();

    try {
      // Navigate to Notebook with extended timeout
      const notebookUrl = getNotebookUrl(this.region);
      console.error(`[Scraper] Navigating to: ${notebookUrl}`);
      await this.page.goto(notebookUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      const authState = await resolveAuthStateWithStabilization(this.page);
      const diagnostics = authState.diagnostics;
      console.error(
        `[Scraper] Auth stabilization: initial=${diagnostics.initialUrl} final=${diagnostics.finalUrl} redirects=${diagnostics.redirectCount} durationMs=${diagnostics.stabilizationMs}`
      );

      if (!authState.loggedIn) {
        throw new AuthError(SESSION_EXPIRED_ERROR_MESSAGE);
      }

      // Wait for content to load
      await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        // Networkidle timeout is acceptable, continue
      });

      console.error(`[Scraper] Navigation successful for region: ${this.region}`);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new ScrapingError(`Failed to navigate: ${error}`);
    }
  }

  /**
   * Extract book data from current page
   * @param authorOverride - Optional author name from sidebar data (more reliable than DOM)
   */
  async extractBookData(authorOverride?: string): Promise<ScrapingResult<KindleBookData>> {
    if (!this.page) {
      return { success: false, error: 'Page not initialized' };
    }

    try {
      // Log current page info for debugging
      const currentUrl = this.page.url();
      console.error(`[Scraper] Extracting data from: ${currentUrl}`);

      // Extract book metadata
      const title = await this.safeGetText(SELECTORS.bookTitle);
      // If authorOverride is provided, use it; otherwise extract from DOM and clean up prefix
      let author = authorOverride;
      if (!author) {
        const rawAuthor = await this.safeGetText(SELECTORS.bookAuthor);
        // Handle both English "By: Author" and Japanese "作者: Author" formats
        author = rawAuthor.replace(/^(创建者|著者|By:)[:：]?\s*/, '').trim();
      }

      if (!title) {
        // Enhanced error info - diagnose page structure
        const pageTitle = await this.page.title();
        console.error(`[Scraper] Could not find book title. Page title: "${pageTitle}"`);
        console.error(`[Scraper] Selector used: ${SELECTORS.bookTitle}`);
        console.error(`[Scraper] Current URL: ${currentUrl}`);

        // Output page structure for diagnosis
        const bodyText = await this.page.evaluate(() => {
          return document.body?.innerText?.substring(0, 500) || 'No body content';
        });
        console.error(`[Scraper] Page body preview: ${bodyText}`);

        // Try to find any h2 element
        const h2Count = await this.page.evaluate(() => {
          return document.querySelectorAll('h2').length;
        });
        console.error(`[Scraper] Found ${h2Count} h2 elements on page`);

        return {
          success: false,
          error: `Could not find book title. Page: "${pageTitle}". Selector: ${SELECTORS.bookTitle}`,
        };
      }

      // Extract highlights
      const highlights = await this.extractHighlights();

      const bookData: KindleBookData = {
        title: title.trim(),
        author: author.trim() || 'Unknown Author',
        highlights,
      };

      console.error(`[Scraper] Extracted ${highlights.length} highlights from "${bookData.title}"`);

      return { success: true, data: bookData };
    } catch (error) {
      return {
        success: false,
        error: `Extraction failed: ${error}`,
      };
    }
  }

  /**
   * Extract all highlights from page
   */
  private async extractHighlights(): Promise<KindleHighlight[]> {
    if (!this.page) return [];

    // Define inline types for evaluate function
    interface EvaluateArgs {
      selectors: Selectors;
      colorPrefix: string;
    }

    // Execute extraction function inside browser context
    const highlights = await this.page.evaluate(
      (args: EvaluateArgs) => {
        const containers = document.querySelectorAll(args.selectors.highlightContainer);
        const results: KindleHighlight[] = [];

        containers.forEach((container: Element) => {
          // Extract highlight text
          const highlightEl = container.querySelector(args.selectors.highlightText);
          const text = highlightEl?.textContent?.trim() || '';

          if (!text) return; // Skip empty highlights

          // Extract note
          const noteEl = container.querySelector(args.selectors.noteText);
          const note = noteEl?.textContent?.trim() || null;

          // Extract location
          const locationEl = container.querySelector(args.selectors.location);
          const locationText = locationEl?.textContent?.trim() || '';
          // Extract "Loc X" or "Page X" from text
          const locationMatch = locationText.match(/(Loc|Page)\s*\d+/i);
          const location = locationMatch ? locationMatch[0] : locationText;

          // Determine highlight color from class names
          let color: HighlightColor = 'yellow'; // default
          const classList = container.className;
          if (classList.includes(`${args.colorPrefix}yellow`)) color = 'yellow';
          else if (classList.includes(`${args.colorPrefix}blue`)) color = 'blue';
          else if (classList.includes(`${args.colorPrefix}pink`)) color = 'pink';
          else if (classList.includes(`${args.colorPrefix}orange`)) color = 'orange';
          else if (classList.includes(`${args.colorPrefix}purple`)) color = 'purple';

          results.push({ text, note, color, location });
        });

        return results;
      },
      { selectors: SELECTORS, colorPrefix: SELECTORS.colorClassPrefix }
    );

    return highlights;
  }

  /**
   * Safely get text content from element
   */
  private async safeGetText(selector: string): Promise<string> {
    if (!this.page) return '';
    try {
      const element = await this.page.$(selector);
      if (!element) return '';
      return (await element.textContent()) || '';
    } catch {
      return '';
    }
  }

  /**
   * Get list of all books from left sidebar
   */
  async getBookList(): Promise<{ asin: string; title: string; author: string }[]> {
    if (!this.page) {
      return [];
    }

    try {
      const books = await this.page.evaluate(() => {
        const bookItems = document.querySelectorAll('.kp-notebook-library-each-book');
        return Array.from(bookItems).map(item => {
          const clickableEl = item.querySelector('[data-action="get-annotations-for-asin"]');
          const text = clickableEl?.textContent?.trim() || '';
          // Parse text like "Book TitleBy: Author" (English) or "Book Title作者: Author" (Japanese)
          // Match "By:" prefix followed by author name at the end of the text
          const byMatch = text.match(/By:\s*(.+)$/);
          if (byMatch) {
            // English format: "Book TitleBy: Author"
            const title = text.substring(0, byMatch.index).trim();
            const author = byMatch[1].trim();
            return {
              asin: item.id,
              title,
              author,
            };
          }
          // Fallback for Japanese format: "Book Title作者: Author"
          const parts = text.split(/创建者|著者/);
          const title = parts[0]?.trim() || '';
          const author = parts[1]?.replace(/^[:：]\s*/, '').trim() || '';
          return {
            asin: item.id,
            title,
            author,
          };
        });
      });

      console.error(`[Scraper] Found ${books.length} books in sidebar`);
      return books;
    } catch (error) {
      console.error(`[Scraper] Failed to get book list:`, error);
      return [];
    }
  }

  /**
   * Select a book by clicking on it in the sidebar
   */
  async selectBook(asin: string): Promise<boolean> {
    if (!this.page) {
      return false;
    }

    try {
      const selector = `#${asin} [data-action="get-annotations-for-asin"]`;
      const element = await this.page.$(selector);

      if (!element) {
        console.error(`[Scraper] Book with ASIN ${asin} not found`);
        return false;
      }

      // Get initial highlight count for comparison
      const initialCount = await this.page.evaluate(() => {
        const items = document.querySelectorAll('#kp-notebook-annotations .a-spacing-base');
        return items.length;
      });
      console.error(`[Scraper] Initial highlight count: ${initialCount}`);

      console.error(`[Scraper] Clicking on book ${asin}...`);

      // Wait for the AJAX request that loads the book's annotations
      const requestPromise = this.page.waitForResponse(
        (response) => response.url().includes('notebook') && response.url().includes(`asin=${asin}`),
        { timeout: 15000 }
      );

      await element.click();

      // Wait for the AJAX request to complete
      await requestPromise.catch(() => {
        console.error(`[Scraper] AJAX request timeout, continuing...`);
      });

      // Wait for content to render
      await this.page.waitForTimeout(3000);

      // Verify content has changed
      const newCount = await this.page.evaluate(() => {
        const items = document.querySelectorAll('#kp-notebook-annotations .a-spacing-base');
        return items.length;
      });
      console.error(`[Scraper] New highlight count: ${newCount}`);

      // Get the current book title for verification
      const title = await this.page.evaluate(() => {
        // Try to find the title in the sidebar (the selected book should be visually distinguished)
        const selectedBook = document.querySelector('.kp-notebook-library-each-book.kp-notebook-selected') ||
                            document.querySelector('#kp-notebook-library .a-text-bold');
        if (!selectedBook) return 'Unknown';
        const text = selectedBook.textContent || '';
        // Handle both English "By: Author" and Japanese "作者: Author" formats
        const byMatch = text.match(/^(.+?)By:/);
        if (byMatch) {
          return byMatch[1].trim();
        }
        // Fallback to Japanese format
        return text.split(/创建者|著者/)[0]?.trim() || 'Unknown';
      });
      console.error(`[Scraper] Selected book title: ${title}`);

      console.error(`[Scraper] Successfully selected book ${asin}`);
      return true;
    } catch (error) {
      console.error(`[Scraper] Failed to select book:`, error);
      return false;
    }
  }

  /**
   * Close scraper page
   */
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
  }
}

/**
 * Get user-friendly login instructions for a region
 */
export function getLoginInstructions(region: AmazonRegion): string {
  const regionName = '日本站';
  const loginScript = 'npm run login:jp';

  return `
╔══════════════════════════════════════════════════════════╗
║  🔐 需要登录 Amazon ${regionName}                        ║
╚══════════════════════════════════════════════════════════╝

您的 session 已过期或尚未登录。请运行以下命令：

  ${loginScript}

这将打开浏览器，请按照提示完成登录。
登录成功后，session 会自动保存，之后可以正常使用。

💡 提示：
  • Session 通常可以保持数天到数周
  • 如果频繁过期，可能是 Amazon 的安全策略
  • 建议定期（如每周）重新登录一次

📚️ 详细文档：docs_archived/SESSION_EXPIRY_ISSUE.md
  `;
}

function logAuthStateDiagnostics(prefix: string, diagnostics: AuthStabilityDiagnostics): void {
  console.error(
    `${prefix} initial=${diagnostics.initialUrl} final=${diagnostics.finalUrl} redirects=${diagnostics.redirectCount} durationMs=${diagnostics.stabilizationMs}`
  );
}

function isHeadedRepairWorkerResult(
  message: unknown
): message is HeadedRepairWorkerOutboundMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }
  const maybe = message as { type?: unknown; payload?: unknown };
  return maybe.type === 'result' && typeof maybe.payload === 'object' && maybe.payload !== null;
}

async function terminateDetachedProcessTree(
  pid: number | undefined,
  fallbackKill: () => void
): Promise<void> {
  if (!pid) {
    fallbackKill();
    return;
  }

  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    fallbackKill();
  }
}

async function runHeadedFallbackRepair(region: AmazonRegion): Promise<HeadedRepairResult> {
  const workerPath = join(__dirname, 'repair-worker.js');
  const payload: HeadedRepairRequest = {
    region,
    userDataDir: DEFAULT_CONFIG.userDataDir,
    args: DEFAULT_CONFIG.args || [],
    authStatePath: getAuthStatePath(region),
    readNavigationTimeoutMs: READ_NAVIGATION_TIMEOUT_MS,
    repairNavigationTimeoutMs: REPAIR_NAVIGATION_TIMEOUT_MS,
    closeDelayMs: HEADED_REPAIR_CLOSE_DELAY_MS,
  };

  console.error(`[Headed Repair] Starting worker for region: ${region}`);

  return new Promise((resolve) => {
    const worker = fork(workerPath, [], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });

    let settled = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const finalize = (result: HeadedRepairResult, forceKill: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);

      if (forceKill) {
        void terminateDetachedProcessTree(worker.pid, () => worker.kill('SIGKILL'));
      } else if (worker.exitCode === null && worker.signalCode === null) {
        const graceTimeout = setTimeout(() => {
          void terminateDetachedProcessTree(worker.pid, () => worker.kill('SIGKILL'));
        }, HEADED_REPAIR_EXIT_GRACE_MS);
        worker.once('exit', () => clearTimeout(graceTimeout));
      }

      resolve(result);
    };

    const onMessage = (message: unknown) => {
      if (!isHeadedRepairWorkerResult(message)) {
        return;
      }
      console.error(
        `[Headed Repair] Worker finished: success=${message.payload.success} reason=${message.payload.reason}`
      );
      finalize(message.payload, false);
    };

    const onError = (error: Error) => {
      finalize(
        {
          success: false,
          reason: 'error',
          message: `Headed repair worker error: ${error.message}`,
        },
        true
      );
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) {
        return;
      }
      finalize(
        {
          success: false,
          reason: 'error',
          message: `Headed repair worker exited without result (code=${code}, signal=${signal}).`,
        },
        false
      );
    };

    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.on('exit', onExit);
    worker.stderr?.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString().trim();
      if (text) {
        console.error(`[Headed Repair Worker] ${text}`);
      }
    });

    timeoutId = setTimeout(() => {
      finalize(
        {
          success: false,
          reason: 'timeout',
          message: `Headed repair timed out after ${HEADED_REPAIR_WORKER_TIMEOUT_MS}ms.`,
        },
        true
      );
    }, HEADED_REPAIR_WORKER_TIMEOUT_MS);

    const request: HeadedRepairWorkerInboundMessage = {
      type: 'run',
      payload,
    };
    worker.send(request, (error) => {
      if (!error) {
        return;
      }
      finalize(
        {
          success: false,
          reason: 'error',
          message: `Failed to dispatch headed repair request: ${error.message}`,
        },
        true
      );
    });
  });
}

async function ensureNotebookSessionReady(
  context: BrowserContext,
  region: AmazonRegion = DEFAULT_REGION,
  options: { fallbackMode?: SessionFallbackMode } = {}
): Promise<SessionEnsureResult> {
  const fallbackMode = options.fallbackMode || 'headless';
  const notebookUrl = getNotebookUrl(region);
  const page = await context.newPage();

  let directState:
    | {
        loggedIn: boolean;
        url: string;
        diagnostics: AuthStabilityDiagnostics;
      }
    | undefined;

  try {
    try {
      await page.goto(notebookUrl, {
        waitUntil: 'domcontentloaded',
        timeout: READ_NAVIGATION_TIMEOUT_MS,
      });
      directState = await resolveAuthStateWithStabilization(page);
      logAuthStateDiagnostics('[Auth Ensure] Direct-read', directState.diagnostics);
    } catch (error) {
      console.error('[Auth Ensure] Direct-read probe failed, trying fallback repair.', error);
    }

    if (directState?.loggedIn) {
      await saveStorageState(context, region).catch(() => {
        // ignore storage-state save errors in ensure flow
      });
      return {
        ready: true,
        method: 'direct_read',
        attemptedFallback: false,
        requiresContextReload: false,
      };
    }

    if (fallbackMode === 'none') {
      console.error('[Auth Ensure] Direct-read not ready and fallback mode is disabled.');
      return {
        ready: false,
        method: 'fallback_repair',
        attemptedFallback: false,
        requiresContextReload: false,
      };
    }

    if (fallbackMode === 'headed') {
      console.error('[Auth Ensure] Direct-read not ready, running one headed fallback repair pass...');
      const headedRepairResult = await runHeadedFallbackRepair(region);
      if (headedRepairResult.success) {
        return {
          ready: true,
          method: 'fallback_repair',
          attemptedFallback: true,
          requiresContextReload: true,
        };
      }
      console.error(
        `[Auth Ensure] Headed fallback repair failed: reason=${headedRepairResult.reason} message=${headedRepairResult.message}`
      );
      return {
        ready: false,
        method: 'fallback_repair',
        attemptedFallback: true,
        requiresContextReload: false,
      };
    }

    console.error('[Auth Ensure] Direct-read not ready, running one headless fallback repair pass...');
    let fallbackState:
      | {
          loggedIn: boolean;
          url: string;
          diagnostics: AuthStabilityDiagnostics;
        }
      | undefined;

    try {
      await page.goto(getAmazonBaseUrl(region), {
        waitUntil: 'domcontentloaded',
        timeout: REPAIR_NAVIGATION_TIMEOUT_MS,
      });
      await page.goto(`https://www.amazon.${region}/gp/css/homepage.html`, {
        waitUntil: 'domcontentloaded',
        timeout: REPAIR_NAVIGATION_TIMEOUT_MS,
      });
      await page.goto(notebookUrl, {
        waitUntil: 'domcontentloaded',
        timeout: READ_NAVIGATION_TIMEOUT_MS,
      });
      fallbackState = await resolveAuthStateWithStabilization(page);
      logAuthStateDiagnostics('[Auth Ensure] Fallback repair', fallbackState.diagnostics);
    } catch (error) {
      console.error('[Auth Ensure] Fallback repair request failed.', error);
    }

    if (fallbackState?.loggedIn) {
      await saveStorageState(context, region).catch(() => {
        // ignore storage-state save errors in ensure flow
      });
      return {
        ready: true,
        method: 'fallback_repair',
        attemptedFallback: true,
        requiresContextReload: false,
      };
    }

    return {
      ready: false,
      method: 'fallback_repair',
      attemptedFallback: true,
      requiresContextReload: false,
    };
  } finally {
    await page.close().catch(() => {
      // ignore close errors in ensure flow
    });
  }
}

/**
 * Validate session before attempting operations
 */
export async function validateSession(
  region: AmazonRegion = DEFAULT_REGION
): Promise<boolean> {
  let runtime: { browser: Browser; context: BrowserContext; usedStorageState: boolean } | null = null;
  try {
    runtime = await launchHeadlessContextWithStorageState(region);
    const ensured = await ensureNotebookSessionReady(runtime.context, region);
    return ensured.ready;
  } catch {
    return false;
  } finally {
    if (runtime) {
      await closeHeadlessBrowserSafely(runtime.browser);
    }
  }
}

/**
 * Attempt to refresh Amazon session in headless mode
 * Strategy:
 * 1. Direct-read Notebook to validate current session
 * 2. If not ready, run one fallback repair pass (main -> homepage -> read)
 */
export async function refreshSessionHeadless(
  region: AmazonRegion = DEFAULT_REGION
): Promise<SessionRefreshResult> {
  console.error(`[Refresh] Attempting to refresh session for region: ${region}...`);
  let runtime: { browser: Browser; context: BrowserContext; usedStorageState: boolean } | null = null;

  try {
    runtime = await launchHeadlessContextWithStorageState(region);
    const ensured = await ensureNotebookSessionReady(runtime.context, region);

    if (ensured.ready && ensured.method === 'direct_read') {
      console.error('[Refresh] Session still valid (cookie refresh)');
      return {
        success: true,
        method: 'cookie_refresh',
        message: 'Session is still valid',
      };
    }

    if (ensured.ready) {
      console.error('[Refresh] Session refreshed via homepage visit');
      return {
        success: true,
        method: 'homepage_visit',
        message: 'Session refreshed successfully',
      };
    }

    console.error('[Refresh] Both refresh attempts failed');
    return {
      success: false,
      method: 'failed',
      message: 'Session refresh failed, manual login required',
    };

  } catch (error) {
    console.error('[Refresh] Error during refresh:', error);
    return {
      success: false,
      method: 'failed',
      message: `Refresh error: ${error}`,
    };
  } finally {
    if (runtime) {
      await closeHeadlessBrowserSafely(runtime.browser);
    }
  }
}

/**
 * Get list of all books from Kindle Notebook
 * Returns array of book info without fetching highlights
 */
export async function getBookList(
  region: AmazonRegion = DEFAULT_REGION
): Promise<ScrapingResult<{ asin: string; title: string; author: string }[]>> {
  let browserManager = new BrowserManager({}, region);

  try {
    await browserManager.launch();
    let context = browserManager.getContext();
    if (!context) {
      throw new ScrapingError('Browser context not initialized');
    }

    const sessionState = await ensureNotebookSessionReady(context, region, {
      fallbackMode: 'headed',
    });
    if (!sessionState.ready) {
      throw new AuthError(SESSION_EXPIRED_ERROR_MESSAGE);
    }

    let ensuredMethod = sessionState.method;
    if (sessionState.requiresContextReload) {
      console.error('[Auth] Headed fallback repair succeeded, reloading persistent context...');
      await browserManager.close();

      browserManager = new BrowserManager({}, region);
      await browserManager.launch();
      context = browserManager.getContext();
      if (!context) {
        throw new ScrapingError('Browser context not initialized after repair reload');
      }

      const recheck = await ensureNotebookSessionReady(context, region, {
        fallbackMode: 'none',
      });
      if (!recheck.ready) {
        throw new AuthError(SESSION_EXPIRED_ERROR_MESSAGE);
      }
      ensuredMethod = 'fallback_repair';
    }

    console.error(`[Auth] Notebook session ensured via ${ensuredMethod}.`);

    const scraper = new KindleScraper(browserManager, region);
    await scraper.navigateToNotebook();

    const books = await scraper.getBookList();

    await scraper.close();
    await saveStorageState(context, region).catch(() => {
      // ignore storage state save errors on success path
    });

    return {
      success: true,
      data: books,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (error instanceof AuthError) {
      return {
        success: false,
        error: errorMessage,
      };
    }

    return {
      success: false,
      error: `Failed to get book list: ${errorMessage}`,
    };
  } finally {
    await browserManager.close();
  }
}

/**
 * Fetch highlights for a specific book by ASIN
 */
export async function fetchBookHighlights(
  asin: string,
  region: AmazonRegion = DEFAULT_REGION
): Promise<ScrapingResult<KindleBookData>> {
  let browserManager = new BrowserManager({}, region);

  try {
    await browserManager.launch();
    let context = browserManager.getContext();
    if (!context) {
      throw new ScrapingError('Browser context not initialized');
    }

    const sessionState = await ensureNotebookSessionReady(context, region, {
      fallbackMode: 'headed',
    });
    if (!sessionState.ready) {
      throw new AuthError(SESSION_EXPIRED_ERROR_MESSAGE);
    }

    let ensuredMethod = sessionState.method;
    if (sessionState.requiresContextReload) {
      console.error('[Auth] Headed fallback repair succeeded, reloading persistent context...');
      await browserManager.close();

      browserManager = new BrowserManager({}, region);
      await browserManager.launch();
      context = browserManager.getContext();
      if (!context) {
        throw new ScrapingError('Browser context not initialized after repair reload');
      }

      const recheck = await ensureNotebookSessionReady(context, region, {
        fallbackMode: 'none',
      });
      if (!recheck.ready) {
        throw new AuthError(SESSION_EXPIRED_ERROR_MESSAGE);
      }
      ensuredMethod = 'fallback_repair';
    }

    console.error(`[Auth] Notebook session ensured via ${ensuredMethod}.`);

    const scraper = new KindleScraper(browserManager, region);
    await scraper.navigateToNotebook();

    // Get book list first to find the correct author from sidebar data
    const books = await scraper.getBookList();
    const targetBook = books.find(b => b.asin === asin);
    const correctAuthor = targetBook?.author;

    // Select the book by clicking on it
    const selected = await scraper.selectBook(asin);
    if (!selected) {
      await scraper.close();
      return {
        success: false,
        error: `Failed to select book with ASIN: ${asin}`,
      };
    }

    // Extract data with the correct author from sidebar
    const result = await scraper.extractBookData(correctAuthor);

    await scraper.close();
    await saveStorageState(context, region).catch(() => {
      // ignore storage state save errors on success path
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (error instanceof AuthError) {
      return {
        success: false,
        error: errorMessage,
      };
    }

    return {
      success: false,
      error: `Failed to fetch highlights: ${errorMessage}`,
    };
  } finally {
    await browserManager.close();
  }
}

/**
 * Main entry point for scraping Kindle notes
 * Combines browser management and scraping logic
 */
export async function scrapeKindleNotes(
  bookLimit: number = 1,
  region: AmazonRegion = DEFAULT_REGION
): Promise<ScrapingResult<KindleBookData[]>> {
  const browserManager = new BrowserManager({}, region);
  const results: KindleBookData[] = [];

  try {
    // Launch browser
    await browserManager.launch();
    const context = browserManager.getContext();
    if (!context) {
      throw new ScrapingError('Browser context not initialized');
    }
    const sessionState = await ensureNotebookSessionReady(context, region);
    if (!sessionState.ready) {
      throw new AuthError(SESSION_EXPIRED_ERROR_MESSAGE);
    }
    console.error(`[Auth] Notebook session ensured via ${sessionState.method}.`);

    // Create scraper and navigate
    const scraper = new KindleScraper(browserManager, region);
    await scraper.navigateToNotebook();

    // Extract data for specified number of books
    for (let i = 0; i < bookLimit; i++) {
      const bookResult = await scraper.extractBookData();

      if (!bookResult.success) {
        if (i === 0) {
          // First book failed, return error
          return { success: false, error: bookResult.error };
        }
        // Subsequent books failed, break and return what we have
        break;
      }

      results.push(bookResult.data!);

      // Try to navigate to next book if needed
      if (i < bookLimit - 1) {
        // TODO: Implement book navigation logic
        // For now, break after first book
        break;
      }
    }

    await scraper.close();
    await saveStorageState(context, region).catch(() => {
      // ignore storage state save errors on success path
    });

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle specific error types
    if (error instanceof AuthError) {
      return {
        success: false,
        error: errorMessage,
      };
    }

    return {
      success: false,
      error: `Scraping failed: ${errorMessage}`,
    };
  } finally {
    await browserManager.close();
  }
}

function isAuthPageUrl(url: string): boolean {
  return url.includes('/signin') || url.includes('/ap/signin') || url.includes('/ap/forced');
}

async function resolveAuthStateWithStabilization(page: Page): Promise<{
  loggedIn: boolean;
  url: string;
  diagnostics: AuthStabilityDiagnostics;
}> {
  const startedAt = Date.now();
  const initialUrl = page.url() || 'about:blank';
  let finalUrl = initialUrl;
  let redirectCount = 0;
  let lastObservedUrl = initialUrl;
  let loginStreak = 0;

  const onFrameNavigated = () => {
    const current = page.url() || '';
    if (current && current !== lastObservedUrl) {
      lastObservedUrl = current;
      redirectCount += 1;
    }
  };

  page.on('framenavigated', onFrameNavigated);
  try {
    while (Date.now() - startedAt < AUTH_STABILIZATION_TIMEOUT_MS) {
      finalUrl = page.url() || finalUrl;
      if (!isAuthPageUrl(finalUrl)) {
        loginStreak += 1;
      } else {
        loginStreak = 0;
      }

      if (loginStreak >= AUTH_STABILIZATION_REQUIRED_STREAK) {
        return {
          loggedIn: true,
          url: finalUrl,
          diagnostics: {
            initialUrl,
            finalUrl,
            redirectCount,
            stabilizationMs: Date.now() - startedAt,
          },
        };
      }

      await page.waitForTimeout(AUTH_STABILIZATION_POLL_INTERVAL_MS);
    }

    finalUrl = page.url() || finalUrl;
    return {
      loggedIn: false,
      url: finalUrl,
      diagnostics: {
        initialUrl,
        finalUrl,
        redirectCount,
        stabilizationMs: Date.now() - startedAt,
      },
    };
  } finally {
    page.off('framenavigated', onFrameNavigated);
  }
}

async function probeAuthUrl(
  context: BrowserContext,
  targetUrl: string,
  usedStorageState: boolean = false
): Promise<AuthProbeResult> {
  const probePage = await context.newPage();
  const startedAt = Date.now();
  let fallbackUrl = 'probe_failed';
  const initialUrl = probePage.url() || 'about:blank';
  let redirectCount = 0;
  let lastObservedUrl = initialUrl;

  const onFrameNavigated = () => {
    const current = probePage.url() || '';
    if (current && current !== lastObservedUrl) {
      lastObservedUrl = current;
      redirectCount += 1;
    }
  };
  probePage.on('framenavigated', onFrameNavigated);

  try {
    await probePage.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: PROBE_TIMEOUT_MS,
    });
    const resolved = await resolveAuthStateWithStabilization(probePage);
    return {
      loggedIn: resolved.loggedIn,
      url: resolved.url,
      diagnostics: resolved.diagnostics,
      usedStorageState,
    };
  } catch {
    fallbackUrl = probePage.url() || fallbackUrl;
    return {
      loggedIn: false,
      url: fallbackUrl,
      diagnostics: {
        initialUrl,
        finalUrl: fallbackUrl,
        redirectCount,
        stabilizationMs: Date.now() - startedAt,
      },
      usedStorageState,
    };
  } finally {
    probePage.off('framenavigated', onFrameNavigated);
    await probePage.close().catch(() => {
      // ignore close error for probe page
    });
  }
}

async function probeMainAuth(
  context: BrowserContext,
  region: AmazonRegion,
  usedStorageState: boolean = false
): Promise<AuthProbeResult> {
  return probeAuthUrl(context, `https://www.amazon.${region}/gp/css/homepage.html`, usedStorageState);
}

async function probeWebReaderAuth(
  context: BrowserContext,
  region: AmazonRegion,
  usedStorageState: boolean = false
): Promise<AuthProbeResult> {
  return probeAuthUrl(context, getNotebookUrl(region), usedStorageState);
}

async function closeContextSafely(browserManager: BrowserManager): Promise<void> {
  await browserManager.close().catch(() => {
    // ignore close error during flow shutdown
  });
}

type EnsureManualLoginSessionResult = {
  status: 'browser_opened' | 'already_opened';
  session: ActiveLoginSession;
};

async function ensureManualLoginSession(
  region: AmazonRegion,
  mode: 'cli' | 'mcp'
): Promise<EnsureManualLoginSessionResult> {
  const prefix = mode === 'mcp' ? '[MCP Login]' : '[Login]';

  if (activeLoginSession) {
    const existingRegion = activeLoginSession.region;
    console.error(
      `${prefix} Login browser already open for Amazon ${existingRegion}. Reusing existing session.`
    );
    return {
      status: 'already_opened',
      session: activeLoginSession,
    };
  }

  const browserManager = new BrowserManager({ headless: false }, region);
  try {
    await browserManager.launch();

    const context = browserManager.getContext();
    if (!context) {
      throw new Error('Browser context unavailable');
    }

    const page = await browserManager.newPage();
    await page.goto(getAmazonBaseUrl(region), {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const session: ActiveLoginSession = {
      region,
      openedAt: Date.now(),
      browserManager,
      context,
      closed: new Promise<void>((resolve) => {
        context.once('close', () => {
          if (activeLoginSession?.context === context) {
            activeLoginSession = null;
          }
          console.error(`${prefix} Login browser closed.`);
          resolve();
        });
      }),
    };

    activeLoginSession = session;
    console.error(`${prefix} Browser opened. Please click "Sign in" and complete Amazon login manually.`);

    return {
      status: 'browser_opened',
      session,
    };
  } catch (error) {
    await closeContextSafely(browserManager);
    throw error;
  }
}

/**
 * Launch interactive login session
 * Opens headed browser for manual authentication
 * This mode keeps process alive until user closes browser manually.
 */
export async function launchLoginSession(
  region: AmazonRegion = DEFAULT_REGION
): Promise<void> {
  try {
    console.error(`[Login] Launching browser for Amazon ${region}...`);
    const sessionResult = await ensureManualLoginSession(region, 'cli');
    if (sessionResult.status === 'already_opened') {
      console.error(`[Login] Existing login browser is already open for Amazon ${sessionResult.session.region}.`);
    } else {
      console.error('[Login] Browser opened. Complete manual sign in, then close browser.');
    }
    await sessionResult.session.closed;
    console.error('[Login] Browser closed. You can run check_login_status to verify readiness.');
  } catch (error) {
    console.error('[Login] Error:', error);
  }
}

/**
 * Launch login for MCP tool
 * Returns status without blocking for user to complete login
 */
export async function launchLoginForMCP(
  region: AmazonRegion = DEFAULT_REGION
): Promise<LoginToolResult> {
  try {
    console.error(`[MCP Login] Launching browser for Amazon ${region}...`);
    const sessionResult = await ensureManualLoginSession(region, 'mcp');

    if (sessionResult.status === 'already_opened') {
      return {
        success: true,
        status: 'already_opened',
        phase: 'waiting_manual_login',
        details: {
          openedAt: new Date(sessionResult.session.openedAt).toISOString(),
          existingSessionRegion: sessionResult.session.region,
        },
        message: `Login browser is already open for Amazon ${sessionResult.session.region}. Continue manual sign in in that window.`,
        region: sessionResult.session.region,
      };
    }

    return {
      success: true,
      status: 'browser_opened',
      phase: 'waiting_manual_login',
      details: {
        openedAt: new Date(sessionResult.session.openedAt).toISOString(),
      },
      message: `Browser opened for Amazon ${region}. Please click Sign in and complete manual login. Then call check_login_status to verify.`,
      region,
    };
  } catch (error) {
    return {
      success: false,
      status: 'failed',
      phase: 'failed',
      message: `Failed to launch browser: ${error}`,
      region,
    };
  }
}

function buildLoginStatusResult(
  region: AmazonRegion,
  mainProbe: AuthProbeResult,
  webReaderProbe: AuthProbeResult
): LoginStatusToolResult {
  const mainDiagnostics = mainProbe.diagnostics;
  const webDiagnostics = webReaderProbe.diagnostics;
  const mergedDiagnostics = webDiagnostics || mainDiagnostics;
  const usedStorageState = Boolean(mainProbe.usedStorageState || webReaderProbe.usedStorageState);

  if (!mainProbe.loggedIn) {
    return {
      success: true,
      status: 'needs_login',
      action: 'run_login',
      details: {
        mainLoggedIn: false,
        webReaderReady: false,
        mainProbeUrl: mainProbe.url,
        webReaderProbeUrl: 'not_checked',
        initialUrl: mainDiagnostics?.initialUrl,
        finalUrl: mainDiagnostics?.finalUrl,
        redirectCount: mainDiagnostics?.redirectCount,
        stabilizationMs: mainDiagnostics?.stabilizationMs,
        usedStorageState,
      },
      message: 'Amazon main-site login not detected. Use the login tool and complete sign in manually.',
      region,
    };
  }

  if (!webReaderProbe.loggedIn) {
    return {
      success: true,
      status: 'main_only',
      action: 'retry_later',
      details: {
        mainLoggedIn: true,
        webReaderReady: false,
        mainProbeUrl: mainProbe.url,
        webReaderProbeUrl: webReaderProbe.url,
        initialUrl: webDiagnostics?.initialUrl,
        finalUrl: webDiagnostics?.finalUrl,
        redirectCount: webDiagnostics?.redirectCount,
        stabilizationMs: webDiagnostics?.stabilizationMs,
        usedStorageState,
      },
      message: 'Main-site login is active, but Web Reader session is not ready yet. Retry shortly or run a read tool to trigger one refresh attempt.',
      region,
    };
  }

  return {
    success: true,
    status: 'ready',
    action: 'none',
    details: {
      mainLoggedIn: true,
      webReaderReady: true,
      mainProbeUrl: mainProbe.url,
      webReaderProbeUrl: webReaderProbe.url,
      initialUrl: mergedDiagnostics?.initialUrl,
      finalUrl: mergedDiagnostics?.finalUrl,
      redirectCount: mergedDiagnostics?.redirectCount,
      stabilizationMs: mergedDiagnostics?.stabilizationMs,
      usedStorageState,
    },
    message: 'Login status is ready for Kindle Notebook operations.',
    region,
  };
}

async function probeLoginStatusWithContext(
  context: BrowserContext,
  region: AmazonRegion,
  usedStorageState: boolean = false
): Promise<{ mainProbe: AuthProbeResult; webReaderProbe: AuthProbeResult }> {
  const mainProbe = await probeMainAuth(context, region, usedStorageState);
  if (!mainProbe.loggedIn) {
    return {
      mainProbe,
      webReaderProbe: {
        loggedIn: false,
        url: 'not_checked',
        usedStorageState,
      },
    };
  }

  const webReaderProbe = await probeWebReaderAuth(context, region, usedStorageState);
  return {
    mainProbe,
    webReaderProbe,
  };
}

/**
 * Check current login readiness without mutating login flow.
 */
export async function checkLoginStatus(
  region: AmazonRegion = DEFAULT_REGION
): Promise<LoginStatusToolResult> {
  if (activeLoginSession && activeLoginSession.region === region) {
    try {
      console.error(`[Login Status] Probing via active login session (session region: ${activeLoginSession.region}, check region: ${region})`);
      const activeProbe = await probeLoginStatusWithContext(activeLoginSession.context, region, false);
      const activeResult = buildLoginStatusResult(region, activeProbe.mainProbe, activeProbe.webReaderProbe);
      if (activeResult.success && activeResult.status === 'ready') {
        await saveStorageState(activeLoginSession.context, region).catch(() => {
          // ignore state save errors in active-session probe
        });
      }
      return activeResult;
    } catch (error) {
      console.error('[Login Status] Active session probe failed, falling back to headless probe.', error);
      activeLoginSession = null;
    }
  } else if (activeLoginSession) {
    console.error(
      `[Login Status] Active login session region (${activeLoginSession.region}) differs from check region (${region}); using dedicated headless probe.`
    );
  }
  let runtime: { browser: Browser; context: BrowserContext; usedStorageState: boolean } | null = null;

  try {
    runtime = await launchHeadlessContextWithStorageState(region);
    const probeResult = await probeLoginStatusWithContext(
      runtime.context,
      region,
      runtime.usedStorageState
    );
    const result = buildLoginStatusResult(region, probeResult.mainProbe, probeResult.webReaderProbe);
    if (result.success && result.status === 'ready') {
      await saveStorageState(runtime.context, region).catch(() => {
        // ignore state save errors in headless probe
      });
    }
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      status: 'failed',
      action: 'retry_later',
      details: {
        mainLoggedIn: false,
        webReaderReady: false,
        mainProbeUrl: 'probe_failed',
        webReaderProbeUrl: 'probe_failed',
        usedStorageState: false,
      },
      message: `Failed to check login status: ${errorMessage}`,
      region,
    };
  } finally {
    if (runtime) {
      await closeHeadlessBrowserSafely(runtime.browser);
    }
  }
}
