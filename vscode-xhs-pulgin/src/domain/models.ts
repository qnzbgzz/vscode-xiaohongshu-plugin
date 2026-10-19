export interface AccountSummary {
  authenticated: boolean;
  userId?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface NoteRef {
  id: string;
  xsecToken?: string;
  xsecSource?: string;
  coverUrl?: string;
}

export interface AuthorSummary {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

export type NoteType = 'image' | 'video';

export type NoteSource = 'recommend' | 'trending' | 'search';

export interface NoteSummary {
  ref: NoteRef;
  title: string;
  author: AuthorSummary;
  coverUrl?: string;
  type: NoteType;
  likeCount: number;
  source: NoteSource;
}

export interface NoteDetail extends NoteSummary {
  content: string;
  imageUrls: string[];
  publishedAt?: string;
  location?: string;
  tags: string[];
  collectCount: number;
  commentCount: number;
  shareCount: number;
}

export interface Comment {
  id: string;
  author: AuthorSummary;
  content: string;
  imageUrls: string[];
  createdAt?: string;
  likeCount: number;
  replies: Comment[];
  replyCursor?: string;
  hasMoreReplies: boolean;
}

export interface Page<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: string;
  nextPage?: number;
}
