export const WALLET_DAILY_TASK_TOTAL_TICKETS = 15;

export const WALLET_DAILY_TASKS = [
  {
    key: 'check_in',
    title: 'Daily Check-in',
    description: 'Open the wallet once today.',
    ticketReward: 2,
    target: 1,
  },
  {
    key: 'daily_first_movie',
    title: 'First Daily Film',
    description: 'Finish quiz questions for one Daily film.',
    ticketReward: 3,
    target: 1,
  },
  {
    key: 'daily_five_movies',
    title: 'Close the Daily Five',
    description: 'Complete all five Daily film quizzes.',
    ticketReward: 4,
    target: 5,
  },
  {
    key: 'daily_comment',
    title: 'Leave a Note',
    description: 'Publish one rewardable rating and comment.',
    ticketReward: 4,
    target: 1,
  },
  {
    key: 'quiz_side_quest',
    title: 'Quiz Side Quest',
    description: 'Play Quick, Marathon, Rush, or Blur today.',
    ticketReward: 2,
    target: 1,
  },
] as const;

export type WalletDailyTaskKey = (typeof WALLET_DAILY_TASKS)[number]['key'];

export type WalletDailyTaskStatus = 'locked' | 'ready' | 'claimed';

export type WalletDailyTaskSnapshot = {
  key: WalletDailyTaskKey;
  title: string;
  description: string;
  ticketReward: number;
  progress: number;
  target: number;
  status: WalletDailyTaskStatus;
};

export const isWalletDailyTaskKey = (value: unknown): value is WalletDailyTaskKey =>
  WALLET_DAILY_TASKS.some((task) => task.key === String(value || '').trim());

export const findWalletDailyTask = (key: unknown) =>
  WALLET_DAILY_TASKS.find((task) => task.key === String(key || '').trim()) || null;
