import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { CONFIG } from './config.js';
import { dbService } from './db.js';
import { todoist } from './todoist.js';
import { agentService } from './agent.js';
import { checkerService } from './checker.js';

const app = express();

app.use(cors());
app.use(express.json());

// 1. Health & Status
app.get('/api/status', async (req: Request, res: Response) => {
  const isTodoistReady = todoist.isConfigured();
  const activeCheckers = dbService.getActiveCheckers();
  const delegated = dbService.getDelegatedTasks();

  let userInfo: any = null;
  let todoistError: string | null = null;

  if (isTodoistReady) {
    try {
      // Quick test fetch
      await todoist.getProjects();
      userInfo = { connected: true };
    } catch (err: any) {
      todoistError = err.message;
    }
  }

  res.json({
    status: 'ok',
    todoist: {
      configured: isTodoistReady,
      error: todoistError,
      connected: userInfo?.connected || false,
      tokenMasked: isTodoistReady
        ? `${todoist.getToken().slice(0, 4)}...${todoist.getToken().slice(-4)}`
        : null
    },
    agent: {
      agyPath: CONFIG.AGY_PATH,
      hasAgy: fs.existsSync(CONFIG.AGY_PATH)
    },
    checkerCron: checkerService.getSchedule(),
    counts: {
      activeCheckers: activeCheckers.length,
      delegatedTasks: delegated.length
    }
  });
});

// Update Todoist Token
app.post('/api/settings/token', (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Token string is required' });
    return;
  }
  todoist.setToken(token.trim());
  const tokenFile = path.join(CONFIG.DATA_DIR, 'token.txt');
  fs.writeFileSync(tokenFile, token.trim());
  res.json({ success: true, message: 'Todoist token updated successfully' });
});

