import { chromium } from 'playwright-core';
import type { BrowserProfile } from './browserLocator';

export class BrowserCookieReader {
  async read(profile: BrowserProfile, signal?: AbortSignal): Promise<Record<string,string>> {
    const context = await chromium.launchPersistentContext(profile.userDataDir, { executablePath: profile.executablePath, headless: true, args: [`--profile-directory=${profile.profileDir}`] }).catch(() => { throw new Error('请关闭所选浏览器后重试'); });
    const abort = () => void context.close(); signal?.addEventListener('abort', abort, { once: true });
    try { const page = await context.newPage(); await page.goto('https://www.xiaohongshu.com/', { waitUntil: 'domcontentloaded', timeout: 30_000 }); const cookies = await context.cookies('https://www.xiaohongshu.com/'); const result = Object.fromEntries(cookies.filter((c) => c.domain === '.xiaohongshu.com' || c.domain.endsWith('.xiaohongshu.com')).map((c) => [c.name, c.value])); if (!result.a1) throw new Error('未找到可用登录信息'); return result; } finally { signal?.removeEventListener('abort', abort); await context.close(); }
  }
}
