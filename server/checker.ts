import cron from 'node-cron';
import { CONFIG } from './config.js';
import { dbService, Checker } from './db.js';
import { todoist } from './todoist.js';

export class CheckerService {
  private cronJob: cron.ScheduledTask | null = null;
  private isChecking = false;

  public start() {
    console.log(`[Checker] Initializing background checker service with schedule: ${CONFIG.CHECKER_CRON}`);
    this.cronJob = cron.schedule(CONFIG.CHECKER_CRON, async () => {
      await this.runPendingChecks();
    });
  }

  public stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
  }

  public async runPendingChecks(): Promise<number> {
    if (this.isChecking) return 0;
    this.isChecking = true;

    let checkedCount = 0;
    try {
      const activeCheckers = dbService.getActiveCheckers();
      const now = new Date();

      for (const checker of activeCheckers) {
        const nextCheckDate = new Date(checker.next_check_at);
        if (nextCheckDate <= now) {
          checkedCount++;
          await this.evaluateChecker(checker);
        }
      }
    } catch (err: any) {
      console.error('[Checker] Error running pending checks:', err.message);
    } finally {
      this.isChecking = false;
    }

    return checkedCount;
  }

  public async evaluateChecker(checker: Checker & { content?: string; user_note?: string | null }): Promise<{
    status: 'triggered' | 'rescheduled' | 'dismissed';
    message: string;
  }> {
    const taskId = checker.task_id;
    const now = new Date();
    const newCheckCount = checker.check_count + 1;

    dbService.appendActionLog(
      taskId,
      `Running Checker #${newCheckCount}: Verifying "${checker.condition_desc}"...`
    );

    // 1. Check if Todoist task still exists and is open
    let isTaskOpen = true;
    let recentComments: any[] = [];

    if (todoist.isConfigured()) {
      try {
        const task = await todoist.getTask(taskId);
        if (task.checked) {
          isTaskOpen = false;
        }
        recentComments = await todoist.getComments(taskId);
      } catch (err: any) {
        if (err.message.includes('404')) {
          isTaskOpen = false;
        }
      }
    }

    if (!isTaskOpen) {
      dbService.updateChecker(checker.id, {
        status: 'dismissed',
        last_checked_at: now.toISOString()
      });
      dbService.updateTaskStatus(taskId, 'completed');
      dbService.appendActionLog(taskId, 'Checker dismissed: Task was marked done or removed in Todoist.');
      return { status: 'dismissed', message: 'Task was completed externally.' };
    }

    // 2. Check for human / external replies in comments
    const externalComments = recentComments.filter(
      c => !c.content.includes('🤖 [AI') && !c.content.includes('Handover received')
    );

    const hasNewExternalReply = externalComments.length > 0;

    if (hasNewExternalReply) {
      // Reply detected! Surface the task back to the user
      dbService.updateChecker(checker.id, {
        status: 'triggered',
        last_checked_at: now.toISOString()
      });
      dbService.updateTaskStatus(taskId, 'surfaced');

      const surfaceMsg = `A reply/update was detected on Todoist! Condition met for "${checker.condition_desc}". Surfacing back to user attention.`;
      dbService.appendActionLog(taskId, surfaceMsg);

      if (todoist.isConfigured()) {
        try {
          await todoist.addComment(
            taskId,
            `🤖 **[AI Checker Alert]** Condition observed or updated! Surfaced to active triage.`
          );
        } catch {}
      }

      return { status: 'triggered', message: surfaceMsg };
    }

    // 3. No response yet: Check if we reached max checks or follow-up threshold
    if (newCheckCount >= checker.max_checks) {
      // Escalation / Follow-up triggered!
      dbService.updateChecker(checker.id, {
        status: 'triggered',
        check_count: newCheckCount,
        last_checked_at: now.toISOString()
      });
      dbService.updateTaskStatus(taskId, 'surfaced');

      const followUpMsg = `No response received after ${newCheckCount * checker.interval_hours} hours. Executed follow-up: "${checker.follow_up_action}". Surfacing task for user visibility.`;
      dbService.appendActionLog(taskId, followUpMsg);

      if (todoist.isConfigured()) {
        try {
          await todoist.addComment(
            taskId,
            `🤖 **[AI Follow-up Triggered]** No response received after ${newCheckCount} checks (${newCheckCount * checker.interval_hours}h).\n\n**Action taken:** ${checker.follow_up_action}\n\nTask has been resurfaced in your AI Todo queue.`
          );
          // Bump priority on Todoist to indicate need for attention
          await todoist.updateTask(taskId, {
            priority: 4 // P1 in Todoist (highest)
          });
        } catch (err: any) {
          console.error('[Checker] Failed to sync follow-up to Todoist:', err.message);
        }
      }

      return { status: 'triggered', message: followUpMsg };
    } else {
      // Reschedule for next check
      const nextDate = new Date(Date.now() + checker.interval_hours * 3600 * 1000).toISOString();
      dbService.updateChecker(checker.id, {
        check_count: newCheckCount,
        last_checked_at: now.toISOString(),
        next_check_at: nextDate
      });

      const reschedMsg = `Still waiting for "${checker.condition_desc}". Next check scheduled for ${nextDate} (check ${newCheckCount}/${checker.max_checks}).`;
      dbService.appendActionLog(taskId, reschedMsg);

      return { status: 'rescheduled', message: reschedMsg };
    }
  }

  public async triggerCheckerNow(checkerId: number) {
    const stmt = dbService.getActiveCheckers().find(c => c.id === checkerId);
    if (!stmt) {
      throw new Error(`Active checker #${checkerId} not found`);
    }
    return await this.evaluateChecker(stmt);
  }
}

export const checkerService = new CheckerService();
