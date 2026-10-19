import type { NoteRef, NoteSummary } from '../domain/models';
import type { TrendingCategory, XhsReader } from '../api/xhsClient';

type Mode = { kind: 'recommend' } | { kind: 'trending'; category: TrendingCategory } | { kind: 'search'; query: string };
interface State { items: NoteSummary[]; cursor?: string; page: number; hasMore: boolean; }
export class ExploreController {
  private mode: Mode = { kind: 'recommend' }; private readonly states = new Map<string, State>(); private abort?: AbortController;
  constructor(private readonly reader: XhsReader, private readonly changed: () => void, private readonly selected: (ref: NoteRef) => void) {}
  get items() { return this.state().items; } get hasMore() { return this.state().hasMore; } get title() { return this.mode.kind === 'recommend' ? '推荐' : this.mode.kind === 'trending' ? '热门' : `搜索：${this.mode.query}`; }
  async showRecommend() { this.mode = { kind: 'recommend' }; await this.ensure(); }
  async showTrending(category: TrendingCategory) { this.mode = { kind: 'trending', category }; await this.ensure(); }
  async search(query: string) { this.abort?.abort(); this.mode = { kind: 'search', query }; await this.refresh(); }
  async refresh() { await this.load(true); }
  async loadMore() { if (this.hasMore) await this.load(false); }
  selectNote(ref: NoteRef) { this.selected(ref); }
  reset() { this.abort?.abort(); this.states.clear(); this.changed(); }
  private key() { return JSON.stringify(this.mode); }
  private state() { return this.states.get(this.key()) ?? { items: [], page: 1, hasMore: true }; }
  private async ensure() { if (!this.states.has(this.key())) await this.load(true); else this.changed(); }
  private async load(reset: boolean) { const previous = this.state(); this.abort?.abort(); this.abort = new AbortController(); const page = reset ? 1 : previous.page + 1; const result = this.mode.kind === 'recommend' ? await this.reader.feed(reset ? '' : previous.cursor, this.abort.signal) : this.mode.kind === 'trending' ? await this.reader.trending(this.mode.category, page, this.abort.signal) : await this.reader.search({ keyword: this.mode.query, page }, this.abort.signal); const items = reset ? result.items : [...previous.items, ...result.items.filter((n) => !previous.items.some((p) => p.ref.id === n.ref.id))]; this.states.set(this.key(), { items, page, cursor: result.nextCursor, hasMore: result.hasMore }); this.changed(); }
}
