/**
 * Browser Automation for Kindle MCP Server
 * Phase 3: Browser Automation - Playwright wrapper with login & scraping logic
 * REFACTORED: New login flow - open homepage, let user manually click to login page
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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
} from './types.js';
import {
  AuthError,
  ScrapingError,
} from './types.js';

// Default Amazon region
const DEFAULT_REGION: AmazonRegion = 'com'; // US

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
  bookTitle: 'h2.kp-notebook-searchable',
  bookAuthor: 'p.kp-notebook-searchable',
  highlightContainer: '.a-spacing-base',
  highlightText: '#highlight',
  noteText: '#note',
  location: '.a-size-small.a-color-secondary',
  colorClassPrefix: 'kp-notebook-highlight-',
};

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
          args: this.config.args,
          viewport: { width: 1280, height: 720 },
        });
        // Persistent context doesn't have a separate browser instance
        this.browser = null;
        console.log(`[Browser] Launched persistent context for region: ${this.region}`);
        console.log(`[Browser] Session will be saved to: ${this.config.userDataDir}`);
      } else {
        this.browser = await chromium.launch({
          headless: this.config.headless,
          args: this.config.args,
        });

        this.context = await this.browser.newContext({
          viewport: { width: 1280, height: 720 },
        });

        console.log(`[Browser] Launched successfully for region: ${this.region}`);
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
      console.log('[Browser] Closed successfully');
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
      const notebookUrl = `https://read.amazon.${this.region}/notebook`;
      console.log(`[Scraper] Navigating to: ${notebookUrl}`);
      await this.page.goto(notebookUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Check for authentication redirect
      const url = this.page.url();
      console.log(`[Scraper] Current URL: ${url}`);

      // Auth check: only redirect to signin/ap/signin page means not logged in
      // Note: Amazon may redirect through various URLs, only check for explicit auth pages
      if (url.includes('/ap/signin') || url.includes('/signin') || url.includes('/ap/forced')) {
        throw new AuthError('Session expired or not logged in. Please run `npm run login:jp` to authenticate.');
      }

      // Wait for content to load
      await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        // Networkidle timeout is acceptable, continue
      });

      console.log(`[Scraper] Navigation successful for region: ${this.region}`);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new ScrapingError(`Failed to navigate: ${error}`);
    }
  }

  /**
   * Extract book data from current page
   */
  async extractBookData(): Promise<ScrapingResult<KindleBookData>> {
    if (!this.page) {
      return { success: false, error: 'Page not initialized' };
    }

    try {
      // Log current page info for debugging
      const currentUrl = this.page.url();
      console.log(`[Scraper] Extracting data from: ${currentUrl}`);

      // Extract book metadata
      const title = await this.safeGetText(SELECTORS.bookTitle);
      const author = await this.safeGetText(SELECTORS.bookAuthor);

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

      console.log(`[Scraper] Extracted ${highlights.length} highlights from "${bookData.title}"`);

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
          // Parse text like "Book TitleCreator: Author"
          const parts = text.split(/创建者|著者/);
          const title = parts[0]?.trim() || '';
          const author = parts[1]?.trim() || '';
          return {
            asin: item.id,
            title,
            author,
          };
        });
      });

      console.log(`[Scraper] Found ${books.length} books in sidebar`);
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

      console.log(`[Scraper] Clicking on book ${asin}...`);
      await element.click();

      // Wait for content to update
      await this.page.waitForTimeout(5000);

      console.log(`[Scraper] Successfully selected book ${asin}`);
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
  const regionMap: Record<string, string> = {
    'com': '美国站',
    'co.jp': '日本站',
    'co.uk': '英国站',
    'de': '德国站',
    'fr': '法国站',
    'es': '西班牙站',
    'it': '意大利站',
    'ca': '加拿大站',
    'com.au': '澳大利亚站',
    'in': '印度站',
    'com.mx': '墨西哥站',
  };

  const regionName = regionMap[region] || region;
  const loginScript = region === 'com' ? 'npm run login' : `npm run login:${region.replace('co.', '').replace('com.', '')}`;

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

/**
 * Validate session before attempting operations
 */
