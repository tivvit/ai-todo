import React, { useState, useEffect } from 'react';
import {
  Bot,
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  Calendar,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { DelegatedTask, Checker } from '../types';

interface DelegatedDashboardProps {
  onRefreshTasks: () => Promise<void>;
}

export const DelegatedDashboard: React.FC<DelegatedDashboardProps> = ({ onRefreshTasks }) => {
  const [tasks, setTasks] = useState<DelegatedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'waiting' | 'surfaced' | 'completed'>('all');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [triggeringId, setTriggeringId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ id: number; text: string } | null>(null);

  const fetchDelegated = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delegated');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDelegated();
  }, []);

  const handleTriggerChecker = async (checkerId: number) => {
    setTriggeringId(checkerId);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/checkers/${checkerId}/trigger`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMsg({
          id: checkerId,
          text: data.result?.message || 'Checker run completed!'
        });
        await fetchDelegated();
        await onRefreshTasks();
      } else {
        alert(data.error || 'Failed to trigger checker');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTriggeringId(null);
    }
  };

  const handleCompleteByAI = async (task: DelegatedTask) => {
    setCompletingId(task.task_id);
    try {
      const res = await fetch(`/api/todos/${task.task_id}/ai-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: task.content,
          summary: task.llm_summary || 'Resolved autonomously by Antigravity AI Agent'
        })
      });
      const data = await res.json();
      if (res.ok) {
        await fetchDelegated();
        await onRefreshTasks();
      } else {
        alert(data.error || 'Failed to mark task complete by AI');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCompletingId(null);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const statusStyles: Record<string, { label: string; bg: string; text: string; icon: any }> = {
    waiting: { label: 'Waiting on Reply / Event', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400', icon: Clock },
    surfaced: { label: 'Surfaced for Attention', bg: 'bg-rose-500/10 border-rose-500/30', text: 'text-rose-400', icon: AlertTriangle },
    in_progress: { label: 'Agent In Progress', bg: 'bg-indigo-500/10 border-indigo-500/30', text: 'text-indigo-400', icon: Bot },
    completed: { label: 'Resolved / Completed', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', icon: CheckCircle2 },
    failed: { label: 'Halted', bg: 'bg-slate-500/10 border-slate-500/30', text: 'text-slate-400', icon: AlertTriangle },
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              AI Agent & Checkers Center
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
              Antigravity Driven
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Tasks handed over to the LLM when you can't or don't want to do them. Autonomous checkers periodically follow up and resurface items when ready.
          </p>
        </div>

        <button
          onClick={fetchDelegated}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-3 mb-6 overflow-x-auto">
        {(['all', 'waiting', 'surfaced', 'completed'] as const).map(tabKey => (
          <button
            key={tabKey}
            onClick={() => setFilter(tabKey)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
              filter === tabKey
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tabKey} ({tasks.filter(t => (tabKey === 'all' ? true : t.status === tabKey)).length})
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          <Loader2 className="w-6 h-6 animate-spin mr-2 text-indigo-400" />
          <span>Loading delegated tasks and active checkers...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-3xl p-8">
          <Bot className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-slate-300 font-semibold text-base mb-1">No tasks in this view</h3>
          <p className="text-slate-500 text-xs max-w-sm mx-auto">
            When you're triaging tasks and click "Hand Over to AI", they will appear here with active plans and autonomous checkers.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map(task => {
            const isExpanded = expandedTask === task.task_id;
            const style = statusStyles[task.status] || statusStyles.waiting;
            const StatusIcon = style.icon;

            return (
              <div
                key={task.task_id}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700/80 transition shadow-lg"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedTask(isExpanded ? null : task.task_id)}
                  className="p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none hover:bg-slate-800/20"
                >
                  <div className="flex items-start space-x-3.5">
                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 mt-0.5">
                      <Bot className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-white text-base tracking-tight">
                          {task.content}
                        </h3>
                      </div>
                      {task.user_note && (
                        <p className="text-xs text-indigo-300/90 mt-1 line-clamp-1 italic">
                          "User note: {task.user_note}"
                        </p>
                      )}
                      <div className="flex items-center space-x-3 text-xs text-slate-400 mt-2">
                        <span>Updated: {new Date(task.updated_at).toLocaleString()}</span>
                        {task.checkers && task.checkers.length > 0 && (
                          <span className="text-amber-400 font-medium">
                            • {task.checkers.filter(c => c.status === 'active').length} Active Checker(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 self-end sm:self-auto">
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-semibold border flex items-center space-x-1.5 ${style.bg} ${style.text}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{style.label}</span>
                    </span>
                    <button className="text-slate-400 hover:text-white">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-800 bg-slate-950/40 space-y-4 text-xs">
                    {/* Summary */}
                    {task.llm_summary && (
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                        <div className="text-slate-400 font-semibold mb-1 flex items-center space-x-1">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Executive Assessment:</span>
                        </div>
                        <p className="text-slate-200 leading-relaxed">{task.llm_summary}</p>
                      </div>
                    )}

                    {/* Plan */}
                    {task.llm_plan && (
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                        <div className="text-slate-400 font-semibold mb-1">Autonomous Execution Plan:</div>
                        <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {task.llm_plan}
                        </p>
                      </div>
                    )}

                    {/* Checkers */}
                    {task.checkers && task.checkers.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-slate-400 font-semibold flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Automated Checkers & Follow-Up Rules:</span>
                        </div>

                        {task.checkers.map(checker => (
                          <div
                            key={checker.id}
                            className="bg-slate-900/90 border border-amber-500/20 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-amber-300">
                                  Condition: "{checker.condition_desc}"
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300">
                                  {checker.status}
                                </span>
                              </div>
                              <p className="text-slate-400 text-[11px]">
                                Next scheduled check:{' '}
                                <span className="text-slate-200 font-medium">
                                  {new Date(checker.next_check_at).toLocaleString()}
                                </span>{' '}
                                (Checks done: {checker.check_count}/{checker.max_checks})
                              </p>
                              <p className="text-slate-400 text-[11px]">
                                Follow-up rule if no reply:{' '}
                                <span className="text-indigo-300">"{checker.follow_up_action}"</span>
                              </p>
                            </div>

                            {checker.status === 'active' && (
                              <button
                                onClick={() => handleTriggerChecker(checker.id)}
                                disabled={triggeringId === checker.id}
                                className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold transition self-start sm:self-center"
                              >
                                {triggeringId === checker.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Play className="w-3.5 h-3.5" />
                                )}
                                <span>Run Check Now</span>
                              </button>
                            )}
                          </div>
                        ))}

                        {feedbackMsg && (
                          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg p-2.5 text-xs">
                            {feedbackMsg.text}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Log History */}
                    {task.action_logs && task.action_logs.length > 0 && (
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                        <div className="text-slate-400 font-semibold mb-2">Audit & Progress Log:</div>
                        <div className="space-y-1 font-mono text-[11px] text-slate-300 max-h-40 overflow-y-auto">
                          {task.action_logs.map((log, idx) => (
                            <div key={idx} className="leading-relaxed">
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    {task.status !== 'completed' && (
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => handleCompleteByAI(task)}
                          disabled={completingId === task.task_id}
                          className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20"
                        >
                          {completingId === task.task_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Mark Resolved by AI (Syncs to Todoist)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
