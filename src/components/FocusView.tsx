import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  FileText,
  Clock,
  Bot,
  ChevronRight,
  MessageSquare,
  AlertTriangle,
  Send,
  Calendar,
  Sparkles,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { TodoItem, TodoComment } from '../types';

interface FocusViewProps {
  todos: TodoItem[];
  currentIndex: number;
  setCurrentIndex: (index: number | ((prev: number) => number)) => void;
  onDone: (task: TodoItem) => Promise<void>;
  onDoneWithNote: (task: TodoItem, note: string) => Promise<void>;
  onPostpone: (task: TodoItem, reason: string, dueString: string) => Promise<void>;
  onDelegate: (task: TodoItem, note: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const FocusView: React.FC<FocusViewProps> = ({
  todos,
  currentIndex,
  setCurrentIndex,
  onDone,
  onDoneWithNote,
  onPostpone,
  onDelegate,
  onRefresh,
}) => {
  const [activeModal, setActiveModal] = useState<'none' | 'note' | 'postpone' | 'delegate'>('none');
  const [noteText, setNoteText] = useState('');
  const [postponeReason, setPostponeReason] = useState('');
  const [postponeDue, setPostponeDue] = useState('tomorrow');
  const [delegateNote, setDelegateNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comments, setComments] = useState<TodoComment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  const currentTask = todos[currentIndex];

  useEffect(() => {
    setActiveModal('none');
    setNoteText('');
    setPostponeReason('');
    setDelegateNote('');
    setShowComments(false);
    setComments([]);
  }, [currentIndex, currentTask?.id]);

  const fetchComments = async (taskId: string) => {
    if (showComments) {
      setShowComments(false);
      return;
    }
    setLoadingComments(true);
    setShowComments(true);
    try {
      const res = await fetch(`/api/todos/${taskId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleDoneClick = async () => {
    if (!currentTask || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onDone(currentTask);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDoneWithNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTask || !noteText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onDoneWithNote(currentTask, noteText.trim());
      setActiveModal('none');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostponeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTask || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onPostpone(
        currentTask,
        postponeReason.trim() || 'Postponed for focus',
        postponeDue.trim() || 'tomorrow'
      );
      setActiveModal('none');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelegateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTask || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onDelegate(currentTask, delegateNote.trim());
      setActiveModal('none');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < todos.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  if (!currentTask || todos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Inbox Zero Reached!</h2>
        <p className="text-slate-400 max-w-md mb-6 text-sm">
          You've triaged all active tasks in your queue. Great job staying on top of your priorities.
        </p>
        <button
          onClick={onRefresh}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-indigo-600/20"
        >
          Check for New Todos
        </button>
      </div>
    );
  }

  const priorityStyles: Record<number, { label: string; bg: string; text: string; border: string }> = {
    4: { label: 'P1 Urgent', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
    3: { label: 'P2 High', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    2: { label: 'P3 Medium', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    1: { label: 'P4 Normal', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  };

  const priority = priorityStyles[currentTask.priority] || priorityStyles[1];
  const progressPercent = Math.round(((currentIndex + 1) / todos.length) * 100);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Progress Header */}
      <div className="mb-6 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-200">
            Task {currentIndex + 1} of {todos.length}
          </span>
          <span className="text-slate-600">•</span>
          <span>{progressPercent}% completed this session</span>
        </div>
        <button
          onClick={handleNext}
          className="hover:text-slate-200 transition flex items-center space-x-1"
        >
          <span>Skip to next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-800 h-1.5 rounded-full mb-8 overflow-hidden">
        <div
          className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Surfaced Banner (If Checker surfaced it) */}
      {currentTask.isSurfaced && (
        <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start space-x-3 text-amber-300">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
          <div className="text-sm">
            <p className="font-semibold text-amber-200">Resurfaced by Autonomous Checker</p>
            <p className="text-amber-300/90 text-xs mt-0.5">
              {currentTask.checker?.condition_desc
                ? `Condition reached: "${currentTask.checker.condition_desc}". Follow-up action triggered or response detected.`
                : 'This task was handed over and has now been brought back to your queue for review.'}
            </p>
          </div>
        </div>
      )}

      {/* Main Focus Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Badges / Metadata */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Project */}
          <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
            📁 {currentTask.projectName}
          </span>

          {/* Priority */}
          <span
            className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${priority.bg} ${priority.text} ${priority.border}`}
          >
            {priority.label}
          </span>

          {/* Due date */}
          {currentTask.due && (
            <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center space-x-1">
              <Calendar className="w-3 h-3 text-indigo-400" />
              <span>Due: {currentTask.due.string || currentTask.due.date}</span>
            </span>
          )}

          {/* Labels */}
          {currentTask.labels.map(l => (
            <span
              key={l}
              className="text-xs px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 border border-slate-700/40"
            >
              #{l}
            </span>
          ))}

          {/* Delegated tag */}
          {currentTask.delegated && (
            <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 flex items-center space-x-1">
              <Bot className="w-3 h-3 text-indigo-400" />
              <span>AI Managed ({currentTask.delegated.status})</span>
            </span>
          )}
        </div>

        {/* Core Question Prompt */}
        <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
          Do this now?
        </div>

        {/* Task Title */}
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug mb-4">
          {currentTask.content}
        </h2>

        {/* Task Description */}
        {currentTask.description ? (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-slate-300 text-sm mb-6 whitespace-pre-wrap leading-relaxed">
            {currentTask.description}
          </div>
        ) : null}

        {/* LLM Previous Plan (if delegated) */}
        {currentTask.delegated?.llm_plan && (
          <div className="mb-6 bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 text-xs text-indigo-200">
            <div className="flex items-center space-x-1.5 font-semibold text-indigo-300 mb-1">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span>Antigravity Agent Strategy:</span>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-slate-300">
              {currentTask.delegated.llm_plan}
            </p>
          </div>
        )}

        {/* Comments Toggle */}
        <div className="mb-6">
          <button
            onClick={() => fetchComments(currentTask.id)}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 transition py-1"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{showComments ? 'Hide Todoist Comments' : 'View Todoist Comments'}</span>
            {loadingComments && <Loader2 className="w-3 h-3 animate-spin ml-1 text-indigo-400" />}
          </button>

          {showComments && (
            <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
              {comments.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No comments yet on Todoist.</p>
              ) : (
                comments.map(c => (
                  <div
                    key={c.id}
                    className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs"
                  >
                    <div className="flex justify-between items-center text-slate-400 mb-1">
                      <span>{new Date(c.posted_at).toLocaleString()}</span>
                    </div>
                    <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {c.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal: Done With Note */}
        {activeModal === 'note' && (
          <form
            onSubmit={handleDoneWithNoteSubmit}
            className="mb-6 bg-slate-950 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-xl animate-fadeIn"
          >
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm mb-2">
              <FileText className="w-4 h-4" />
              <span>Mark Done with Note (Synced to Todoist Comment)</span>
            </div>
            <textarea
              autoFocus
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="What did you do? E.g., 'Called customer support, confirmation #98432'..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <div className="flex justify-end space-x-2 mt-3">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!noteText.trim() || isSubmitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Save Note & Complete</span>
              </button>
            </div>
          </form>
        )}

        {/* Modal: Postpone with Reason */}
        {activeModal === 'postpone' && (
          <form
            onSubmit={handlePostponeSubmit}
            className="mb-6 bg-slate-950 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl animate-fadeIn"
          >
            <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm mb-3">
              <Clock className="w-4 h-4" />
              <span>Postpone Task (Updates Due Date & Syncs Reason)</span>
            </div>

            {/* Quick date presets */}
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { label: 'Tomorrow', value: 'tomorrow' },
                { label: 'In 2 days', value: 'in 2 days' },
                { label: 'This Friday', value: 'this Friday' },
                { label: 'Next Week', value: 'next Monday' },
                { label: 'In 1 Month', value: 'in 1 month' },
              ].map(preset => (
                <button
                  type="button"
                  key={preset.value}
                  onClick={() => setPostponeDue(preset.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                    postponeDue === preset.value
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div className="sm:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">Due Date Expression</label>
                <input
                  type="text"
                  value={postponeDue}
                  onChange={e => setPostponeDue(e.target.value)}
                  placeholder="e.g. tomorrow, next week"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Reason for Postponing</label>
                <input
                  type="text"
                  autoFocus
                  value={postponeReason}
                  onChange={e => setPostponeReason(e.target.value)}
                  placeholder="Why postpone? E.g., 'Waiting for feedback from Alex'..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                <span>Postpone Task</span>
              </button>
            </div>
          </form>
        )}

        {/* Modal: Hand Over to LLM */}
        {activeModal === 'delegate' && (
          <form
            onSubmit={handleDelegateSubmit}
            className="mb-6 bg-slate-950 border border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-2xl animate-fadeIn"
          >
            <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-sm mb-2">
              <Bot className="w-5 h-5 text-indigo-400" />
              <span>Hand Over to Autonomous LLM Agent (Antigravity)</span>
            </div>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              When you hand over, it means you can't or don't want to do it. The agent takes over responsibility,
              analyzes the problem, executes actions, and if waiting for a reply or external condition, sets an automated Checker to follow up or surface when ready.
            </p>

            <textarea
              autoFocus
              value={delegateNote}
              onChange={e => setDelegateNote(e.target.value)}
              placeholder="Add your note or guidance (e.g. 'Can't do this, please research pricing and if waiting for supplier email, set checker for 48h to follow up')..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 mb-3"
            />

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center space-x-2 shadow-lg shadow-indigo-500/25 transition"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Launch Autonomous Takeover</span>
              </button>
            </div>
          </form>
        )}

        {/* 4 Primary Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Action 1: Done */}
          <button
            onClick={handleDoneClick}
            disabled={isSubmitting}
            className="group flex items-center justify-center space-x-2 py-3.5 px-4 rounded-2xl bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:text-white font-semibold text-sm transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:text-white transition" />
            <span>Done</span>
          </button>

          {/* Action 2: Done with Note */}
          <button
            onClick={() => setActiveModal(activeModal === 'note' ? 'none' : 'note')}
            disabled={isSubmitting}
            className="group flex items-center justify-center space-x-2 py-3.5 px-4 rounded-2xl bg-teal-600/10 hover:bg-teal-600 border border-teal-500/30 hover:border-teal-500 text-teal-400 hover:text-white font-semibold text-sm transition-all shadow-lg hover:shadow-teal-500/20 active:scale-95"
          >
            <FileText className="w-4 h-4 text-teal-400 group-hover:text-white transition" />
            <span>Done with Note</span>
          </button>

          {/* Action 3: Postpone with Reason */}
          <button
            onClick={() => setActiveModal(activeModal === 'postpone' ? 'none' : 'postpone')}
            disabled={isSubmitting}
            className="group flex items-center justify-center space-x-2 py-3.5 px-4 rounded-2xl bg-amber-600/10 hover:bg-amber-600 border border-amber-500/30 hover:border-amber-500 text-amber-400 hover:text-white font-semibold text-sm transition-all shadow-lg hover:shadow-amber-500/20 active:scale-95"
          >
            <Clock className="w-4 h-4 text-amber-400 group-hover:text-white transition" />
            <span>Postpone</span>
          </button>

          {/* Action 4: Hand Over to LLM */}
          <button
            onClick={() => setActiveModal(activeModal === 'delegate' ? 'none' : 'delegate')}
            disabled={isSubmitting}
            className="group flex items-center justify-center space-x-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 border border-indigo-500/40 text-white font-bold text-sm transition-all shadow-xl hover:shadow-indigo-500/30 active:scale-95"
          >
            <Bot className="w-4 h-4 text-indigo-200 group-hover:rotate-12 transition" />
            <span>Hand Over to AI</span>
          </button>
        </div>
      </div>
    </div>
  );
};