// Update Checker Cron Schedule
app.post('/api/settings/checker', (req: Request, res: Response) => {
  const { cron: cronExpr } = req.body;
  if (!cronExpr || typeof cronExpr !== 'string') {
    res.status(400).json({ error: 'Cron expression string is required' });
    return;
  }
  try {
    checkerService.updateSchedule(cronExpr.trim());
    res.json({ success: true, schedule: checkerService.getSchedule() });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

function matchesDateScope(dueDateStr: string | null | undefined, scope: string): boolean {
  if (scope === 'all') return true;
  if (scope === 'someday') return !dueDateStr;
  if (scope === 'scheduled') return Boolean(dueDateStr);
  if (!dueDateStr) return false;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`;

  const d = dueDateStr.slice(0, 10);

  if (scope === 'today') return d === todayStr;
  if (scope === 'overdue') return d < todayStr;
  if (scope === 'today_overdue') return d <= todayStr;
  if (scope === 'near_future') return d >= todayStr && d <= nextWeekStr;
  return true;
}

// 2. Fetch Projects List
app.get('/api/projects', async (req: Request, res: Response) => {
  if (!todoist.isConfigured()) {
    res.status(400).json({ error: 'Todoist API token is not configured.' });
    return;
  }
  try {
    const projects = await todoist.getProjects();
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Fetch Active Todos (with Project & Scope / Filter support)
app.get('/api/todos', async (req: Request, res: Response) => {
  if (!todoist.isConfigured()) {
    res.status(400).json({
      error: 'Todoist API token is not configured. Please configure it in settings.'
    });
    return;
  }

  const projectId = req.query.projectId ? String(req.query.projectId) : 'all';
  const scope = req.query.scope ? String(req.query.scope) : 'all';
  const customQuery = req.query.filterQuery ? String(req.query.filterQuery).trim() : '';

  try {
    let tasks: any[] = [];
    const projects = await todoist.getProjects().catch(() => []);
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    if (customQuery) {
      tasks = await todoist.getTasksByFilter(customQuery);
      if (projectId !== 'all') {
        tasks = tasks.filter(t => t.project_id === projectId);
      }
    } else if (projectId === 'all') {
      // Across all projects
      if (scope === 'today') {
        tasks = await todoist.getTasksByFilter('today');
      } else if (scope === 'today_overdue') {
        tasks = await todoist.getTasksByFilter('today | overdue');
      } else if (scope === 'overdue') {
        tasks = await todoist.getTasksByFilter('overdue');
      } else if (scope === 'near_future') {
        tasks = await todoist.getTasksByFilter('7 days');
      } else if (scope === 'scheduled') {
        tasks = await todoist.getTasksByFilter('!no date');
      } else if (scope === 'someday') {
        tasks = await todoist.getTasksByFilter('no date');
      } else {
        tasks = await todoist.getTasks();
      }
    } else {
      // Specific project
      tasks = await todoist.getTasks({ projectId });
      if (scope !== 'all') {
        tasks = tasks.filter(t => matchesDateScope(t.due?.date, scope));
      }
    }

    const delegatedMap = new Map(dbService.getDelegatedTasks().map(d => [d.task_id, d]));
    const checkers = dbService.getActiveCheckers();
    const checkerMap = new Map(checkers.map(c => [c.task_id, c]));

    // Enrich tasks
    const enriched = tasks
      .filter(t => !t.checked)
      .map(t => {
        const delegated = delegatedMap.get(t.id);
        const checker = checkerMap.get(t.id);
        return {
          ...t,
          projectName: projectMap.get(t.project_id) || 'Inbox',
          delegated: delegated || null,
          checker: checker || null,
          isSurfaced: delegated?.status === 'surfaced'
        };
      });

    // Sort: Surfaced (needing attention) first, then priority (descending 4 down to 1), then due date
    enriched.sort((a, b) => {
      if (a.isSurfaced && !b.isSurfaced) return -1;
      if (!a.isSurfaced && b.isSurfaced) return 1;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return (a.due?.date || '9999') > (b.due?.date || '9999') ? 1 : -1;
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Task Comments
app.get('/api/todos/:id/comments', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const comments = await todoist.getComments(id);
    res.json(comments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Mark Done (by User)
app.post('/api/todos/:id/done', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { content } = req.body;
  try {
    await todoist.completeByUser(id);
    dbService.recordDecision(id, content, 'done', undefined, undefined, undefined, 'user');
    dbService.updateTaskStatus(id, 'completed');
    res.json({ success: true, message: 'Task marked as done by user' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Done With Note (by User, with optional Follow-Up Task)
app.post('/api/todos/:id/done-with-note', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { content, note, createFollowUp, followUpTitle, followUpDue, projectId } = req.body;

  if (!note || !note.trim()) {
    res.status(400).json({ error: 'Note is required' });
    return;
  }

  try {
    // Complete in Todoist by user with note comment and user-completed label
    await todoist.completeByUser(id, note.trim());
    dbService.recordDecision(id, content, 'done_with_note', note, undefined, undefined, 'user');
    dbService.updateTaskStatus(id, 'completed');

    let createdFollowUpTask = null;
    // Create follow-up todo if requested
    if (createFollowUp) {
      const taskTitle = followUpTitle?.trim() || `Follow-up: ${note.trim()}`;
      const due = followUpDue?.trim() || 'tomorrow';
      createdFollowUpTask = await todoist.createTask({
        content: taskTitle,
        description: `Created automatically from completion note of previous task: "${content || id}"\nNote: ${note.trim()}`,
        due_string: due,
        project_id: projectId
      });
      dbService.recordDecision(
        createdFollowUpTask.id,
        taskTitle,
        'created_followup',
        `Follow-up for previous task ${id}`,
        undefined,
        due,
        'user'
      );
    }

    res.json({
      success: true,
      message: createFollowUp
        ? 'Task completed by user and follow-up task created in Todoist!'
        : 'Task completed by user with note',
      followUpTask: createdFollowUpTask
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5b. Mark Done by AI
app.post('/api/todos/:id/ai-complete', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { content, summary } = req.body;

  try {
    const summaryText = summary?.trim() || 'Resolved autonomously by Antigravity Agent.';
    await todoist.completeByAI(id, summaryText);
    dbService.recordDecision(id, content, 'done', summaryText, undefined, undefined, 'ai');
    dbService.updateTaskStatus(id, 'completed');
    res.json({ success: true, message: 'Task marked as completed by AI' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Postpone With Reason
app.post('/api/todos/:id/postpone', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { content, reason, dueDateString } = req.body;

  const dueString = (dueDateString && dueDateString.trim()) || 'tomorrow';
  const reasonText = (reason && reason.trim()) || 'Postponed for later';

  try {
    // 1. Add reason comment to Todoist
    await todoist.addComment(id, `⏳ **[Postponed until ${dueString}]** Reason: ${reasonText}`);
    // 2. Update task due date in Todoist
    await todoist.updateTask(id, {
      due_string: dueString
    });
    dbService.recordDecision(id, content, 'postponed', undefined, reasonText, dueString, 'user');
    res.json({ success: true, message: `Task postponed to ${dueString}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Hand Over to LLM (Delegation) - Fully Asynchronous
app.post('/api/todos/:id/delegate', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { content, description, userNote, projectId } = req.body;

  try {
    // 1. Immediately record handover decision in SQLite
    dbService.recordDecision(id, content, 'delegated', userNote, undefined, undefined, 'user');

    // 2. Register initial task state in DB as in_progress
    dbService.saveDelegatedTask({
      task_id: id,
      content: content || id,
      project_id: projectId || null,
      user_note: userNote || null,
      status: 'in_progress',
      llm_summary: 'Agent is analyzing task and formulating execution plan...',
      llm_plan: null,
      action_log: JSON.stringify([
        `[${new Date().toISOString()}] Handover received from user. Note: "${userNote || 'None'}"`
      ])
    });

    // 3. Immediately reply to client so user can continue triaging next task without delay
    res.json({
      success: true,
      message: 'Task handed over to AI. Processing asynchronously in the background.',
      taskId: id,
      status: 'in_progress'
    });

    // 4. Run LLM agent analysis, plan formulation & checker scheduling asynchronously in background
    agentService
      .handOverTask({
        taskId: id,
        taskContent: content,
        taskDescription: description,
        userNote: userNote || '',
        projectId
      })
      .catch(err => {
        console.error(`[Agent] Asynchronous handover error for task ${id}:`, err);
        dbService.saveDelegatedTask({
          task_id: id,
          content: content || id,
          project_id: projectId || null,
          user_note: userNote || null,
          status: 'failed',
          llm_summary: `Agent error: ${err.message}`,
          llm_plan: null,
          action_log: JSON.stringify([
            `[${new Date().toISOString()}] Handover failed: ${err.message}`
          ])
        });
      });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Delegated Tasks & Checkers Dashboard Data
app.get('/api/delegated', (req: Request, res: Response) => {
  const tasks = dbService.getDelegatedTasks().map(t => {
    let logs: string[] = [];
    try {
      logs = JSON.parse(t.action_log || '[]');
    } catch {}
    const checkers = dbService.getCheckersForTask(t.task_id);
    return {
      ...t,
      action_logs: logs,
      checkers
    };
  });
  res.json(tasks);
});

app.get('/api/checkers', (req: Request, res: Response) => {
  const checkers = dbService.getActiveCheckers();
  res.json(checkers);
});

// Trigger a Checker immediately
app.post('/api/checkers/:id/trigger', async (req: Request, res: Response) => {
  const checkerId = parseInt(String(req.params.id), 10);
  try {
    const result = await checkerService.triggerCheckerNow(checkerId);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. History / Decisions
app.get('/api/history', (req: Request, res: Response) => {
  const history = dbService.getRecentDecisions();
  res.json(history);
});

// Serve static frontend files if production or built
const clientDistPath = path.resolve(process.cwd(), 'dist/client');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req: Request, res: Response) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Start Background Checker & HTTP Server
checkerService.start();

app.listen(CONFIG.PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 AI-Todo Server listening on http://localhost:${CONFIG.PORT}`);
  console.log(`🔑 Todoist Token: ${todoist.isConfigured() ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  console.log(`🤖 Antigravity CLI: ${fs.existsSync(CONFIG.AGY_PATH) ? CONFIG.AGY_PATH : 'Not found (fallback active)'}`);
  console.log(`===============================================`);
});
