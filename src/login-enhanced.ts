/**
 * Enhanced Login Flow with Visual Feedback
 * 优化版登录流程，提供实时反馈和更好的用户体验
 */

import { chromium, Page, BrowserContext } from 'playwright';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { AmazonRegion } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);

// Region mapping for user-friendly names
const REGION_NAMES: Record<string, string> = {
  'co.jp': '日本站',
};

/**
 * Inject visual feedback banner into the page
 */
async function injectBanner(page: Page, state: 'waiting' | 'success' | 'navigating', message: string) {
  await page.evaluate((args: { state: string; message: string; html: string }) => {
    let banner = document.getElementById('kindle-mcp-banner') as HTMLDivElement;
    const styleBase = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      padding: 16px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
    `;

    const styles: Record<string, string> = {
      waiting: `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);`,
      success: `background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);`,
      navigating: `background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);`,
    };

    const icons: Record<string, string> = {
      waiting: '⏳',
      success: '✅',
      navigating: '🔄',
    };

    const html = `
      <div style="max-width: 600px; margin: 0 auto; color: white;">
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
          ${icons[args.state]} ${args.message}
        </div>
        <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
          ${args.html}
        </div>
      </div>
    `;

    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'kindle-mcp-banner';
      banner.style.cssText = styleBase + styles[args.state];
      banner.innerHTML = html;
      document.body.prepend(banner);
    } else {
      banner.style.cssText = styleBase + styles[args.state];
      banner.innerHTML = html;
    }
  }, {
    state,
    message,
    html: state === 'waiting' ? '请登录您的 Amazon 账号，登录完成后会自动跳转到 Kindle 笔记本页面' :
          state === 'navigating' ? '正在自动跳转到 Kindle 笔记本页面...' : '',
  });
}

/**
 * Enhanced login session with visual feedback
 */
export async function launchLoginSessionEnhanced(
  region: AmazonRegion = 'co.jp'
): Promise<void> {
  const USER_DATA_DIR = join(PROJECT_ROOT, 'kindle-mcp-profile');

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`  🚀 正在启动 Kindle MCP 登录助手 - ${REGION_NAMES[region] || region}`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 720 },
  });

  try {
    const page = await context.newPage();

    // Step 1: 打开 Amazon 主页
    const homeUrl = `https://www.amazon.${region}`;
    console.log(`📖 正在打开 Amazon 主页: ${homeUrl}`);

    await page.goto(homeUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 注入初始提示横幅
    await injectBanner(page, 'waiting', 'Kindle MCP 登录助手');

    console.log('\n┌──────────────────────────────────────────────────┐');
    console.log('│  📋 请按照以下步骤操作：                  │');
    console.log('│                                           │');
    console.log('│  1️⃣  点击页面右上角的 "Sign in" 按钮    │');
    console.log('│  2️⃣  输入你的 Amazon 账号和密码        │');
    console.log('│  3️⃣  完成双因素认证（2FA）（如需要）      │');
    console.log('│                                           │');
    console.log('│  ✨ 登录成功后，系统会自动跳转到        │');
    console.log('│     Kindle 笔记本页面                      │');
    console.log('│                                           │');
    console.log('│  ⏳ 正在等待登录完成...                  │');
    console.log('└──────────────────────────────────────────────────┘\n');

    let loginCheckInterval: NodeJS.Timeout | null = null;
    let navigationInProgress = false;
    let checkCount = 0;

    // Step 2 & 3: 轮询检测登录状态
    await new Promise<void>((resolve) => {
      const checkLoginStatus = async () => {
        if (navigationInProgress) return;
        checkCount++;

        try {
          // 更新横幅显示等待状态
          if (checkCount % 5 === 0) { // 每15秒更新一次
            await injectBanner(page, 'waiting', '正在等待登录完成...');
          }

          // 创建测试页面来验证登录状态
          const notebookUrl = `https://read.amazon.${region}/notebook`;
          const testPage = await context.newPage();

          const response = await testPage.goto(notebookUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 10000,
          }).catch(() => null);

          const testUrl = testPage.url();
          await testPage.close();

          // 判断：没有被重定向到 signin 说明登录成功
          if (!testUrl.includes('/signin') && !testUrl.includes('/ap/signin')) {
            navigationInProgress = true;
            if (loginCheckInterval) clearInterval(loginCheckInterval);

            console.log('\n✅ 检测到登录成功！');
            console.log('🔄 正在自动跳转到 Kindle 笔记本页面...\n');

            // 更新横幅为导航中状态
            await injectBanner(page, 'navigating', '登录成功！正在跳转...');

            // Step 4: 自动导航到 notebook
            await page.goto(notebookUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 30000,
            });

            const finalUrl = page.url();
            if (finalUrl.includes('/notebook')) {
              console.log('🎉 成功访问 Kindle 笔记本页面！\n');

              // 更新横幅为成功状态
              await injectBanner(page, 'success', '设置完成！Session 已保存');

              console.log('┌──────────────────────────────────────────────────┐');
              console.log('│  ✅ 设置完成！                             │');
              console.log('│                                           │');
              console.log('│  💾 Session 已保存到本地               │');
              console.log('│  🎉 您现在可以关闭浏览器了                 │');
              console.log('│                                           │');
              console.log('│  💡 提示：                              │');
              console.log('│  • Session 通常可以保持数天到数周           │');
              console.log('│  • 如果频繁过期，可能是 Amazon 安全策略     │');
              console.log('│  • 建议定期（如每周）重新登录一次        │');
              console.log('│                                           │');
              console.log('│  📖 关闭浏览器后，即可开始使用 MCP 工具   │');
              console.log('└──────────────────────────────────────────────────┘\n');

              return;
            }

            console.log('⚠️  跳转后 URL:', finalUrl);
          }

        } catch (error) {
          // 忽略轮询错误，继续检查
        }
      };

      // 每 3 秒检查一次登录状态
      loginCheckInterval = setInterval(checkLoginStatus, 3000);

      // Step 5: 等待用户关闭浏览器
      context.on('close', () => {
        if (loginCheckInterval) clearInterval(loginCheckInterval);
        console.log('\n👋 浏览器已关闭');
        console.log('✅ 流程完成！\n');
      });
    });

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('  ✅ 登录流程已完成！                             ');
    console.log('                                                   ');
    console.log('  🎉 您现在可以使用 MCP 工具来抓取笔记了    ');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ 登录过程发生错误:', error);
    throw error;
  } finally {
    await context.close();
  }
}

/**
 * 检查 Session 是否有效
 */
export async function validateSession(
  region: AmazonRegion = 'co.jp'
): Promise<boolean> {
  const USER_DATA_DIR = join(PROJECT_ROOT, 'kindle-mcp-profile');

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: true,
    viewport: { width: 1280, height: 720 },
  });

  try {
    const page = await context.newPage();
    const notebookUrl = `https://read.amazon.${region}/notebook`;

    await page.goto(notebookUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    const url = page.url();
    await context.close();

    // 如果被重定向到登录页，session 无效
    return !url.includes('/signin') && !url.includes('/ap/signin');
  } catch (error) {
    await context.close();
    return false;
  }
}
