import { CONFIG } from './config.js';

export interface TodoistTask {
  id: string;
  content: string;
  description: string;
  project_id: string;
  section_id: string | null;
  parent_id: string | null;
  priority: number;
  due: {
    date: string;
    string?: string;
    is_recurring?: boolean;
    datetime?: string;
  } | null;
  labels: string[];
  checked: boolean;
  added_at: string;
  updated_at: string;
  url?: string;
}

export interface TodoistProject {
  id: string;
  name: string;
  color?: string;
  is_favorite?: boolean;
}

export interface TodoistComment {
  id: string;
  task_id?: string;
  content: string;
  posted_at: string;
}

export class TodoistService {
  private token: string;
  private baseUrl = 'https://api.todoist.com/api/v1';

  constructor(token?: string) {
    this.token = token || CONFIG.TODOIST_API_TOKEN;
  }

  public setToken(token: string) {
    this.token = token;
  }

  public getToken(): string {
    return this.token;
  }

  public isConfigured(): boolean {
    return Boolean(this.token && this.token.length > 5);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Todoist API token is not configured. Please supply a valid token.');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Todoist API error [${response.status}] ${endpoint}: ${errText}`);
    }

    // Some endpoints like POST close return 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    }

    return (await response.text()) as unknown as T;
  }

  async getTasks(): Promise<TodoistTask[]> {
    const data = await this.request<{ results: TodoistTask[] }>('/tasks');
    return data.results || [];
  }

  async getTask(taskId: string): Promise<TodoistTask> {
    return await this.request<TodoistTask>(`/tasks/${taskId}`);
  }

  async getProjects(): Promise<TodoistProject[]> {
    const data = await this.request<{ results: TodoistProject[] }>('/projects');
    return data.results || [];
  }

  async closeTask(taskId: string): Promise<void> {
    await this.request<void>(`/tasks/${taskId}/close`, {
      method: 'POST'
    });
  }

  async reopenTask(taskId: string): Promise<void> {
    await this.request<void>(`/tasks/${taskId}/reopen`, {
      method: 'POST'
    });
  }

  async updateTask(taskId: string, params: {
    content?: string;
    description?: string;
    due_string?: string;
    due_date?: string;
    priority?: number;
    labels?: string[];
  }): Promise<TodoistTask> {
    return await this.request<TodoistTask>(`/tasks/${taskId}`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async addComment(taskId: string, content: string): Promise<TodoistComment> {
    return await this.request<TodoistComment>('/comments', {
      method: 'POST',
      body: JSON.stringify({
        task_id: taskId,
        content
      })
    });
  }

  async getComments(taskId: string): Promise<TodoistComment[]> {
    const data = await this.request<{ results: TodoistComment[] }>(`/comments?task_id=${encodeURIComponent(taskId)}`);
    return data.results || [];
  }
}

export const todoist = new TodoistService();
