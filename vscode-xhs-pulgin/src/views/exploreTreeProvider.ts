import * as vscode from 'vscode';
import type { NoteSummary } from '../domain/models';
import { ExploreController } from './exploreState';

type Node = { kind: 'header'|'note'|'more'; note?: NoteSummary };
export class ExploreTreeProvider implements vscode.TreeDataProvider<Node> {
  private readonly emitter = new vscode.EventEmitter<Node|undefined>(); readonly onDidChangeTreeData = this.emitter.event;
  constructor(readonly controller: ExploreController) {}
  refresh() { this.emitter.fire(undefined); }
  getChildren(node?: Node): Node[] { if (node) return []; return [{ kind: 'header' }, ...this.controller.items.map((note) => ({ kind: 'note' as const, note })), ...(this.controller.hasMore ? [{ kind: 'more' as const }] : [])]; }
  getTreeItem(node: Node): vscode.TreeItem { if (node.kind === 'header') { const i = new vscode.TreeItem(this.controller.title); i.iconPath = new vscode.ThemeIcon('list-filter'); return i; } if (node.kind === 'more') { const i = new vscode.TreeItem('加载更多…'); i.command = { command: 'reader.loadMore', title: '加载更多' }; i.iconPath = new vscode.ThemeIcon('more'); return i; } const n = node.note!; const i = new vscode.TreeItem(n.title || '无标题'); i.description = `${n.author.displayName}  ♡ ${n.likeCount}`; i.tooltip = n.title; i.command = { command: 'reader.openNote', title: '打开', arguments: [n] }; i.iconPath = new vscode.ThemeIcon('blank'); return i; }
}
