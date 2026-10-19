import * as vscode from 'vscode';
import { CookieStore } from './auth/cookieStore';
import { BrowserLocator } from './auth/browserLocator';
import { BrowserCookieReader } from './auth/browserCookieReader';
import { QrLoginService } from './auth/qrLoginService';
import { AuthService } from './auth/authService';
import { RequestScheduler } from './api/requestScheduler';
import { Transport } from './api/transport';
import { XhsClient } from './api/xhsClient';
import { ExploreController } from './views/exploreState';
import { ExploreTreeProvider } from './views/exploreTreeProvider';
import { PostDetailViewProvider } from './views/postDetailViewProvider';
import { LoginPanel } from './views/loginPanel';
import type { NoteSummary } from './domain/models';

let disposeAuth: (() => Promise<void>) | undefined;
export function activate(context: vscode.ExtensionContext): void {
  if (process.platform !== 'win32') { void vscode.window.showWarningMessage('阅读扩展目前仅支持 Windows。'); return; }
  const store = new CookieStore(context.secrets);
  const scheduler = new RequestScheduler();
  const client = new XhsClient(new Transport({ scheduler }), async () => { const cookies = await store.load(); if (!cookies) throw new Error('请先连接账号'); return cookies; });
  const detail = new PostDetailViewProvider(client);
  const explore = new ExploreController(client, () => tree.refresh(), (ref) => void detail.show(ref));
  const tree = new ExploreTreeProvider(explore);
  const locator = new BrowserLocator();
  const qr = new QrLoginService(async () => { const edge = (await locator.discover()).find((p) => p.browser === 'edge'); if (!edge) throw new Error('未找到 Microsoft Edge'); return edge.executablePath; });
  const clearSession = () => { scheduler.cancelAll(); scheduler.resume(); detail.clear(); explore.reset(); };
  const auth = new AuthService(store, client, new BrowserCookieReader(), qr, (cookies) => client.statusWithCookies(cookies), () => tree.refresh(), clearSession);
  const login = new LoginPanel(auth, locator, () => tree.refresh());
  disposeAuth = () => auth.dispose();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('reader.explore', tree),
    vscode.window.registerWebviewViewProvider('reader.detail', detail),
    vscode.commands.registerCommand('reader.login', () => login.open()),
    vscode.commands.registerCommand('reader.logout', () => auth.logout()),
    vscode.commands.registerCommand('reader.refresh', () => explore.refresh()),
    vscode.commands.registerCommand('reader.search', async () => { const query = await vscode.window.showInputBox({ prompt: '搜索帖子' }); if (query) await explore.search(query); }),
    vscode.commands.registerCommand('reader.showRecommend', () => explore.showRecommend()),
    vscode.commands.registerCommand('reader.showTrending', () => explore.showTrending('all')),
    vscode.commands.registerCommand('reader.loadMore', () => explore.loadMore()),
    vscode.commands.registerCommand('reader.openNote', (note: NoteSummary) => detail.show(note.ref, note.coverUrl)),
    { dispose: () => { login.dispose(); scheduler.cancelAll(); void auth.dispose(); } }
  );
  void explore.showRecommend().catch(() => undefined);
}

export async function deactivate(): Promise<void> { await disposeAuth?.(); }
