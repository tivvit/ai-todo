import React, { useState, useEffect } from 'react';
import { History, CheckCircle2, FileText, Clock, Bot, RefreshCw } from 'lucide-react';
import { TaskDecision } from '../types';

export const HistoryView: React.FC = () => {
  const [decisions, setDecisions] = useState<TaskDecision[]>([]);
  const [loading, setLoading] = useState(true);

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
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Decision History</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Log of actions taken during your one-by-one triage sessions
          </p>
        </div>
        <button
          onClick={fetchHistory}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800 shadow-xl">
        {decisions.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No decisions logged yet. Start triaging in the 1-by-1 Focus tab!
          </div>
        ) : (
          decisions.map(d => {
            const style = actionIcons[d.action] || actionIcons.done;
            const Icon = style.icon;

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

                  <div className="mt-1 flex items-center space-x-2">
                    <span className="text-xs font-medium text-slate-300">Action: {style.label}</span>
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
