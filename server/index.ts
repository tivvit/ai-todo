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

// 2. Fetch Active Todos
app.get('/api/todos', async (req: Request, res: Response) => {
  if (!todoist.isConfigured()) {
    res.status(400).json({
      error: 'Todoist API token is not configured. Please configure it in settings.'
    });
    return;
  }

  try {
    const [tasks, projects] = await Promise.all([
      todoist.getTasks(),
      todoist.getProjects().catch(() => [])
    ]);

    const projectMap = new Map(projects.map(p => [p.id, p.name]));
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

// 4. Mark Done
app.post('/api/todos/:id/done', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { content } = req.body;
  try {
    await todoist.closeTask(id);
    dbService.recordDecision(id, content, 'done');
    dbService.updateTaskStatus(id, 'completed');
    res.json({ success: true, message: 'Task marked as done' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Done With Note (with optional Follow-Up Task)
app.post('/api/todos/:id/done-with-note', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { content, note, createFollowUp, followUpTitle, followUpDue, projectId } = req.body;

  if (!note || !note.trim()) {
    res.status(400).json({ error: 'Note is required' });
    return;
  }

  try {
    // 1. Post note as comment to Todoist
    await todoist.addComment(id, `📝 **[Completion Note]** ${note.trim()}`);
    // 2. Close current task in Todoist
    await todoist.closeTask(id);
    dbService.recordDecision(id, content, 'done_with_note', note);
    dbService.updateTaskStatus(id, 'completed');

    let createdFollowUpTask = null;
    // 3. Create follow-up todo if requested
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
        due
      );
    }

    res.json({
      success: true,
      message: createFollowUp
        ? 'Note added, task completed, and follow-up task created in Todoist!'
        : 'Note added and task marked done',
      followUpTask: createdFollowUpTask
    });
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
    dbService.recordDecision(id, content, 'postponed', undefined, reasonText, dueString);
    res.json({ success: true, message: `Task postponed to ${dueString}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Hand Over to LLM (Delegation)
app.post('/api/todos/:id/delegate', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { content, description, userNote, projectId } = req.body;

  try {
    const decision = await agentService.handOverTask({
      taskId: id,
      taskContent: content,
      taskDescription: description,
      userNote: userNote || '',
      projectId
    });

    dbService.recordDecision(id, content, 'delegated', userNote);
    res.json({ success: true, decision });
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
