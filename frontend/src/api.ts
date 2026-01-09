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
  headers: {
    'Content-Type': 'application/json',
  },
});

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

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/posts/${id}`);
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
  initFlow: async (platform: string): Promise<{ oauth_url: string; state: string; platform: string }> => {
    const response = await api.get(`/oauth/init/${platform}`);
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

export const urlsApi = {
  getAll: async (): Promise<{ urls: any[]; count: number }> => {
    const response = await api.get('/urls');
    return response.data;
  },

  shorten: async (data: {
    url: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    custom_code?: string;
  }): Promise<{ success: boolean; id: string; short_code: string; short_url: string; original_url: string }> => {
    const response = await api.post('/urls/shorten', data);
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

