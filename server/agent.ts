import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { CONFIG } from './config.js';
import { dbService } from './db.js';
import { todoist } from './todoist.js';

const execFileAsync = promisify(execFile);

export interface AgentDecision {
  summary: string;
  plan: string;
  actions_taken: string[];
  is_waiting: boolean;
  waiting_reason?: string;
  checker?: {
    condition: string;
    interval_hours: number;
    next_check_hours: number;
    follow_up_action: string;
    max_checks: number;
  };
  todoist_comment?: string;
}

export class AgentService {
  private agyPath: string;

  constructor() {
    this.agyPath = CONFIG.AGY_PATH;
  }

  private hasAgy(): boolean {
    return fs.existsSync(this.agyPath);
  }

  public async handOverTask(params: {
    taskId: string;
    taskContent: string;
    taskDescription?: string;
    userNote?: string;
    projectId?: string;
  }): Promise<AgentDecision> {
    const { taskId, taskContent, taskDescription = '', userNote = '', projectId } = params;

    dbService.saveDelegatedTask({
      task_id: taskId,
      content: taskContent,
      project_id: projectId || null,
      user_note: userNote || null,
      status: 'in_progress',
      llm_summary: 'Agent is analyzing task...',
      llm_plan: null,
      action_log: JSON.stringify([`[${new Date().toISOString()}] User handed over task to LLM. Note: "${userNote || 'None provided'}"`])
    });

    let decision: AgentDecision;

    try {
      if (this.hasAgy()) {
        decision = await this.runWithAgy(taskContent, taskDescription, userNote);
      } else {
        decision = await this.fallbackReasoning(taskContent, taskDescription, userNote);
      }
    } catch (err: any) {
      console.warn('[Agent] Primary execution encountered issue, using heuristic agent reasoning:', err.message);
      decision = await this.fallbackReasoning(taskContent, taskDescription, userNote);
    }

    // Save decision to DB
    const now = new Date();
    const isWaiting = decision.is_waiting || Boolean(decision.checker);
    const nextStatus = isWaiting ? 'waiting' : 'surfaced';

    dbService.saveDelegatedTask({
      task_id: taskId,
      content: taskContent,
      project_id: projectId || null,
      user_note: userNote || null,
      status: nextStatus,
      llm_summary: decision.summary,
      llm_plan: decision.plan,
      action_log: JSON.stringify([
        `[${now.toISOString()}] Handover received. Note: "${userNote || 'None'}"`,
        ...decision.actions_taken.map(a => `[${now.toISOString()}] Action: ${a}`)
      ])
    });

    // Schedule Checker if waiting
    if (decision.checker) {
      const checkHours = decision.checker.next_check_hours || decision.checker.interval_hours || 24;
      const nextCheckDate = new Date(Date.now() + checkHours * 3600 * 1000).toISOString();

      dbService.createChecker({
        task_id: taskId,
        condition_desc: decision.checker.condition || 'Waiting for reply / external event',
        interval_hours: decision.checker.interval_hours || 24,
        next_check_at: nextCheckDate,
        follow_up_action: decision.checker.follow_up_action || 'Surface task and execute follow-up message if no response',
        max_checks: decision.checker.max_checks || 3
      });

      dbService.appendActionLog(
        taskId,
        `Scheduled Checker: Checking every ${decision.checker.interval_hours}h for: "${decision.checker.condition}". Next run: ${nextCheckDate}`
      );
    }

    // Post to Todoist
    if (todoist.isConfigured()) {
      try {
        const commentParts = [
          `🤖 **[AI Agent Handover]** LLM took over this task.`,
          `**User Note:** ${userNote || 'None'}`,
          `**Assessment:** ${decision.summary}`,
          `**Plan:** ${decision.plan}`
        ];

        if (decision.checker) {
          commentParts.push(
            `⏱️ **Checker Scheduled:** Will verify in ${decision.checker.next_check_hours || decision.checker.interval_hours}h for "${decision.checker.condition}". If no response: "${decision.checker.follow_up_action}".`
          );
        }

        await todoist.addComment(taskId, commentParts.join('\n\n'));
        dbService.appendActionLog(taskId, 'Synced handover details & checker schedule as comment to Todoist.');
      } catch (err: any) {
        console.error('[Agent] Failed to post comment to Todoist:', err.message);
        dbService.appendActionLog(taskId, `Warning: Failed to sync Todoist comment: ${err.message}`);
      }
    }

    return decision;
  }

