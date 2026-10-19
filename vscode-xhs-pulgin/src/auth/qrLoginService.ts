import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type BrowserContext } from 'playwright-core';

const QR_COMPLETION_PATH = '/api/sns/web/v1/login/qrcode/status';

export interface QrSession {
  dataUrl: string;
  expiresAt: number;
  onStatus(listener: (status: string) => void): void;
  waitForCompletion(): Promise<Record<string, string>>;
  refresh(): Promise<QrSession>;
  close(): Promise<void>;
}

interface BrowserCookie { name: string; value: string; domain: string; }

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function completedQrCookies(browserCookies: BrowserCookie[], responseBody: unknown): Record<string, string> {
  const cookies = Object.fromEntries(browserCookies
    .filter((cookie) => cookie.domain.includes('xiaohongshu.com'))
    .map((cookie) => [cookie.name, cookie.value]));
  const root = record(responseBody);
  const data = record(root.data ?? root);
  const loginInfo = record(data.login_info);
  const session = data.session ?? loginInfo.session;
  const secureSession = data.secure_session ?? loginInfo.secure_session;
  if (typeof session === 'string' && session) cookies.web_session = session;
  if (typeof secureSession === 'string' && secureSession) cookies.web_session_sec = secureSession;
  return cookies;
}

export class QrLoginService {
  private active?: { context: BrowserContext; dir: string };
  constructor(private readonly edgePath: () => Promise<string>) {}

  async start(signal?: AbortSignal): Promise<QrSession> {
    await this.dispose();
    const dir = await mkdtemp(join(tmpdir(), 'reader-login-'));
    let browser: BrowserContext | undefined;
    try {
      browser = await chromium.launchPersistentContext(dir, { executablePath: await this.edgePath(), headless: false });
      const owned = { context: browser, dir };
      this.active = owned;
      const onAbort = () => void close();
      const close = async () => {
        signal?.removeEventListener('abort', onAbort);
        await browser?.close().catch(() => undefined);
        await rm(dir, { recursive: true, force: true });
        if (this.active === owned) this.active = undefined;
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      const page = await browser.newPage();
      await page.goto('https://www.xiaohongshu.com/login', { waitUntil: 'domcontentloaded' });
      const qr = await page.waitForSelector('canvas, img[class*="qrcode"], img[class*="qr"]', { timeout: 20_000 });
      const dataUrl = `data:image/png;base64,${(await qr.screenshot()).toString('base64')}`;
      const listeners = new Set<(status: string) => void>();
      let status = '等待扫码';
      let completionBody: unknown;
      const emit = (next: string) => {
        if (next === status) return;
        status = next;
        for (const listener of listeners) listener(status);
      };
      page.on('response', (response) => {
        void (async () => {
          if (response.url().includes('/api/qrcode/userinfo')) {
            const body = record(await response.json().catch(() => ({})));
            const data = record(body.data ?? body);
            if (Number(data.codeStatus) === 1) emit('已扫码，请在手机上确认');
            if (Number(data.codeStatus) === 2) emit('手机已确认，正在连接账号');
          }
          if (response.url().includes(QR_COMPLETION_PATH) && response.ok()) {
            completionBody = await response.json().catch(() => ({}));
            emit('手机已确认，正在连接账号');
          }
        })().catch(() => undefined);
      });

      const waitForCompletion = async () => {
        try {
          const deadline = Date.now() + 240_000;
          while (Date.now() < deadline && this.active === owned && !signal?.aborted) {
            const cookies = completedQrCookies(await browser!.cookies(), completionBody);
            if (cookies.a1 && cookies.web_session) {
              emit('登录成功');
              return cookies;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          if (this.active !== owned || signal?.aborted) throw new Error('登录已取消');
          throw new Error('二维码已过期，请重新生成');
        } finally {
          await close();
        }
      };

      return { dataUrl, expiresAt: Date.now() + 240_000, onStatus: (listener) => { listeners.add(listener); listener(status); }, waitForCompletion, refresh: async () => { await close(); return this.start(signal); }, close };
    } catch (error) {
      await browser?.close().catch(() => undefined);
      await rm(dir, { recursive: true, force: true });
      if (this.active?.dir === dir) this.active = undefined;
      throw error;
    }
  }

  async dispose(): Promise<void> {
    const active = this.active;
    this.active = undefined;
    if (!active) return;
    await active.context.close().catch(() => undefined);
    await rm(active.dir, { recursive: true, force: true });
  }
}
