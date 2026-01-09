export interface Platform {
  name: string;
  display_name: string;
  available: boolean;
  supports_oauth?: boolean;
}

export interface Account {
  id: string;
  platform: string;
  name: string;
  username: string;
  enabled: boolean;
  created_at: string;
}

export interface AccountWithCredentials extends Account {
  credentials: Record<string, string>;
}

export interface Post {
  id: string;
  content: string;
  media: string[];
  platforms: string[];
  account_ids?: string[];
  status: 'publishing' | 'published' | 'scheduled' | 'failed';
  created_at: string;
  scheduled_for?: string;
  published_at?: string;
  results?: Array<{
    success: boolean;
    platform: string;
    post_id?: string;
    message?: string;
    error?: string;
  }>;
}

export interface CreatePostRequest {
  content: string;
  media?: string[];
  account_ids?: string[];
  platforms?: string[];
  credentials?: Record<string, Record<string, string>>;
}

export interface SchedulePostRequest extends CreatePostRequest {
  scheduled_time: string;
}

export interface CreateAccountRequest {
  platform: string;
  name: string;
  username?: string;
  credentials: Record<string, string>;
}

export interface UpdateAccountRequest {
  name?: string;
  username?: string;
  credentials?: Record<string, string>;
  enabled?: boolean;
}

export interface TestAccountResponse {
  success: boolean;
  message: string;
  platform: string;
  account_name: string;
  error?: string;
}
