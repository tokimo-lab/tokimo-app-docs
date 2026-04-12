import { useCallback, useSyncExternalStore } from "react";
import type {
  Slide,
  SlideBackground,
  SlideElement,
  SlidePresentation,
} from "./types";
import { createBlankSlide, createDefaultPresentation } from "./types";

const MAX_HISTORY = 50;

// ── State shape ─────────────────────────────────────────────
interface SlideState {
  presentation: SlidePresentation;
  currentSlideIndex: number;
  selectedElementIds: string[];
  history: SlidePresentation[];
  historyIndex: number;
}

// ── Actions (exposed on the hook return + static helpers) ───
interface SlideActions {
  setPresentation: (p: SlidePresentation) => void;
  setCurrentSlideIndex: (i: number) => void;
  addSlide: (index?: number) => void;
  deleteSlide: (index: number) => void;
  duplicateSlide: (index: number) => void;
  reorderSlide: (from: number, to: number) => void;
  updateSlideBackground: (bg: SlideBackground) => void;
  addElement: (element: SlideElement) => void;
  updateElement: (id: string, updates: Partial<SlideElement>) => void;
  deleteElements: (ids: string[]) => void;
  setSelectedElementIds: (ids: string[]) => void;
  updateSlideNotes: (notes: string) => void;
  applyLayout: (elements: SlideElement[]) => void;
  applyBackgroundToAll: (bg: SlideBackground) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  currentSlide: () => Slide | undefined;
}

export type SlideStore = SlideState & SlideActions;

// ── Minimal external store (zustand-compatible API) ─────────
type Listener = () => void;

let state: SlideState = {
  presentation: createDefaultPresentation(),
  currentSlideIndex: 0,
  selectedElementIds: [],
  history: [],
  historyIndex: -1,
};

const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function setState(partial: Partial<SlideState>) {
  state = { ...state, ...partial };
  emit();
}

function getState(): SlideStore {
  return { ...state, ...actions };
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ── Stable action functions ─────────────────────────────────
function pushHistory() {
  const trimmed = state.history.slice(0, state.historyIndex + 1);
  const snapshot: SlidePresentation = JSON.parse(
    JSON.stringify(state.presentation),
  );
  const newHistory = [...trimmed, snapshot].slice(-MAX_HISTORY);
  setState({ history: newHistory, historyIndex: newHistory.length - 1 });
}

const actions: SlideActions = {
  setPresentation: (p: SlidePresentation) =>
    setState({
      presentation: p,
      currentSlideIndex: 0,
      selectedElementIds: [],
    }),

  setCurrentSlideIndex: (i: number) =>
    setState({ currentSlideIndex: i, selectedElementIds: [] }),

  addSlide: (index?: number) => {
    pushHistory();
    const slides = [...state.presentation.slides];
    const insertAt = index !== undefined ? index + 1 : slides.length;
    slides.splice(insertAt, 0, createBlankSlide());
    setState({
      presentation: { ...state.presentation, slides },
      currentSlideIndex: insertAt,
      selectedElementIds: [],
    });
  },

  deleteSlide: (index: number) => {
    if (state.presentation.slides.length <= 1) return;
    pushHistory();
    const slides = state.presentation.slides.filter(
      (_: Slide, i: number) => i !== index,
    );
    const newIndex = Math.min(state.currentSlideIndex, slides.length - 1);
    setState({
      presentation: { ...state.presentation, slides },
      currentSlideIndex: newIndex,
      selectedElementIds: [],
    });
  },

  duplicateSlide: (index: number) => {
    pushHistory();
    const source = state.presentation.slides[index];
    if (!source) return;
    const dup: Slide = JSON.parse(JSON.stringify(source));
    dup.id = crypto.randomUUID();
    for (const el of dup.elements) {
      el.id = crypto.randomUUID();
    }
    const slides = [...state.presentation.slides];
    slides.splice(index + 1, 0, dup);
    setState({
      presentation: { ...state.presentation, slides },
      currentSlideIndex: index + 1,
      selectedElementIds: [],
    });
  },

  reorderSlide: (from: number, to: number) => {
    if (from === to) return;
    pushHistory();
    const slides = [...state.presentation.slides];
    const [moved] = slides.splice(from, 1);
    slides.splice(to, 0, moved);
    setState({
      presentation: { ...state.presentation, slides },
      currentSlideIndex: to,
    });
  },

  updateSlideBackground: (bg: SlideBackground) => {
    const idx = state.currentSlideIndex;
    pushHistory();
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx ? { ...s, background: bg } : s,
    );
    setState({ presentation: { ...state.presentation, slides } });
  },

  addElement: (element: SlideElement) => {
    const idx = state.currentSlideIndex;
    pushHistory();
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx ? { ...s, elements: [...s.elements, element] } : s,
    );
    setState({
      presentation: { ...state.presentation, slides },
      selectedElementIds: [element.id],
    });
  },

  updateElement: (id: string, updates: Partial<SlideElement>) => {
    const idx = state.currentSlideIndex;
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx
        ? {
            ...s,
            elements: s.elements.map((el: SlideElement) =>
              el.id === id ? ({ ...el, ...updates } as SlideElement) : el,
            ),
          }
        : s,
    );
    setState({ presentation: { ...state.presentation, slides } });
  },

  deleteElements: (ids: string[]) => {
    const idx = state.currentSlideIndex;
    pushHistory();
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx
        ? {
            ...s,
            elements: s.elements.filter(
              (el: SlideElement) => !ids.includes(el.id),
            ),
          }
        : s,
    );
    setState({
      presentation: { ...state.presentation, slides },
      selectedElementIds: [],
    });
  },

  setSelectedElementIds: (ids: string[]) =>
    setState({ selectedElementIds: ids }),

  updateSlideNotes: (notes: string) => {
    const idx = state.currentSlideIndex;
    pushHistory();
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx ? { ...s, notes } : s,
    );
    setState({ presentation: { ...state.presentation, slides } });
  },

  applyLayout: (elements: SlideElement[]) => {
    const idx = state.currentSlideIndex;
    pushHistory();
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx ? { ...s, elements } : s,
    );
    setState({
      presentation: { ...state.presentation, slides },
      selectedElementIds: [],
    });
  },

  applyBackgroundToAll: (bg: SlideBackground) => {
    pushHistory();
    const slides = state.presentation.slides.map((s: Slide) => ({
      ...s,
      background: bg,
    }));
    setState({ presentation: { ...state.presentation, slides } });
  },

  pushHistory,

  undo: () => {
    if (state.historyIndex < 0) return;
    const snapshot = state.history[state.historyIndex];
    setState({
      presentation: JSON.parse(JSON.stringify(snapshot)),
      historyIndex: state.historyIndex - 1,
      selectedElementIds: [],
    });
  },

  redo: () => {
    if (state.historyIndex >= state.history.length - 1) return;
    const nextIndex = state.historyIndex + 1;
    if (nextIndex < state.history.length) {
      setState({
        presentation: JSON.parse(JSON.stringify(state.history[nextIndex])),
        historyIndex: nextIndex,
        selectedElementIds: [],
      });
    }
  },

  currentSlide: () => {
    return state.presentation.slides[state.currentSlideIndex];
  },
};

// ── Public hook — selector-based (zustand-compatible API) ───
export function useSlideStore<T>(selector: (s: SlideStore) => T): T {
  const select = useCallback(
    () => selector({ ...state, ...actions }),
    [selector],
  );
  return useSyncExternalStore(subscribe, select);
}

// Static helpers used by SlideEditor and use-slide-collab
useSlideStore.subscribe = subscribe;
useSlideStore.getState = getState;
