import axios from 'axios';
import type {
  Platform,
  Account,
  Post,
  CreateAccountRequest,
  UpdateAccountRequest,
  CreatePostRequest,
  SchedulePostRequest,
  TestAccountResponse,
} from './types';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

axios.defaults.withCredentials = true;

export { api };

// Replace previously manual auth interceptors with a no-op or just leave comments since cookies are sent automatically.
// The cookies are now HttpOnly and managed by the browser.

// Track whether a refresh is already in-flight to prevent loops
let _refreshing = false;
let _refreshSubscribers: Array<(success: boolean) => void> = [];

function _subscribeToRefresh(cb: (success: boolean) => void) {
  _refreshSubscribers.push(cb);
}

function _notifyRefreshSubscribers(success: boolean) {
  _refreshSubscribers.forEach((cb) => cb(success));
  _refreshSubscribers = [];
}

async function _tryRefreshToken(): Promise<boolean> {
  try {
    const response = await axios.post('/api/v2/auth/refresh');
    // If successful, the backend will have established new HttpOnly cookies on the response, which the browser automatically stores and utilizes.
    return response.status === 200;
  } catch {
    // Refresh failed – fall through to logout
  }
  return false;
}

async function _logout() {
  localStorage.removeItem('user');
  try {
    await axios.post('/api/v2/auth/logout');
  } catch (e) { }
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// Handle 401 (attempt token refresh once) and 429 (Retry-After) responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    // ── 429 Too Many Requests ──────────────────────────────────────────────
    if (status === 429) {
      const config = error.config;
      if (!config) return Promise.reject(error);

      // Only auto-retry idempotent methods to avoid duplicating side effects
      const method = (config.method ?? 'get').toLowerCase();
      if (!['get', 'head', 'options'].includes(method)) return Promise.reject(error);

      const cfgAny = config as any;
      const retryCount: number = typeof cfgAny._retryCount === 'number' ? cfgAny._retryCount : 0;
      if (retryCount >= 3) return Promise.reject(error);
      cfgAny._retryCount = retryCount + 1;

      const retryAfter = Number(error.response.headers['retry-after'] ?? 1);
      console.warn(`Rate limited. Retrying after ${retryAfter}s (attempt ${cfgAny._retryCount}/3)`);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return api.request(config);
    }

    // ── 401 Unauthorised – try a one-shot token refresh ───────────────────
    if (status === 401 && !error.config?._retried) {
      if (_refreshing) {
        // Another request already triggered a refresh – wait for it
        return new Promise((resolve, reject) => {
          _subscribeToRefresh((success) => {
            if (success) {
              error.config._retried = true;
              resolve(api.request(error.config));
            } else {
              reject(error);
            }
          });
        });
      }

      _refreshing = true;
      error.config._retried = true;

      const success = await _tryRefreshToken();
      _refreshing = false;
      _notifyRefreshSubscribers(success);

      if (success) {
        return api.request(error.config);
      }

      await _logout();
    }

    return Promise.reject(error);
  }
);

export const accountsApi = {
  getAll: async (): Promise<{ accounts: Account[]; count: number }> => {
    const response = await api.get('/accounts');
    return response.data;
  },

  getOne: async (id: string): Promise<{ account: Account }> => {
    const response = await api.get(`/accounts/${id}`);
    return response.data;
  },

  create: async (data: CreateAccountRequest): Promise<{ success: boolean; account_id: string; account: Account }> => {
    const response = await api.post('/accounts', data);
    return response.data;
  },

  update: async (id: string, data: UpdateAccountRequest): Promise<{ success: boolean; account: Account }> => {
    const response = await api.put(`/accounts/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/accounts/${id}`);
    return response.data;
  },

  test: async (id: string): Promise<TestAccountResponse> => {
    const response = await api.post(`/accounts/${id}/test`);
    return response.data;
  },

  getLogs: async (id: string, limit: number = 50, offset: number = 0): Promise<{ logs: any[]; count: number; limit: number; offset: number }> => {
    const response = await api.get(`/accounts/${id}/logs`, { params: { limit, offset } });
    return response.data;
  },
};

export const platformsApi = {
  getAll: async (): Promise<{ platforms: Platform[]; count: number }> => {
    const response = await api.get('/platforms');
    return response.data;
  },

  getPostTypes: async (platform: string): Promise<{ platform: string; supported_post_types: string[] }> => {
    const response = await api.get(`/platforms/${platform}/post-types`);
    return response.data;
  },

  getPostTypeDetails: async (platform: string): Promise<{
    platform: string;
    post_types: Array<{
      type: string;
      description: string;
      requirements: Record<string, any>;
    }>
  }> => {
    const response = await api.get(`/platforms/${platform}/post-types/details`);
    return response.data;
  },
};

