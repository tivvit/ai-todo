import React, { useState } from 'react';
import { Settings, Key, Bot, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { AppStatus } from '../types';

interface SettingsViewProps {
  status: AppStatus | null;
  onRefreshStatus: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ status, onRefreshStatus }) => {
  const [newToken, setNewToken] = useState('');
  const [newCron, setNewCron] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingCron, setIsUpdatingCron] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cronMessage, setCronMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpdateCron = async (cronExpr: string) => {
    setIsUpdatingCron(true);
    setCronMessage(null);
    try {
      const res = await fetch('/api/settings/checker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cron: cronExpr })
      });
      const data = await res.json();
      if (res.ok) {
        setCronMessage({ type: 'success', text: `Checker interval updated to: ${data.schedule}` });
        setNewCron('');
        await onRefreshStatus();
      } else {
        setCronMessage({ type: 'error', text: data.error || 'Failed to update schedule' });
      }
    } catch (err: any) {
      setCronMessage({ type: 'error', text: err.message });
    } finally {
      setIsUpdatingCron(false);
    }
  };

  const handleUpdateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newToken.trim()) return;

    setIsUpdating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: newToken.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Todoist API token updated successfully!' });
        setNewToken('');
        await onRefreshStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update token' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">System & Integrations</h2>
        <p className="text-slate-400 text-sm mt-0.5">
          Configure Todoist connectivity, Antigravity LLM engine, and background schedules.
        </p>
      </div>

      {/* Todoist Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold">
            TD
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Todoist Integration</h3>
            <p className="text-xs text-slate-400">
              API v1 connection for reading tasks, completing, postponing, and posting comments.
            </p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs text-slate-400">Current Status:</span>
            <div className="flex items-center space-x-2 mt-0.5">
              {status?.todoist.connected ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">
                    Connected & Verified (v1 API)
                  </span>
                  {status.todoist.tokenMasked && (
                    <span className="text-xs font-mono text-slate-500">
                      [{status.todoist.tokenMasked}]
                    </span>
                  )}
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span className="text-sm font-semibold text-rose-400">
                    Not Connected {status?.todoist.error && `(${status.todoist.error})`}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-400">
            Auto-discovered from OpenClaw (<code className="text-indigo-400">mcporter.json</code>)
          </div>
        </div>

        {/* Update Token Form */}
        <form onSubmit={handleUpdateToken} className="space-y-3">
          <label className="block text-xs font-medium text-slate-300">
            Override Todoist API Token
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={newToken}
              onChange={e => setNewToken(e.target.value)}
              placeholder="Paste custom Todoist API Token..."
              className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <button
              type="submit"
              disabled={!newToken.trim() || isUpdating}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition"
            >
              {isUpdating ? 'Saving...' : 'Update Token'}
            </button>
          </div>
          {message && (
            <p
              className={`text-xs ${
                message.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {message.text}
            </p>
          )}
        </form>
      </div>

      {/* Background Checker Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Background Checker Frequency</h3>
            <p className="text-xs text-slate-400">
              Configure how frequently the autonomous background loop evaluates waiting checkers & follow-up rules.
            </p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-slate-400">Current Schedule:</span>
            <div className="font-mono font-bold text-amber-400 text-sm mt-0.5">
              {status?.checkerCron || '*/15 * * * *'}
            </div>
          </div>
          <span className="text-slate-400">
            Dynamically applied without server downtime
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Quick Frequency Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Every 5 mins', cron: '*/5 * * * *' },
              { label: 'Every 15 mins (Recommended)', cron: '*/15 * * * *' },
              { label: 'Every 30 mins', cron: '*/30 * * * *' },
              { label: 'Every 1 hour', cron: '0 * * * *' },
              { label: 'Every 6 hours', cron: '0 */6 * * *' },
              { label: 'Every minute (Debug)', cron: '* * * * *' },
            ].map(preset => (
              <button
                type="button"
                key={preset.cron}
                onClick={() => handleUpdateCron(preset.cron)}
                disabled={isUpdatingCron || status?.checkerCron === preset.cron}
                className={`text-xs px-3 py-1.5 rounded-xl font-medium transition ${
                  status?.checkerCron === preset.cron
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={e => {
            e.preventDefault();
            if (newCron.trim()) handleUpdateCron(newCron.trim());
          }}
          className="pt-2 flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={newCron}
            onChange={e => setNewCron(e.target.value)}
            placeholder="Custom 5-field cron (e.g. */20 * * * *)"
            className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={!newCron.trim() || isUpdatingCron}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition"
          >
            {isUpdatingCron ? 'Saving...' : 'Set Custom Cron'}
          </button>
        </form>

        {cronMessage && (
          <p
            className={`text-xs ${
              cronMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {cronMessage.text}
          </p>
        )}
      </div>

      {/* Antigravity CLI Integration */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Antigravity LLM Engine</h3>
            <p className="text-xs text-slate-400">
              Autonomous reasoning, delegation intake, and checker formulation.
            </p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Binary Path:</span>
            <code className="text-slate-200 font-mono">{status?.agent.agyPath}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Availability:</span>
            <span
              className={`font-semibold ${
                status?.agent.hasAgy ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {status?.agent.hasAgy ? 'Ready (Antigravity CLI available)' : 'Fallback Mode'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Background Checker Loop:</span>
            <span className="text-slate-200 font-medium">Running every minute (cron)</span>
          </div>
        </div>
      </div>

      {/* Process Architecture Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-xs text-slate-400 space-y-3">
        <h4 className="font-bold text-white text-sm">How AI-Todo Operates</h4>
        <ul className="list-disc list-inside space-y-1.5 leading-relaxed">
          <li>
            <strong className="text-slate-200">1-by-1 Focus:</strong> Tasks are presented sequentially to prevent overwhelm.
          </li>
          <li>
            <strong className="text-slate-200">Done / Done with Note:</strong> Completes the task on Todoist immediately, saving any note to comments.
          </li>
          <li>
            <strong className="text-slate-200">Postpone with Reason:</strong> Sets new due dates in Todoist and saves the postponement rationale.
          </li>
          <li>
            <strong className="text-slate-200">Autonomous LLM Takeover:</strong> When you hand over, the Antigravity agent formulates an execution plan and sets up an automated Checker.
          </li>
          <li>
            <strong className="text-slate-200">Checker & Resurfacing Loop:</strong> The background engine monitors waiting conditions, triggers follow-ups if no response is detected, and brings the item back to the front of your queue.
          </li>
        </ul>
      </div>
    </div>
  );
};
