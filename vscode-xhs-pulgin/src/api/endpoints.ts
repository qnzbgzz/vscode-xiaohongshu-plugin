import type { GetParams, JsonObject } from './signing';

export interface Endpoint { method: 'GET' | 'POST'; path: string; params?: GetParams; body?: JsonObject; }
export const endpoints = {
  status: (): Endpoint => ({ method: 'GET', path: '/api/sns/web/v2/user/me' }),
  feed: (cursor = ''): Endpoint => ({ method: 'POST', path: '/api/sns/web/v1/homefeed', body: { cursor, num: 20, refresh_type: 1, note_index: 0, unread_begin_note_id: '', unread_end_note_id: '', unread_note_count: 0, category: 'homefeed_recommend' } }),
  trending: (category: string, page: number): Endpoint => ({ method: 'POST', path: '/api/sns/web/v1/homefeed', body: { category, cursor_score: '', num: 20, refresh_type: page === 1 ? 1 : 3, note_index: (page - 1) * 20 } }),
  search: (keyword: string, page: number): Endpoint => ({ method: 'POST', path: '/api/sns/web/v1/search/notes', body: { keyword, page, page_size: 20, search_id: '', sort: 'general', note_type: 0 } }),
  note: (id: string, token = '', source = 'pc_feed'): Endpoint => ({ method: 'POST', path: '/api/sns/web/v1/feed', body: { source_note_id: id, xsec_token: token, xsec_source: source, image_formats: ['jpg', 'webp', 'avif'], extra: { need_body_topic: '1' } } }),
  comments: (id: string, token = '', cursor = ''): Endpoint => ({ method: 'GET', path: '/api/sns/web/v2/comment/page', params: { note_id: id, cursor, top_comment_id: '', image_formats: 'jpg,webp,avif', xsec_token: token } }),
  replies: (id: string, commentId: string, token = '', cursor = ''): Endpoint => ({ method: 'GET', path: '/api/sns/web/v2/comment/sub/page', params: { note_id: id, root_comment_id: commentId, cursor, num: 10, image_formats: 'jpg,webp,avif', xsec_token: token } })
};
