import React from 'react';
import { CheckCircle2, Clock, Bot, ListTodo, Settings, Sparkles, History } from 'lucide-react';
import { AppStatus } from '../types';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  status: AppStatus | null;
  totalTodos: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  status,
  totalTodos
}) => {
  const tabs = [
    { id: 'focus', label: '1-by-1 Focus', icon: Sparkles, count: totalTodos },
    { id: 'all', label: 'All Tasks', icon: ListTodo, count: totalTodos },
    { id: 'delegated', label: 'AI Agent & Checkers', icon: Bot, count: status?.counts.delegatedTasks || 0 },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-lg">
            ⚡
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg text-white tracking-tight">AI Todo</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Antigravity Agent
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              One-by-one Todoist triage with autonomous handoff & checkers
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center space-x-2 sm:space-x-4 text-xs">
          <div className="flex items-center space-x-1.5 bg-slate-800/80 border border-slate-700/60 rounded-full px-3 py-1">
            <span
              className={`w-2 h-2 rounded-full ${
                status?.todoist.connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-300">
              {status?.todoist.connected ? 'Todoist Synced' : 'Todoist Offline'}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-800/80 border border-slate-700/60 rounded-full px-3 py-1">
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-300">
              {status?.agent.hasAgy ? 'Antigravity CLI' : 'Agent Ready'}
            </span>
          </div>

          {(status?.counts.activeCheckers || 0) > 0 && (
            <div className="flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1 text-amber-300">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>{status?.counts.activeCheckers} Active Checkers</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-none">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex items-center space-x-2 py-2.5 px-3 sm:px-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-indigo-500 text-white bg-slate-800/40 rounded-t-lg'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${
                    isActive
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
