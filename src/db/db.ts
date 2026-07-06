import fs from 'fs';
import path from 'path';

export interface AppState {
  users: Array<{ id: string; name: string; email: string; accessToken: string; refreshToken: string; tokenExpiry: string; avatarUrl?: string }>;
  videos: Array<{
    id: string;
    targetUserId: string;
    sourceUrl: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    status: 'queued' | 'downloading' | 'downloaded' | 'uploading' | 'completed' | 'failed';
    progress: number;
    retryCount: number;
    maxRetries: number;
    queuedAt: string;
    completedAt?: string;
    privacyStatus: string;
    tags: string[];
    scheduleRuleId?: string;
    isRewritten: boolean;
    autoOptimizeSeo: boolean;
    seoThumbnailUrl?: string;
    cpsPrediction?: { score: number; ctr: number; tagsSuggestions: string[] };
    error?: string;
  }>;
  processedVideoIds: string[];
  scheduleRules: Array<{
    id: string;
    name: string;
    sourceChannelUrl: string;
    titlePrefix: string;
    titleSuffix: string;
    descriptionTemplate: string;
    tags: string[];
    privacyStatus: string;
    intervalMinutes: number;
    targetUserId: string;
    enabled: boolean;
    lastCheckedAt?: string;
    autoOptimizeSeo: boolean;
    maxLatestVideos: number;
  }>;
  logs: Array<{
    id: string;
    level: 'info' | 'success' | 'warn' | 'error';
    message: string;
    timestamp: string;
    details?: any;
  }>;
  settings: {
    googleClientId: string;
    googleClientSecret: string;
    geminiApiKey: string;
    maxConcurrentUploads: number;
    maxRetries: number;
    videoQuality: string;
    autoClearHistoryDays: number;
    youtubeCookies?: string;
    youtubePoToken?: string;
    youtubeVisitorData?: string;
  };
}

const defaultState: AppState = {
  users: [],
  videos: [],
  processedVideoIds: [],
  scheduleRules: [],
  logs: [],
  settings: {
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    maxConcurrentUploads: 1,
    maxRetries: 3,
    videoQuality: '1080p',
    autoClearHistoryDays: 7,
    youtubeCookies: '',
    youtubePoToken: '',
    youtubeVisitorData: '',
  },
};

const DB_FILE = path.resolve(process.cwd(), 'db.json');

let lock = false;

export function getDb(): AppState {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultState, null, 2), 'utf-8');
    return defaultState;
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data) as AppState;
  } catch (e) {
    return defaultState;
  }
}

export function saveDb(state: AppState) {
  // Simple synchronous spin-wait lock to prevent race conditions
  // In a real app we'd use better synchronization, but this works for basic JSON storage
  let retries = 0;
  while (lock && retries < 100) {
    // block
    retries++;
  }
  lock = true;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } finally {
    lock = false;
  }
}

export function addLog(level: 'info' | 'success' | 'warn' | 'error', message: string, details?: any) {
  const state = getDb();
  state.logs.unshift({
    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    level,
    message,
    timestamp: new Date().toISOString(),
    details,
  });
  // Keep only last 1000 logs
  if (state.logs.length > 1000) {
    state.logs = state.logs.slice(0, 1000);
  }
  saveDb(state);
}

export function isVideoAlreadyProcessed(url: string, title: string): boolean {
  const state = getDb();
  // Extract 11 char video ID from URL
  const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/) || url.match(/youtube\.com\/shorts\/([^?]+)/);
  const videoId = match ? match[1] : null;

  if (videoId && state.processedVideoIds.includes(videoId)) {
    return true;
  }
  
  if (state.videos.some(v => v.sourceUrl === url || v.title.toLowerCase() === title.toLowerCase())) {
    return true;
  }
  
  return false;
}