export async function validateSession(
  region: AmazonRegion = DEFAULT_REGION
): Promise<boolean> {
  const browserManager = new BrowserManager({
    headless: true,
  }, region);

  try {
    await browserManager.launch();
    const page = await browserManager.newPage();
    const notebookUrl = `https://read.amazon.${region}/notebook`;

    await page.goto(notebookUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    const url = page.url();
    await browserManager.close();

    return !url.includes('/signin') && !url.includes('/ap/signin');
  } catch (error) {
    await browserManager.close();
    return false;
  }
}

/**
 * Get list of all books from Kindle Notebook
 * Returns array of book info without fetching highlights
 */
export async function getBookList(
  region: AmazonRegion = DEFAULT_REGION
): Promise<ScrapingResult<{ asin: string; title: string; author: string }[]>> {
  const browserManager = new BrowserManager({}, region);

  try {
    await browserManager.launch();
    const scraper = new KindleScraper(browserManager, region);
    await scraper.navigateToNotebook();

    const books = await scraper.getBookList();

    await scraper.close();

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
  const browserManager = new BrowserManager({}, region);

  try {
    await browserManager.launch();
    const scraper = new KindleScraper(browserManager, region);
    await scraper.navigateToNotebook();

    // Select the book by clicking on it
    const selected = await scraper.selectBook(asin);
    if (!selected) {
      await scraper.close();
      return {
        success: false,
        error: `Failed to select book with ASIN: ${asin}`,
      };
    }

    // Extract data
    const result = await scraper.extractBookData();

    await scraper.close();

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

/**
 * Launch interactive login session
 * Opens headed browser for manual authentication
 * AUTOMATED: Open homepage -> User logs in -> Auto navigate to Notebook
 */
export async function launchLoginSession(
  region: AmazonRegion = DEFAULT_REGION
): Promise<void> {
  const browserManager = new BrowserManager({
    headless: false,  // Open headed browser
  }, region);

  try {
    console.log(`[Login] Launching browser for Amazon ${region}...`);
    await browserManager.launch();

    const page = await browserManager.newPage();

    // Open Amazon homepage
    const homeUrl = `https://www.amazon.${region}`;
    console.log(`[Login] Opening Amazon homepage: ${homeUrl}`);
    await page.goto(homeUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    console.log('[Login] ========================================');
    console.log('[Login] Browser opened. Please:');
    console.log('[Login]   1. Click "Sign in" button');
    console.log(`[Login]   2. Log in with your Amazon credentials`);
    console.log('[Login]   3. Complete any 2FA/verification steps');
    console.log('[Login] ========================================');
    console.log('[Login] I will automatically navigate to Kindle Notebook once login is detected...');

    // Wait for user to complete login, then auto-navigate to notebook
    const context = browserManager.getContext();
    await new Promise<void>((resolve) => {
      let loginCheckInterval: NodeJS.Timeout | null = null;
      let navigationInProgress = false;

      // Check if user is logged in by attempting to navigate to notebook
      const checkLoginStatus = async () => {
        if (navigationInProgress) return;

        try {
          // Try to navigate to notebook in background to check login status
          const notebookUrl = `https://read.amazon.${region}/notebook`;

          // Create a new page to test (don't disturb user's current page)
          const testPage = await context?.newPage();
          if (!testPage) return;

          const response = await testPage.goto(notebookUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 10000,
          }).catch(() => null);

          const testUrl = testPage.url();
          await testPage.close();

          // If not redirected to signin, we're logged in!
          if (!testUrl.includes('/signin') && !testUrl.includes('/ap/signin')) {
            console.log('[Login] ✅ Login detected!');
            console.log(`[Login] Auto-navigating to Kindle Notebook...`);

            navigationInProgress = true;
            if (loginCheckInterval) clearInterval(loginCheckInterval);

            // Navigate to notebook on main page
            await page.goto(notebookUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 30000,
            });

            const finalUrl = page.url();
            if (finalUrl.includes('/notebook')) {
              console.log('[Login] ✅ Successfully reached Kindle Notebook!');
              console.log('[Login] ========================================');
              console.log('[Login] Login complete! Session will be saved.');
              console.log('[Login] Close the browser when you are ready.');
              console.log('[Login] ========================================');
            } else if (finalUrl.includes('/signin')) {
              console.log('[Login] ❌ Session expired. Please try again.');
            } else {
              console.log('[Login] ⚠️ Unexpected URL:', finalUrl);
            }

            return;
          }

          console.log('[Login] Waiting for login... (checking every 3 seconds)');
        } catch (error) {
          // Ignore errors during polling, continue checking
        }
      };

      // Start checking login status every 3 seconds
      loginCheckInterval = setInterval(checkLoginStatus, 3000);

      // Listen for browser close event
      context?.on('close', () => {
        if (loginCheckInterval) clearInterval(loginCheckInterval);
        console.log('[Login] Browser closed by user.');
        resolve();
      });
    });

    console.log('[Login] Session saved. You can now run the MCP server.');
  } catch (error) {
    console.error('[Login] Error:', error);
  } finally {
    await browserManager.close();
  }
}