export const postsApi = {
  getAll: async (status?: string): Promise<{ posts: Post[]; count: number }> => {
    const response = await api.get('/posts', { params: status ? { status } : {} });
    return response.data;
  },

  getOne: async (id: string): Promise<{ post: Post }> => {
    const response = await api.get(`/posts/${id}`);
    return response.data;
  },

  create: async (data: CreatePostRequest): Promise<{ success: boolean; post_id: string; post: Post }> => {
    const response = await api.post('/post', data);
    return response.data;
  },

  preview: async (data: {
    content: string;
    media?: string[];
    platforms: string[];
    post_type?: string;
  }): Promise<{ previews: any[]; count: number }> => {
    const response = await api.post('/post/preview', data);
    return response.data;
  },

  optimize: async (data: {
    content: string;
    platforms: string[];
    post_type?: string;
  }): Promise<{ optimizations: Record<string, any>; overall_status: string }> => {
    const response = await api.post('/post/optimize', data);
    return response.data;
  },

  schedule: async (data: SchedulePostRequest): Promise<{ success: boolean; post_id: string; post: Post }> => {
    const response = await api.post('/schedule', data);
    return response.data;
  },

  checkScheduleConflicts: async (data: {
    scheduled_time: string;
    platforms: string[];
  }): Promise<{
    has_conflicts: boolean;
    conflicts: any[];
    conflict_count: number;
    suggestions: any[];
  }> => {
    const response = await api.post('/schedule/conflicts', data);
    return response.data;
  },

  update: async (id: string, data: {
    content?: string;
    media?: string[];
    account_ids?: string[];
    scheduled_time?: string;
  }): Promise<{ success: boolean; post: any }> => {
    const response = await api.patch(`/posts/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/posts/${id}`);
    return response.data;
  },
};

export interface VideoJobStatus {
  status: 'processing' | 'completed' | 'failed' | 'not_found';
  progress?: number;
  error?: string;
  video_path?: string;
  video_url?: string;
  srt_url?: string;
}

export const videoApi = {
  generate: async (data: { settings: any, slides: any[] }): Promise<{ job_id: string; message: string; status: string }> => {
    const response = await api.post('/v2/video/generate', data);
    return response.data;
  },
  getStatus: async (id: string): Promise<VideoJobStatus> => {
    const response = await api.get(`/v2/video/status/${id}`);
    return response.data;
  },
  generateMusic: async (prompt: string): Promise<{ url: string }> => {
    const response = await api.post('/v2/video/generate-music', { prompt });
    return response.data;
  }
};

export const aiApi = {
  generateCaption: async (data: {
    topic: string;
    platform: string;
    tone?: string;
  }): Promise<{ success: boolean; caption: string; character_count: number; platform: string }> => {
    const response = await api.post('/ai/generate-caption', data);
    return response.data;
  },

  suggestHashtags: async (data: {
    content: string;
    platform: string;
    count?: number;
  }): Promise<{ success: boolean; hashtags: string[]; platform: string }> => {
    const response = await api.post('/ai/suggest-hashtags', data);
    return response.data;
  },

  rewriteContent: async (data: {
    content: string;
    source_platform: string;
    target_platform: string;
  }): Promise<{ success: boolean; original: string; rewritten: string }> => {
    const response = await api.post('/ai/rewrite-content', data);
    return response.data;
  },

  getBestTimes: async (data: {
    platform: string;
    historical_data?: any[];
  }): Promise<{ success: boolean; platform: string; best_times: string[]; recommendation: string }> => {
    const response = await api.post('/ai/best-times', data);
    return response.data;
  },

  predictEngagement: async (data: {
    content: string;
    platform: string;
    scheduled_time: string;
  }): Promise<{ success: boolean; engagement_score: number; estimated_metrics: any }> => {
    const response = await api.post('/ai/predict-engagement', data);
    return response.data;
  },

  getPostingFrequency: async (data: {
    platform: string;
    content_type?: string;
  }): Promise<{ success: boolean; platform: string; recommendations: any }> => {
    const response = await api.post('/ai/posting-frequency', data);
    return response.data;
  },

  optimizeImage: async (data: {
    image_data: string;
    platform: string;
  }): Promise<{ success: boolean; optimized_image: string; original_dimensions: any; new_dimensions: any }> => {
    const response = await api.post('/ai/optimize-image', data);
    return response.data;
  },

  enhanceImage: async (data: {
    image_data: string;
    enhancement_level?: string;
  }): Promise<{ success: boolean; enhanced_image: string; applied_enhancements: any }> => {
    const response = await api.post('/ai/enhance-image', data);
    return response.data;
  },

  generateAltText: async (data: {
    image_data: string;
  }): Promise<{ success: boolean; alt_text: string }> => {
    const response = await api.post('/ai/generate-alt-text', data);
    return response.data;
  },

  predictPerformance: async (data: {
    content: string;
    media: string[];
    scheduled_time: string;
    platform: string;
  }): Promise<{ success: boolean; engagement_score: number; predicted_metrics: any; recommendations: string[] }> => {
    const response = await api.post('/ai/predict-performance', data);
    return response.data;
  },

  compareVariations: async (data: {
    variations: any[];
  }): Promise<{ success: boolean; variations_analyzed: number; results: any[]; best_variation: any }> => {
    const response = await api.post('/ai/compare-variations', data);
    return response.data;
  },

  trainModel: async (data: {
    historical_posts: any[];
  }): Promise<{ success: boolean; trained: boolean; training_samples: number }> => {
    const response = await api.post('/ai/train-model', data);
    return response.data;
  },

  getStatus: async (): Promise<{ ai_enabled: boolean; services: any; api_key_status: string }> => {
    const response = await api.get('/ai/status');
    return response.data;
  },
};

