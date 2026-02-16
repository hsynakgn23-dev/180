export const ANALYTICS_EVENT_NAMES = [
    'session_start',
    'page_view',
    'auth_view',
    'auth_submit',
    'auth_failure',
    'signup_success',
    'signup_pending_confirmation',
    'login_success',
    'oauth_start',
    'oauth_redirect_started',
    'oauth_failure',
    'password_reset_requested',
    'password_reset_completed',
    'ritual_submit_failed',
    'ritual_submitted',
    'share_click',
    'share_opened',
    'share_failed',
    'share_reward_claimed',
    'share_reward_denied',
    'invite_created',
    'invite_clicked',
    'invite_accepted',
    'invite_reward_granted',
    'invite_claim_failed'
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
