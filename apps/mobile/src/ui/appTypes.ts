import type { PushInboxItem } from '../lib/mobilePushInbox';
import type {
  CommentFeedScope,
  CommentFeedSort,
  MobileCommentFeedItem,
} from '../lib/mobileCommentsFeed';

type PushInboxFilter =
  | 'all'
  | 'unread_link'
  | 'with_link'
  | 'reply'
  | 'follow'
  | 'streak'
  | 'generic';

type PushInboxSort = 'newest' | 'oldest' | 'unopened_first' | 'opened_first';

const PUSH_INBOX_PAGE_SIZE = 6;
const PUSH_INBOX_FILTER_OPTIONS: Array<{ key: PushInboxFilter; label: string }> = [
  { key: 'all', label: 'Tum' },
  { key: 'unread_link', label: 'Yeni Link' },
  { key: 'with_link', label: 'Linkli' },
  { key: 'reply', label: 'Yanit' },
  { key: 'follow', label: 'Takip' },
  { key: 'streak', label: 'Streak' },
  { key: 'generic', label: 'Diger' },
];
const PUSH_INBOX_SORT_OPTIONS: Array<{ key: PushInboxSort; label: string }> = [
  { key: 'newest', label: 'En Yeni' },
  { key: 'oldest', label: 'En Eski' },
  { key: 'unopened_first', label: 'Yeni Ustte' },
  { key: 'opened_first', label: 'Acilan Ustte' },
];

const isPushInboxFilterKey = (value: string): value is PushInboxFilter =>
  PUSH_INBOX_FILTER_OPTIONS.some((option) => option.key === value);

const isPushInboxSortKey = (value: string): value is PushInboxSort =>
  PUSH_INBOX_SORT_OPTIONS.some((option) => option.key === value);

type DailyState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string; endpoint: string }
  | {
      status: 'success';
      endpoint: string;
      date: string | null;
      source: string | null;
      dataSource: 'live' | 'cache' | 'fallback';
      cacheAgeSeconds: number | null;
      stale: boolean;
      warning: string | null;
      movies: Array<{
        id: number;
        title: string;
        voteAverage: number | null;
        genre: string | null;
        year: number | null;
        director: string | null;
        overview: string | null;
        posterPath: string | null;
        cast: string[];
        originalLanguage: string | null;
      }>;
    };

type InviteClaimState =
  | { status: 'idle' }
  | { status: 'loading'; inviteCode: string }
  | {
      status: 'success';
      inviteCode: string;
      message: string;
      inviteeRewardXp: number;
      inviterRewardXp: number;
      claimCount: number;
    }
  | { status: 'error'; inviteCode: string; message: string; errorCode: string };

type AuthState =
  | { status: 'idle'; message: string }
  | { status: 'loading'; message: string }
  | { status: 'signed_out'; message: string }
  | { status: 'signed_in'; message: string; email: string }
  | { status: 'error'; message: string };

type RitualSubmitState = {
  status: 'idle' | 'submitting' | 'synced' | 'queued' | 'error';
  message: string;
};

type RitualQueueState = {
  status: 'idle' | 'syncing' | 'done' | 'error';
  message: string;
  pendingCount: number;
};

type ProfileState =
  | { status: 'idle' | 'loading'; message: string }
  | { status: 'error'; message: string }
  | {
      status: 'success';
      message: string;
      displayName: string;
      totalXp: number;
      leagueKey: string;
      leagueName: string;
      leagueColor: string;
      nextLeagueKey: string | null;
      nextLeagueName: string | null;
      streak: number;
      ritualsCount: number;
      daysPresent: number;
      followersCount: number;
      followingCount: number;
      marks: string[];
      featuredMarks: string[];
      lastRitualDate: string | null;
      source: 'xp_state' | 'fallback';
    };

type CommentFeedState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  source: 'live' | 'fallback';
  scope: CommentFeedScope;
  sort: CommentFeedSort;
  query: string;
  page: number;
  pageSize: number;
  hasMore: boolean;
  isAppending: boolean;
  items: MobileCommentFeedItem[];
};

type PushState =
  | {
      status: 'idle' | 'loading';
      message: string;
      permissionStatus: string;
      token: string;
      projectId: string | null;
      lastNotification: string;
      cloudStatus: 'idle' | 'syncing' | 'synced' | 'error';
      cloudMessage: string;
      deviceKey: string;
      lastSyncedToken: string;
    }
  | {
      status: 'error' | 'ready' | 'unsupported';
      message: string;
      permissionStatus: string;
      token: string;
      projectId: string | null;
      lastNotification: string;
      cloudStatus: 'idle' | 'syncing' | 'synced' | 'error';
      cloudMessage: string;
      deviceKey: string;
      lastSyncedToken: string;
    };

type PushTestState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  sentCount: number;
  ticketCount: number;
  errorCount: number;
  ticketIdCount: number;
  receiptStatus: 'idle' | 'ok' | 'unavailable';
  receiptCheckedCount: number;
  receiptOkCount: number;
  receiptErrorCount: number;
  receiptPendingCount: number;
  receiptMessage: string;
  receiptErrorPreview: string;
};

type LocalPushSimState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
};

type PushInboxState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  items: PushInboxItem[];
};

export type {
  PushInboxFilter,
  PushInboxSort,
  DailyState,
  InviteClaimState,
  AuthState,
  RitualSubmitState,
  RitualQueueState,
  ProfileState,
  PushState,
  PushTestState,
  LocalPushSimState,
  PushInboxState,
  CommentFeedState,
  CommentFeedScope,
  CommentFeedSort,
};

export {
  PUSH_INBOX_PAGE_SIZE,
  PUSH_INBOX_FILTER_OPTIONS,
  PUSH_INBOX_SORT_OPTIONS,
  isPushInboxFilterKey,
  isPushInboxSortKey,
};

