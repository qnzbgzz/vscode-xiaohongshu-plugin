import type { AccountSummary } from '../domain/models';
import type { XhsReader } from '../api/xhsClient';
import { parseCookieHeader } from './cookieParser';
import { CookieStore } from './cookieStore';
import type { BrowserProfile } from './browserLocator';
import { BrowserCookieReader } from './browserCookieReader';
import { QrLoginService, type QrSession } from './qrLoginService';

export class AuthService {
  private epoch = 0;
  constructor(private readonly store: CookieStore, private readonly reader: XhsReader, private readonly browser: BrowserCookieReader, private readonly qr: QrLoginService, private readonly validate: (cookies: Record<string,string>) => Promise<AccountSummary>, private readonly onChanged: () => void, private readonly onLogout: () => void) {}
  async loginWithCookie(header: string): Promise<AccountSummary> {
    const cookies = parseCookieHeader(header);
    if (!cookies.a1 || !cookies.web_session) {
      throw new Error('Cookie 不完整：需要 a1 和 web_session。请从已登录的小红书网页 Network 请求头复制完整 Cookie，不要只复制单个值。');
    }
    const epoch = this.epoch;
    return this.accept(cookies, epoch);
  }
  async loginWithBrowser(profile: BrowserProfile, signal?: AbortSignal): Promise<AccountSummary> { const epoch = this.epoch; return this.accept(await this.browser.read(profile, signal), epoch); }
  async startQrLogin(signal?: AbortSignal): Promise<QrSession> { const epoch = this.epoch; const session = await this.qr.start(signal); const wait = session.waitForCompletion.bind(session); session.waitForCompletion = async () => { const cookies = await wait(); await this.accept(cookies, epoch); return cookies; }; return session; }
  async status(): Promise<AccountSummary> { if (!await this.store.load()) return { authenticated: false }; return this.reader.status(); }
  async cancelPendingLogin(): Promise<void> { this.epoch += 1; await this.qr.dispose(); }
  async logout(): Promise<void> { await this.cancelPendingLogin(); this.onLogout(); await this.store.clear(); this.onChanged(); }
  private async accept(cookies: Record<string,string>, epoch: number): Promise<AccountSummary> { const status = await this.validate(cookies); if (!status.authenticated) throw new Error('该 Cookie 对应游客或未登录状态。请在浏览器登录小红书，刷新页面后重新复制包含 a1 和 web_session 的完整 Cookie'); if (epoch !== this.epoch) throw new Error('登录已取消'); await this.store.save(cookies); if (epoch !== this.epoch) { await this.store.clear(); throw new Error('登录已取消'); } this.onChanged(); return status; }
  async dispose(): Promise<void> { await this.qr.dispose(); }
}
