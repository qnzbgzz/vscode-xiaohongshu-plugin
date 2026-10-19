import * as vscode from 'vscode';
import type { AuthService } from '../auth/authService';
import type { BrowserLocator, BrowserProfile } from '../auth/browserLocator';
import type { AccountSummary } from '../domain/models';
import { renderLogin } from './loginHtml';
import { parseWebviewMessage } from './messages';
export class LoginPanel { private panel?: vscode.WebviewPanel; private profiles: BrowserProfile[] = []; private account: AccountSummary = { authenticated: false }; private qr?: {dataUrl:string;expiresAt:number;status?:string};
  constructor(private readonly auth: AuthService, private readonly locator: BrowserLocator, private readonly changed: () => void) {}
  async open() { if (!this.panel) { this.panel = vscode.window.createWebviewPanel('reader.login','连接账号',vscode.ViewColumn.Active,{enableScripts:true}); this.panel.onDidDispose(()=>{this.panel=undefined;this.qr=undefined;void this.auth.cancelPendingLogin();}); this.panel.webview.onDidReceiveMessage((m)=>void this.message(m)); } [this.account,this.profiles] = await Promise.all([this.auth.status().catch(()=>({authenticated:false})),this.locator.discover()]); this.render(); this.panel.reveal(); }
  dispose() { this.panel?.dispose(); void this.auth.cancelPendingLogin(); }
  private async message(raw: unknown) { const safe=parseWebviewMessage(raw); const type=(raw as {type?:string}).type; try { if(safe?.type==='requestManualCookieInput'){const value=await vscode.window.showInputBox({prompt:'粘贴小红书 Cookie',password:true,ignoreFocusOut:true});if(value)this.account=await this.auth.loginWithCookie(value);} else if(type==='loginWithBrowser'){const p=this.profiles[Number((raw as {profile:number}).profile)];if(p)this.account=await this.auth.loginWithBrowser(p);} else if(type==='startQr'){const q=await this.auth.startQrLogin();this.qr={...q,status:'等待扫码'};q.onStatus((status)=>{if(this.qr){this.qr.status=status;this.render();}});this.render();void q.waitForCompletion().then(()=>this.open()).catch((e)=>void vscode.window.showErrorMessage(e instanceof Error?e.message:'二维码登录失败'));return;} else if(type==='logout'){await this.auth.logout();this.account={authenticated:false};this.qr=undefined;} this.changed();}catch(e){void vscode.window.showErrorMessage(e instanceof Error?e.message:'操作失败');} this.render(); }
  private render(){if(this.panel)this.panel.webview.html=renderLogin(this.account,this.profiles,Math.random().toString(36).slice(2),this.qr);}
}
