import { chromium, BrowserContext, Page } from 'playwright';
import {
  getAmazonBaseUrl,
  getNotebookUrl,
} from './types.js';
import type {
  HeadedRepairReason,
  HeadedRepairRequest,
  HeadedRepairResult,
  HeadedRepairWorkerInboundMessage,
  HeadedRepairWorkerOutboundMessage,
} from './types.js';

const AUTH_STABILIZATION_TIMEOUT_MS = 12000;
const AUTH_STABILIZATION_POLL_INTERVAL_MS = 500;
const AUTH_STABILIZATION_REQUIRED_STREAK = 2;

type AuthStabilityDiagnostics = {
  initialUrl: string;
  finalUrl: string;
  redirectCount: number;
  stabilizationMs: number;
};

type AuthStateResult = {
  loggedIn: boolean;
  url: string;
  diagnostics: AuthStabilityDiagnostics;
};

function isAuthPageUrl(url: string): boolean {
  return url.includes('/signin') || url.includes('/ap/signin') || url.includes('/ap/forced');
}

function isCaptchaPageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('captcha') ||
    lower.includes('/ap/cvf') ||
    lower.includes('/challenge')
  );
}

function resolveFailureReason(url: string): HeadedRepairReason {
  if (isCaptchaPageUrl(url)) {
    return 'captcha';
  }
  if (isAuthPageUrl(url)) {
    return 'signin';
  }
  return 'unknown';
}

async function resolveAuthStateWithStabilization(page: Page): Promise<AuthStateResult> {
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

async function runHeadedRepair(payload: HeadedRepairRequest): Promise<HeadedRepairResult> {
  let context: BrowserContext | null = null;
  let authState: AuthStateResult | null = null;

  try {
    context = await chromium.launchPersistentContext(payload.userDataDir, {
      headless: false,
      args: [...payload.args, '--lang=en-US'],
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const page = await context.newPage();
    await page.goto(getAmazonBaseUrl(payload.region), {
      waitUntil: 'domcontentloaded',
      timeout: payload.repairNavigationTimeoutMs,
    });
    await page.goto(`https://www.amazon.${payload.region}/gp/css/homepage.html`, {
      waitUntil: 'domcontentloaded',
      timeout: payload.repairNavigationTimeoutMs,
    });
    await page.goto(getNotebookUrl(payload.region), {
      waitUntil: 'domcontentloaded',
      timeout: payload.readNavigationTimeoutMs,
    });

    authState = await resolveAuthStateWithStabilization(page);
    if (authState.loggedIn) {
      await context.storageState({ path: payload.authStatePath }).catch(() => {
        // ignore storage-state save error in worker
      });

      await page.waitForTimeout(payload.closeDelayMs);
      return {
        success: true,
        reason: 'ready',
        message: 'Headed fallback repair succeeded.',
        initialUrl: authState.diagnostics.initialUrl,
        finalUrl: authState.diagnostics.finalUrl,
        redirectCount: authState.diagnostics.redirectCount,
        stabilizationMs: authState.diagnostics.stabilizationMs,
      };
    }

    return {
      success: false,
      reason: resolveFailureReason(authState.url),
      message: `Headed fallback repair ended at: ${authState.url}`,
      initialUrl: authState.diagnostics.initialUrl,
      finalUrl: authState.diagnostics.finalUrl,
      redirectCount: authState.diagnostics.redirectCount,
      stabilizationMs: authState.diagnostics.stabilizationMs,
    };
  } catch (error) {
    return {
      success: false,
      reason: 'error',
      message: `Headed fallback repair error: ${error}`,
      initialUrl: authState?.diagnostics.initialUrl,
      finalUrl: authState?.diagnostics.finalUrl,
      redirectCount: authState?.diagnostics.redirectCount,
      stabilizationMs: authState?.diagnostics.stabilizationMs,
    };
  } finally {
    if (context) {
      await context.close().catch(() => {
        // ignore close error in worker cleanup
      });
    }
  }
}

function sendResult(result: HeadedRepairResult): void {
  const message: HeadedRepairWorkerOutboundMessage = {
    type: 'result',
    payload: result,
  };

  if (typeof process.send === 'function') {
    process.send(message);
  } else {
    process.stdout.write(JSON.stringify(message) + '\n');
  }
}

let hasRun = false;

process.on('message', (message: HeadedRepairWorkerInboundMessage | undefined) => {
  if (!message || message.type !== 'run' || hasRun) {
    return;
  }
  hasRun = true;

  void runHeadedRepair(message.payload)
    .then((result) => {
      sendResult(result);
      setTimeout(() => process.exit(0), 20);
    })
    .catch((error) => {
      sendResult({
        success: false,
        reason: 'error',
        message: `Headed fallback worker fatal error: ${error}`,
      });
      setTimeout(() => process.exit(1), 20);
    });
});
