import * as vscode from 'vscode';
import type { Comment, NoteDetail, NoteRef } from '../domain/models';
import type { XhsReader } from '../api/xhsClient';
import { renderPostDetail } from './postDetailHtml';
import { parseWebviewMessage } from './messages';
export class PostDetailViewProvider implements vscode.WebviewViewProvider { private view?: vscode.WebviewView; private ref?: NoteRef; private note?: NoteDetail; private comments: Comment[] = []; private cursor = '';
  private abort?: AbortController;
  private resetOnReady = false;
  constructor(private readonly reader: XhsReader) {}
  resolveWebviewView(view: vscode.WebviewView) { this.view = view; view.webview.options = { enableScripts: true }; view.webview.onDidReceiveMessage((raw) => { const type = (raw as {type?:string}).type; const m = parseWebviewMessage(raw); if (type === 'detailReady' && this.resetOnReady) { this.resetOnReady = false; void view.webview.postMessage({ type: 'resetScroll' }); } else if (m?.type === 'loadReplies') void this.loadReplies(m.commentId); else if (type === 'loadMoreComments') void this.loadMoreComments(); }); this.render(); }
  async show(ref: NoteRef, listCoverUrl?: string) { this.abort?.abort(); const abort = new AbortController(); this.abort = abort; this.ref = ref; const [note, comments] = await Promise.all([this.reader.note(ref, abort.signal), this.reader.comments(ref, '', abort.signal)]); const fallbackCover = note.coverUrl ?? listCoverUrl ?? ref.coverUrl; const sourceImages = note.imageUrls.length > 0 ? note.imageUrls : fallbackCover ? [fallbackCover] : []; const imageUrls = await this.loadImages(sourceImages, abort.signal); const loadedComments = await this.loadCommentImages(comments.items, abort.signal); if (abort.signal.aborted) return; this.note = { ...note, coverUrl: fallbackCover, imageUrls }; this.comments = loadedComments; this.cursor = comments.nextCursor ?? ''; this.render(true); }
  async loadMoreComments() { if (!this.ref) return; const p = await this.reader.comments(this.ref, this.cursor); this.comments.push(...await this.loadCommentImages(p.items)); this.cursor = p.nextCursor ?? ''; this.render(); }
  async loadReplies(commentId: string) { if (!this.ref) return; const p = await this.reader.replies(this.ref, commentId); const target = this.comments.find((c) => c.id === commentId); if (target) { target.replies.push(...await this.loadCommentImages(p.items)); target.hasMoreReplies = p.hasMore; } this.render(); }
  clear() { this.abort?.abort(); this.ref = undefined; this.note = undefined; this.comments = []; this.render(); }
  private render(resetScroll = false) { if (!this.view) return; this.resetOnReady = resetScroll; this.view.webview.html = renderPostDetail(this.note, this.comments, Math.random().toString(36).slice(2)); }
  private async loadImages(urls: string[], signal?: AbortSignal): Promise<string[]> { const loaded: string[] = []; for (const url of urls) { if (signal?.aborted) return loaded; loaded.push(await this.reader.imageDataUrl(url, signal).catch(() => url)); } return loaded; }
  private async loadCommentImages(comments: Comment[], signal?: AbortSignal): Promise<Comment[]> { const loaded: Comment[] = []; for (const comment of comments) { if (signal?.aborted) return loaded; loaded.push({ ...comment, imageUrls: await this.loadImages(comment.imageUrls, signal), replies: await this.loadCommentImages(comment.replies, signal) }); } return loaded; }
}
