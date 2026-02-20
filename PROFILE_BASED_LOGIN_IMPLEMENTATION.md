# Profile-Based Conditional Login Flow Implementation

## Overview

This document describes the implementation of a conditional login flow based on profile directory existence. The system now behaves differently for first-time login versus session refresh scenarios.

## Context

Previously, the login logic always executed automatic navigation to the Kindle Notebook. This implementation adds conditional behavior:

| Scenario | Profile Status | Behavior |
|----------|---------------|----------|
| First-time login | Directory does not exist | Opens homepage → Waits for user to manually complete login and navigation |
| Session refresh | Directory exists | Opens homepage → Detects login → Auto-navigates to Notebook |

## Implementation

### 1. Added `profileExists()` Helper Function

**File**: `src/browser.ts`

```typescript
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Check if the profile directory exists with valid session data
 */
function profileExists(): boolean {
  const profileDir = join(PROJECT_ROOT, 'kindle-mcp-profile');

  // Check if directory exists
  if (!existsSync(profileDir)) {
    return false;
  }

  // Check if it contains session data (has 'Default' subdirectory)
  const defaultDir = join(profileDir, 'Default');
  return existsSync(defaultDir);
}
```

### 2. Modified `launchLoginSession()` Function

Added conditional logic at the start of the function:

```typescript
// Check if this is first-time login or session refresh
const isFirstTimeLogin = !profileExists();

if (isFirstTimeLogin) {
  // First-time login mode: no auto-navigation
  console.log('[Login] First-time login detected (no profile found)');
  console.log('[Login] ========================================');
  console.log('[Login] Browser opened. Please:');
  console.log('[Login]   1. Click "Sign in" button');
  console.log(`[Login]   2. Log in with your Amazon credentials`);
  console.log('[Login]   3. Complete any 2FA/verification steps');
  console.log('[Login]   4. Manually navigate to Kindle Notebook');
  console.log('[Login]      URL: https://read.amazon.' + region + '/notebook');
  console.log('[Login] ========================================');
  console.log('[Login] Close the browser when you are done.');

  // Wait for browser close - no auto-navigation
  await new Promise<void>((resolve) => {
    const context = browserManager.getContext();
    context?.on('close', () => {
      console.log('[Login] Browser closed by user.');
      resolve();
    });
  });
} else {
  // Session refresh mode: execute auto-navigation (existing logic)
  // ... existing auto-navigation code ...
}
```

### 3. Modified `launchLoginForMCP()` Function

Similar conditional logic for the MCP tool:

```typescript
if (isFirstTimeLogin) {
  // First-time login mode: no auto-close
  console.error('[MCP Login] First-time login detected (no profile found)');
  console.error('[MCP Login] Browser opened. Please complete login manually.');
  console.error('[MCP Login] After login, navigate to: https://read.amazon.' + region + '/notebook');

  // Wait for browser close - no auto-navigation, no auto-close
  await new Promise<void>((resolve) => {
    context?.on('close', () => {
      console.error('[MCP Login] Browser closed by user.');
      resolve();
    });
  });

  return {
    success: true,
    status: 'browser_opened',
    message: `Browser opened for first-time login. Please complete login and navigate to Kindle Notebook manually.`,
    region,
  };
} else {
  // Session refresh mode: keep existing auto-detect and auto-close logic
  // ... existing code ...
}
```

## File Changes

| File | Changes |
|------|---------|
| `src/browser.ts` | Added `profileExists()` function, modified `launchLoginSession()` and `launchLoginForMCP()` functions |

## Testing

### Test First-Time Login Mode
```bash
# Delete existing profile
rm -rf kindle-mcp-profile

# Start login
npm run login
```

Expected behavior:
- Shows "First-time login detected" message
- Prompts user to manually navigate to Kindle Notebook
- No auto-navigation
- Waits for user to close browser

### Test Session Refresh Mode
```bash
# With existing profile
npm run login
```

Expected behavior:
- Shows "Session refresh mode" message
- Auto-navigates to Kindle Notebook after login
- Shows success message

## Implementation Date

2026-02-20
