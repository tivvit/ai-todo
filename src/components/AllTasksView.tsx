import React, { useState } from 'react';
import {
  CheckCircle2,
  Search,
  Calendar,
  AlertTriangle,
  Bot
} from 'lucide-react';
import { TodoItem, TodoProject, TimeScope } from '../types';
import { ScopeFilterBar } from './ScopeFilterBar';

interface AllTasksViewProps {
  todos: TodoItem[];
  projects: TodoProject[];
  selectedProject: string;
  onSelectProject: (projectId: string) => void;
  timeScope: TimeScope;
  onSelectTimeScope: (scope: TimeScope) => void;
  loading?: boolean;
  onRefresh?: () => void;
  onSelectTask: (index: number) => void;
  onDone: (task: TodoItem) => Promise<void>;
}

export const AllTasksView: React.FC<AllTasksViewProps> = ({
  todos,
  projects,
  selectedProject,
  onSelectProject,
  timeScope,
  onSelectTimeScope,
  loading = false,
  onRefresh,
  onSelectTask,
  onDone
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = todos.filter(t => {
    const matchesSearch =
      t.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">All Active Tasks</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Full inventory synced directly from your Todoist account
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search in current view..."
              className="bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Scope and Project Filtering Toolbar */}
      <ScopeFilterBar
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={onSelectProject}
        timeScope={timeScope}
        onSelectTimeScope={onSelectTimeScope}
        taskCount={filtered.length}
        loading={loading}
        onRefresh={onRefresh}
      />

      {/* Task List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/80 shadow-xl">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No matching tasks found for this search/filter.
          </div>
        ) : (
          filtered.map((task, idx) => (
            <div
              key={task.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition group"
            >
              <div className="flex items-start space-x-3">
                <button
                  onClick={() => onDone(task)}
                  className="mt-1 text-slate-500 hover:text-emerald-400 transition"
                  title="Mark Done"
                >
                  <CheckCircle2 className="w-5 h-5" />
                </button>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-white text-sm group-hover:text-indigo-300 transition">
                      {task.content}
                    </span>
                    {task.isSurfaced && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>AI Surfaced</span>
                      </span>
                    )}
                    {task.delegated && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center space-x-1">
                        <Bot className="w-3 h-3" />
                        <span>{task.delegated.status}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-400">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                      📁 {task.projectName}
                    </span>
                    {task.due && (
                      <span className="flex items-center space-x-1 text-slate-300">
                        <Calendar className="w-3 h-3 text-indigo-400" />
                        <span>{task.due.string || task.due.date}</span>
                      </span>
                    )}
                    {task.priority === 4 && (
                      <span className="text-rose-400 font-medium">P1 Urgent</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-end sm:self-auto">
                <button
                  onClick={() => onSelectTask(todos.indexOf(task))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition"
                >
                  Focus This Task
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
