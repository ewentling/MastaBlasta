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

  schedule: async (data: SchedulePostRequest): Promise<{ success: boolean; post_id: string; post: Post }> => {
    const response = await api.post('/schedule', data);
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
