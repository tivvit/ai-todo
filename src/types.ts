export interface TodoItem {
  id: string;
  content: string;
  description: string;
  project_id: string;
  projectName: string;
  priority: number; // 4 = P1, 3 = P2, 2 = P3, 1 = P4
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
  delegated: DelegatedTask | null;
  checker: Checker | null;
  isSurfaced: boolean;
}

export interface DelegatedTask {
  task_id: string;
  content: string;
  project_id: string | null;
  user_note: string | null;
  status: 'in_progress' | 'waiting' | 'surfaced' | 'completed' | 'failed';
  llm_summary: string | null;
  llm_plan: string | null;
  action_log?: string;
  action_logs?: string[];
  created_at: string;
  updated_at: string;
  checkers?: Checker[];
}

export interface Checker {
  id: number;
  task_id: string;
  content?: string;
  user_note?: string | null;
  condition_desc: string;
  interval_hours: number;
  next_check_at: string;
  follow_up_action: string;
  max_checks: number;
  check_count: number;
  status: 'active' | 'triggered' | 'dismissed';
  last_checked_at: string | null;
  task_status?: string;
}

export interface TaskDecision {
  id: number;
  task_id: string;
  content: string | null;
  action: string;
  note: string | null;
  reason: string | null;
  postpone_until: string | null;
  actor: 'user' | 'ai';
  created_at: string;
}

export interface AppStatus {
  status: string;
  todoist: {
    configured: boolean;
    error: string | null;
    connected: boolean;
    tokenMasked: string | null;
  };
  agent: {
    agyPath: string;
    hasAgy: boolean;
  };
  checkerCron: string;
  counts: {
    activeCheckers: number;
    delegatedTasks: number;
  };
}

export interface TodoProject {
  id: string;
  name: string;
  color?: string;
  is_favorite?: boolean;
}

export type TimeScope = 'all' | 'today_overdue' | 'today' | 'near_future' | 'scheduled' | 'someday';

export interface TodoComment {
  id: string;
  content: string;
  posted_at: string;
}
