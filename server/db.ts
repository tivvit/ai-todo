import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';

if (!fs.existsSync(CONFIG.DATA_DIR)) {
  fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
}

const dbPath = path.join(CONFIG.DATA_DIR, 'ai_todo.sqlite');
export const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS delegated_tasks (
    task_id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    project_id TEXT,
    user_note TEXT,
    status TEXT NOT NULL, -- 'in_progress', 'waiting', 'surfaced', 'completed', 'failed'
    llm_summary TEXT,
    llm_plan TEXT,
    action_log TEXT, -- JSON array of string log entries
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS checkers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    condition_desc TEXT NOT NULL,
    interval_hours INTEGER DEFAULT 24,
    next_check_at TEXT NOT NULL,
    follow_up_action TEXT NOT NULL,
    max_checks INTEGER DEFAULT 3,
    check_count INTEGER DEFAULT 0,
    status TEXT NOT NULL, -- 'active', 'triggered', 'dismissed'
    last_checked_at TEXT,
    FOREIGN KEY(task_id) REFERENCES delegated_tasks(task_id)
  );

  CREATE TABLE IF NOT EXISTS task_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    content TEXT,
    action TEXT NOT NULL, -- 'done', 'done_with_note', 'postponed', 'delegated', 'skipped'
    note TEXT,
    reason TEXT,
    postpone_until TEXT,
    actor TEXT DEFAULT 'user', -- 'user' or 'ai'
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Migration for existing databases to add actor column if missing
try {
  db.exec(`ALTER TABLE task_decisions ADD COLUMN actor TEXT DEFAULT 'user'`);
} catch {}

export interface DelegatedTask {
  task_id: string;
  content: string;
  project_id: string | null;
  user_note: string | null;
  status: 'in_progress' | 'waiting' | 'surfaced' | 'completed' | 'failed';
  llm_summary: string | null;
  llm_plan: string | null;
  action_log: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface Checker {
  id: number;
  task_id: string;
  condition_desc: string;
  interval_hours: number;
  next_check_at: string;
  follow_up_action: string;
  max_checks: number;
  check_count: number;
  status: 'active' | 'triggered' | 'dismissed';
  last_checked_at: string | null;
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

export const dbService = {
  getDelegatedTasks(): DelegatedTask[] {
    const stmt = db.prepare('SELECT * FROM delegated_tasks ORDER BY updated_at DESC');
    return stmt.all() as DelegatedTask[];
  },

  getDelegatedTask(taskId: string): DelegatedTask | undefined {
    const stmt = db.prepare('SELECT * FROM delegated_tasks WHERE task_id = ?');
    return stmt.get(taskId) as DelegatedTask | undefined;
  },

  saveDelegatedTask(task: Omit<DelegatedTask, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): void {
    const now = new Date().toISOString();
    const existing = this.getDelegatedTask(task.task_id);
    if (existing) {
      const stmt = db.prepare(`
        UPDATE delegated_tasks
        SET content = ?, project_id = ?, user_note = ?, status = ?, llm_summary = ?, llm_plan = ?, action_log = ?, updated_at = ?
        WHERE task_id = ?
      `);
      stmt.run(
        task.content,
        task.project_id,
        task.user_note,
        task.status,
        task.llm_summary,
        task.llm_plan,
        task.action_log,
        now,
        task.task_id
      );
    } else {
      const stmt = db.prepare(`
        INSERT INTO delegated_tasks (task_id, content, project_id, user_note, status, llm_summary, llm_plan, action_log, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        task.task_id,
        task.content,
        task.project_id,
        task.user_note,
        task.status,
        task.llm_summary,
        task.llm_plan,
        task.action_log,
        task.created_at || now,
        task.updated_at || now
      );
    }
  },

  appendActionLog(taskId: string, message: string): void {
    const task = this.getDelegatedTask(taskId);
    if (!task) return;
    let logs: string[] = [];
    try {
      logs = JSON.parse(task.action_log || '[]');
    } catch {
      logs = [];
    }
    logs.push(`[${new Date().toISOString()}] ${message}`);
    const stmt = db.prepare('UPDATE delegated_tasks SET action_log = ?, updated_at = ? WHERE task_id = ?');
    stmt.run(JSON.stringify(logs), new Date().toISOString(), taskId);
  },

  updateTaskStatus(taskId: string, status: DelegatedTask['status']): void {
    const stmt = db.prepare('UPDATE delegated_tasks SET status = ?, updated_at = ? WHERE task_id = ?');
    stmt.run(status, new Date().toISOString(), taskId);
  },

  getActiveCheckers(): (Checker & { content: string; user_note: string | null; task_status: string })[] {
    const stmt = db.prepare(`
      SELECT c.*, d.content, d.user_note, d.status as task_status
      FROM checkers c
      JOIN delegated_tasks d ON c.task_id = d.task_id
      WHERE c.status = 'active'
      ORDER BY c.next_check_at ASC
    `);
    return stmt.all() as any[];
  },

  getCheckersForTask(taskId: string): Checker[] {
    const stmt = db.prepare('SELECT * FROM checkers WHERE task_id = ? ORDER BY id DESC');
    return stmt.all(taskId) as Checker[];
  },

  createChecker(checker: Omit<Checker, 'id' | 'status' | 'check_count' | 'last_checked_at'>): number {
    const stmt = db.prepare(`
      INSERT INTO checkers (task_id, condition_desc, interval_hours, next_check_at, follow_up_action, max_checks, check_count, status, last_checked_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 'active', NULL)
    `);
    const result = stmt.run(
      checker.task_id,
      checker.condition_desc,
      checker.interval_hours,
      checker.next_check_at,
      checker.follow_up_action,
      checker.max_checks || 3
    );
    return Number(result.lastInsertRowid);
  },

  updateChecker(id: number, updates: Partial<Checker>): void {
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    values.push(id);
    const stmt = db.prepare(`UPDATE checkers SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  },

  recordDecision(
    taskId: string,
    content: string | null,
    action: string,
    note?: string,
    reason?: string,
    postpone_until?: string,
    actor: 'user' | 'ai' = 'user'
  ): void {
    const stmt = db.prepare(`
      INSERT INTO task_decisions (task_id, content, action, note, reason, postpone_until, actor, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(taskId, content, action, note || null, reason || null, postpone_until || null, actor, new Date().toISOString());
  },

  getRecentDecisions(limit = 20): TaskDecision[] {
    const stmt = db.prepare('SELECT * FROM task_decisions ORDER BY id DESC LIMIT ?');
    return stmt.all(limit) as TaskDecision[];
  },

  getSetting(key: string, defaultValue = ''): string {
    const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row ? row.value : defaultValue;
  },

  setSetting(key: string, value: string): void {
    const stmt = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    stmt.run(key, value, new Date().toISOString());
  }
};