export const healthApi = {
  check: async (): Promise<{ status: string; service: string; version: string }> => {
    const response = await api.get('/health');
    return response.data;
  },
};

export const oauthApi = {
  initFlow: async (platform: string, scopes?: string[]): Promise<{ oauth_url: string; state: string; platform: string }> => {
    let url = `/oauth/init/${platform}`;
    if (scopes && scopes.length > 0) {
      const scopeParam = scopes.join(',');
      url += `?scopes=${encodeURIComponent(scopeParam)}`;
    }
    const response = await api.get(url);
    return response.data;
  },

  connect: async (data: {
    platform: string;
    oauth_data: any;
    account_name?: string;
  }): Promise<{ success: boolean; account_id: string; account: Account }> => {
    const response = await api.post('/oauth/connect', data);
    return response.data;
  },
};

export const oauthAppsApi = {
  getAll: async (): Promise<{ success: boolean; oauth_apps: any[]; count: number }> => {
    const response = await api.get('/oauth-apps');
    return response.data;
  },

  create: async (data: {
    platform: string;
    app_name?: string;
    client_id: string;
    client_secret: string;
    redirect_uri?: string;
    additional_config?: any;
  }): Promise<{ success: boolean; oauth_app_id: string; oauth_app: any }> => {
    const response = await api.post('/oauth-apps', data);
    return response.data;
  },

  update: async (id: string, data: {
    app_name?: string;
    client_id?: string;
    client_secret?: string;
    redirect_uri?: string;
    additional_config?: any;
    is_active?: boolean;
  }): Promise<{ success: boolean; oauth_app: any }> => {
    const response = await api.put(`/oauth-apps/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/oauth-apps/${id}`);
    return response.data;
  },

  getPlatformRequirements: async (platform: string): Promise<{ success: boolean; platform: string; fields: any[]; setup_instructions: string[] }> => {
    const response = await api.get(`/oauth-apps/${platform}/requirements`);
    return response.data;
  },

  getAllRequirements: async (): Promise<{ success: boolean; platforms: any; count: number }> => {
    const response = await api.get('/oauth-apps/requirements');
    return response.data;
  },
};

export const urlsApi = {
  getAll: async (): Promise<{ urls: any[]; count: number; total_clicks: number; total_unique_visitors: number }> => {
    const response = await api.get('/urls');
    return response.data;
  },

  shorten: async (data: {
    url: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    custom_code?: string;
  }): Promise<{ success: boolean; id: string; short_code: string; short_url: string; original_url: string }> => {
    const response = await api.post('/urls/shorten', data);
    return response.data;
  },

  update: async (shortCode: string, url: string): Promise<{ success: boolean; short_code: string; original_url: string }> => {
    const response = await api.patch(`/urls/${shortCode}`, { url });
    return response.data;
  },

  delete: async (shortCode: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/urls/${shortCode}`);
    return response.data;
  },

  getStats: async (shortCode: string): Promise<any> => {
    const response = await api.get(`/urls/${shortCode}/stats`);
    return response.data;
  },
};

export const socialMonitorsApi = {
  getAll: async (): Promise<{ monitors: any[]; count: number }> => {
    const response = await api.get('/social-monitors');
    return response.data;
  },

  create: async (data: {
    name: string;
    keywords: string[];
    platforms: string[];
  }): Promise<{ success: boolean; monitor_id: string; monitor: any }> => {
    const response = await api.post('/social-monitors', data);
    return response.data;
  },

  update: async (id: string, data: any): Promise<{ success: boolean; monitor: any }> => {
    const response = await api.put(`/social-monitors/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/social-monitors/${id}`);
    return response.data;
  },

  getResults: async (id: string, filters?: {
    platform?: string;
    sentiment?: string;
    unread_only?: boolean;
  }): Promise<{ monitor_id: string; results: any[]; count: number; total_count: number }> => {
    const response = await api.get(`/social-monitors/${id}/results`, { params: filters });
    return response.data;
  },

  markRead: async (monitorId: string, resultId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/social-monitors/${monitorId}/results/${resultId}/mark-read`);
    return response.data;
  },

  refresh: async (id: string): Promise<{ success: boolean; message: string; result_count: number }> => {
    const response = await api.post(`/social-monitors/${id}/refresh`);
    return response.data;
  },
};

export const mediaApi = {
  upload: async (file: File): Promise<{ success: boolean; media_id: string; url: string; filename: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/v2/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getAll: async (): Promise<{ media: any[]; limit: number; offset: number }> => {
    const response = await api.get('/v2/media');
    return response.data;
  },

  delete: async (mediaId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/v2/media/${mediaId}`);
    return response.data;
  },
};

