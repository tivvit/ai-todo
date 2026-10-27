import React from 'react';
import {
  Folder,
  Zap,
  Calendar,
  Clock,
  CalendarDays,
  Inbox,
  Layers,
  RefreshCw
} from 'lucide-react';
import { TodoProject, TimeScope } from '../types';

interface ScopeFilterBarProps {
  projects: TodoProject[];
  selectedProject: string;
  onSelectProject: (projectId: string) => void;
  timeScope: TimeScope;
  onSelectTimeScope: (scope: TimeScope) => void;
  taskCount: number;
  loading?: boolean;
  onRefresh?: () => void;
}

export const SCOPE_OPTIONS: { id: TimeScope; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'today_overdue', label: 'Today & Overdue', icon: Zap },
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'near_future', label: 'Next 7 Days', icon: Clock },
  { id: 'scheduled', label: 'Scheduled', icon: CalendarDays },
  { id: 'someday', label: 'Someday (No Date)', icon: Inbox },
  { id: 'all', label: 'All Tasks', icon: Layers },
];

export const ScopeFilterBar: React.FC<ScopeFilterBarProps> = ({
  projects,
  selectedProject,
  onSelectProject,
  timeScope,
  onSelectTimeScope,
  taskCount,
  loading = false,
  onRefresh
}) => {
  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-3 sm:p-4 mb-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Project Selector */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-400">
            <Folder className="w-3.5 h-3.5 text-indigo-400" />
            <span>Project:</span>
          </div>
          <select
            value={selectedProject}
            onChange={e => onSelectProject(e.target.value)}
            className="bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-medium rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 transition max-w-[220px] truncate"
          >
            <option value="all">📁 All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                #{p.name}
              </option>
            ))}
          </select>

          {/* Quick Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              title="Refresh tasks"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Task count badge */}
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60 hidden sm:inline-block">
            {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        {/* Time Horizon Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {SCOPE_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const isActive = timeScope === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onSelectTimeScope(opt.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