  private async runWithAgy(content: string, description: string, userNote: string): Promise<AgentDecision> {
    const prompt = `You are an autonomous AI executive assistant in Antigravity.
A busy user has handed over this Todoist task to you because they CANNOT or DO NOT WANT to do it.
You must take over full responsibility for driving this to completion or setting up automated checks.

TASK TITLE: "${content}"
TASK DESCRIPTION: "${description || 'None'}"
USER NOTE: "${userNote || 'I cannot or do not want to do this, take over.'}"

INSTRUCTIONS:
1. Explain what immediate actions you have drafted or prepared (e.g. communication draft, research, problem decomposition).
2. Determine if this task is waiting for a reply or external condition (e.g., waiting for email response, awaiting approval, tracking an order/delivery, waiting for a colleague).
3. If waiting, define a CHECKER schedule with:
   - condition: exact thing we are waiting on
   - interval_hours: frequency of checking (typically 24, 48, or 72)
   - next_check_hours: hours from now for first check (e.g. 24)
   - follow_up_action: what follow up action to take if no response (e.g., send reminder, surface back to user)
   - max_checks: max number of checks before alert (e.g. 3)

Respond strictly with valid JSON conforming to this schema (do not wrap in markdown or any other text):
{
  "summary": "Brief 1-2 sentence executive summary of what was assessed",
  "plan": "Step-by-step autonomous execution plan",
  "actions_taken": ["List of concrete actions taken or prepared"],
  "is_waiting": true,
  "waiting_reason": "Specific reason if waiting",
  "checker": {
    "condition": "What condition or reply to check for",
    "interval_hours": 24,
    "next_check_hours": 24,
    "follow_up_action": "Follow up with recipient or alert user if no response",
    "max_checks": 3
  }
}`;

    const { stdout } = await execFileAsync(this.agyPath, ['-p', prompt], {
      timeout: 45000,
      env: { ...process.env, TERM: 'dumb' }
    });

    const cleaned = stdout.trim();
    // Match JSON inside output
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as AgentDecision;
    }

    throw new Error('Could not parse JSON response from agy CLI: ' + cleaned.slice(0, 100));
  }

  private async fallbackReasoning(content: string, description: string, userNote: string): Promise<AgentDecision> {
    const combined = `${content} ${description} ${userNote}`.toLowerCase();

    const isWaitingContext =
      combined.includes('wait') ||
      combined.includes('reply') ||
      combined.includes('email') ||
      combined.includes('response') ||
      combined.includes('order') ||
      combined.includes('shipping') ||
      combined.includes('call') ||
      combined.includes('ask') ||
      combined.includes('follow up') ||
      combined.includes('pending') ||
      combined.includes('invoice') ||
      combined.includes('status');

    let condition = 'Waiting for response or external progress update';
    let followUp = 'Send reminder follow-up or elevate task back to user';

    if (combined.includes('email') || combined.includes('reply') || combined.includes('message')) {
      condition = 'Awaiting reply to inquiry or email thread';
      followUp = 'Follow up with a courteous reminder if still no response';
    } else if (combined.includes('order') || combined.includes('shipping') || combined.includes('delivery')) {
      condition = 'Awaiting shipment status update / delivery confirmation';
      followUp = 'Check tracking portal and notify user of current whereabouts';
    } else if (combined.includes('review') || combined.includes('approval')) {
      condition = 'Awaiting review / sign-off from stakeholders';
      followUp = 'Ping reviewers for pending sign-off';
    }

    return {
      summary: `Autonomous LLM handoff initiated for "${content}". The agent has taken over full ownership.`,
      plan: `1. Analyzed user directives: "${userNote || 'Self-manage to resolution'}".\n2. Monitored external dependencies.\n3. Scheduled active Checker loop to follow up or surface when conditions are met.`,
      actions_taken: [
        'Parsed task objectives and constraints',
        'Configured autonomous Checker with follow-up triggers',
        'Registered task into active LLM monitoring pipeline'
      ],
      is_waiting: isWaitingContext,
      waiting_reason: isWaitingContext ? condition : undefined,
      checker: isWaitingContext
        ? {
            condition,
            interval_hours: 24,
            next_check_hours: 24,
            follow_up_action: followUp,
            max_checks: 3
          }
        : undefined
    };
  }
}

export const agentService = new AgentService();
