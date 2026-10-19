import { access, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

export interface BrowserProfile { browser: 'edge'|'chrome'; name: string; userDataDir: string; profileDir: string; executablePath: string; }
export class BrowserLocator {
  async discover(): Promise<BrowserProfile[]> {
    const local = process.env.LOCALAPPDATA ?? '';
    const pf = process.env['PROGRAMFILES'] ?? 'C:\\Program Files';
    const pfx = process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)';
    const defs = [
      { browser: 'edge' as const, user: join(local, 'Microsoft', 'Edge', 'User Data'), exes: [join(pfx, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe')] },
      { browser: 'chrome' as const, user: join(local, 'Google', 'Chrome', 'User Data'), exes: [join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'), join(pfx, 'Google', 'Chrome', 'Application', 'chrome.exe')] }
    ];
    const out: BrowserProfile[] = [];
    for (const d of defs) { const executablePath = await this.firstExisting(d.exes); if (!executablePath) continue; let dirs: string[] = []; try { dirs = await readdir(d.user); } catch { continue; } for (const name of dirs.filter((n) => n === 'Default' || /^Profile \d+$/.test(n))) out.push({ browser: d.browser, name, userDataDir: d.user, profileDir: name, executablePath }); }
    return out;
  }
  private async firstExisting(paths: string[]): Promise<string|undefined> { for (const p of paths) { try { await access(p, constants.X_OK); return p; } catch { /* continue */ } } return undefined; }
}
