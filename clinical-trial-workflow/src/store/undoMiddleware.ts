import { create } from 'zustand';
import { WorkflowTemplate } from '@/types';

const MAX_HISTORY = 100;

export interface TemporalStore {
  past: WorkflowTemplate[];
  future: WorkflowTemplate[];
  pushState: (state: WorkflowTemplate) => void;
  undo: (current: WorkflowTemplate) => WorkflowTemplate | null;
  redo: (current: WorkflowTemplate) => WorkflowTemplate | null;
  clear: () => void;
}

export const temporalStore = create<TemporalStore>((set, get) => ({
  past: [],
  future: [],

  pushState: (state: WorkflowTemplate) => {
    set((s) => {
      const past = [...s.past, state];
      if (past.length > MAX_HISTORY) {
        past.shift();
      }
      return { past, future: [] };
    });
  },

  undo: (current: WorkflowTemplate): WorkflowTemplate | null => {
    const { past } = get();
    if (past.length === 0) return null;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);

    set((s) => ({
      past: newPast,
      future: [current, ...s.future],
    }));

    return previous;
  },

  redo: (current: WorkflowTemplate): WorkflowTemplate | null => {
    const { future } = get();
    if (future.length === 0) return null;

    const next = future[0];
    const newFuture = future.slice(1);

    set((s) => ({
      past: [...s.past, current],
      future: newFuture,
    }));

    return next;
  },

  clear: () => {
    set({ past: [], future: [] });
  },
}));
