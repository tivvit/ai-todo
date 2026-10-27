import React, { useState, useEffect } from 'react';
import { History, CheckCircle2, FileText, Clock, Bot, User, RefreshCw } from 'lucide-react';
import { TaskDecision } from '../types';

export const HistoryView: React.FC = () => {
  const [decisions, setDecisions] = useState<TaskDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [actorFilter, setActorFilter] = useState<'all' | 'user' | 'ai'>('all');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setDecisions(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const actionIcons: Record<string, { icon: any; color: string; label: string }> = {
    done: { icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Done' },
    done_with_note: { icon: FileText, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20', label: 'Done with Note' },
    postponed: { icon: Clock, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Postponed' },
    delegated: { icon: Bot, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', label: 'Delegated to AI' },
    created_followup: { icon: FileText, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', label: 'Created Follow-up' },
  };

  const filtered = decisions.filter(d => {
    if (actorFilter === 'all') return true;
    return (d.actor || 'user') === actorFilter;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Decision & Completion History</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Audit trail clearly attributing every task completed by the User vs completed by AI.
          </p>
        </div>
        <button
          onClick={fetchHistory}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Actor Filters */}
      <div className="flex space-x-2 border-b border-slate-800 pb-3 mb-6">
        <button
          onClick={() => setActorFilter('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
            actorFilter === 'all'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          All Activity ({decisions.length})
        </button>
        <button
          onClick={() => setActorFilter('user')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition ${
            actorFilter === 'user'
              ? 'bg-emerald-600 text-white'
              : 'text-emerald-400 hover:bg-emerald-500/10'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Done by User ({decisions.filter(d => (d.actor || 'user') === 'user').length})</span>
        </button>
        <button
          onClick={() => setActorFilter('ai')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition ${
            actorFilter === 'ai'
              ? 'bg-indigo-600 text-white'
              : 'text-indigo-400 hover:bg-indigo-500/10'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Done by AI ({decisions.filter(d => d.actor === 'ai').length})</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800 shadow-xl">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No decisions matching this filter.
          </div>
        ) : (
          filtered.map(d => {
            const style = actionIcons[d.action] || actionIcons.done;
            const Icon = style.icon;
            const isAI = d.actor === 'ai';

            return (
              <div key={d.id} className="p-4 flex items-start space-x-3.5 hover:bg-slate-800/30 transition">
                <div className={`p-2 rounded-xl border ${style.color} mt-0.5`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-semibold text-white text-sm">
                      {d.content || `Task #${d.task_id}`}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(d.created_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Actor Attribution Badge */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1 border ${
                        isAI
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {isAI ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      <span>{isAI ? 'Completed by AI Agent' : 'Completed by User'}</span>
                    </span>

                    <span className="text-xs text-slate-400">
                      Action: <strong className="text-slate-200">{style.label}</strong>
                    </span>

                    {d.postpone_until && (
                      <span className="text-xs text-amber-400">
                        • Postponed until {d.postpone_until}
                      </span>
                    )}
                  </div>

                  {d.reason && (
                    <p className="text-xs text-slate-400 mt-1 italic">Reason: "{d.reason}"</p>
                  )}

                  {d.note && (
                    <p className="text-xs text-indigo-300 mt-1 bg-slate-950/60 border border-slate-800 rounded-lg p-2">
                      Note: "{d.note}"
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
