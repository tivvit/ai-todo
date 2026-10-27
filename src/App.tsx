import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { FocusView } from './components/FocusView';
import { DelegatedDashboard } from './components/DelegatedDashboard';
import { AllTasksView } from './components/AllTasksView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { TodoItem, AppStatus } from './types';
import { Loader2, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'focus' | 'all' | 'delegated' | 'history' | 'settings'>('focus');
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err: any) {
      console.error('Error fetching status:', err);
    }
  }, []);

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/todos');
      if (res.ok) {
        const data = await res.json();
        setTodos(data);
        if (currentIndex >= data.length) {
          setCurrentIndex(0);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to fetch tasks from Todoist');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching tasks');
    } finally {
      setLoading(false);
    }
  }, [currentIndex]);

  useEffect(() => {
    fetchStatus();
    fetchTodos();
  }, [fetchStatus, fetchTodos]);

  // Actions
  const handleDone = async (task: TodoItem) => {
    try {
      const res = await fetch(`/api/todos/${task.id}/done`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: task.content })
      });
      if (res.ok) {
        setTodos(prev => prev.filter(t => t.id !== task.id));
        fetchStatus();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to mark task done');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDoneWithNote = async (
    task: TodoItem,
    note: string,
    followUp?: { create: boolean; title?: string; due?: string }
  ) => {
    try {
      const res = await fetch(`/api/todos/${task.id}/done-with-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: task.content,
          note,
          projectId: task.project_id,
          createFollowUp: followUp?.create || false,
          followUpTitle: followUp?.title,
          followUpDue: followUp?.due
        })
      });
      if (res.ok) {
        setTodos(prev => prev.filter(t => t.id !== task.id));
        fetchStatus();
        fetchTodos();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save note');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePostpone = async (task: TodoItem, reason: string, dueString: string) => {
    try {
      const res = await fetch(`/api/todos/${task.id}/postpone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: task.content, reason, dueDateString: dueString })
      });
      if (res.ok) {
        // Move to next or remove from active list if pushed into future
        setTodos(prev => prev.filter(t => t.id !== task.id));
        fetchStatus();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to postpone task');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelegate = async (task: TodoItem, note: string) => {
    try {
      const res = await fetch(`/api/todos/${task.id}/delegate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: task.content,
          description: task.description,
          userNote: note,
          projectId: task.project_id
        })
      });
      if (res.ok) {
        // Advance to next task
        if (currentIndex < todos.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          setCurrentIndex(0);
        }
        await fetchTodos();
        await fetchStatus();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delegate task to AI');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header
        currentTab={currentTab}
        setCurrentTab={tab => setCurrentTab(tab as any)}
        status={status}
        totalTodos={todos.length}
      />

      <main className="flex-1">
        {loading && todos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">Connecting to Todoist and loading your tasks...</p>
          </div>
        ) : error && todos.length === 0 ? (
          <div className="max-w-lg mx-auto mt-16 p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="font-bold text-lg text-rose-200">Unable to Load Tasks</h3>
            <p className="text-xs text-rose-300 leading-relaxed">{error}</p>
            <div className="pt-2">
              <button
                onClick={() => setCurrentTab('settings')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
              >
                Go to Settings & Configure Token
              </button>
            </div>
          </div>
        ) : (
          <>
            {currentTab === 'focus' && (
              <FocusView
                todos={todos}
                currentIndex={currentIndex}
                setCurrentIndex={setCurrentIndex}
                onDone={handleDone}
                onDoneWithNote={handleDoneWithNote}
                onPostpone={handlePostpone}
                onDelegate={handleDelegate}
                onRefresh={fetchTodos}
              />
            )}

            {currentTab === 'all' && (
              <AllTasksView
                todos={todos}
                onSelectTask={idx => {
                  setCurrentIndex(idx);
                  setCurrentTab('focus');
                }}
                onDone={handleDone}
              />
            )}

            {currentTab === 'delegated' && (
              <DelegatedDashboard onRefreshTasks={fetchTodos} />
            )}

            {currentTab === 'history' && <HistoryView />}

            {currentTab === 'settings' && (
              <SettingsView status={status} onRefreshStatus={fetchStatus} />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-600">
        AI-Todo • Open Source Todoist Triage with Autonomous Antigravity Takeover & Follow-Up Checkers
      </footer>
    </div>
  );
};
