import { useCallback, useSyncExternalStore } from "react";
import type {
  Slide,
  SlideBackground,
  SlideElement,
  SlidePresentation,
} from "./types";
import {
  createBlankSlide,
  createDefaultPresentation,
  generateId,
} from "./types";

const MAX_HISTORY = 50;

// ── State shape ─────────────────────────────────────────────
interface SlideState {
  presentation: SlidePresentation;
  currentSlideIndex: number;
  selectedElementIds: string[];
  clipboard: SlideElement[];
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
  updateElements: (
    updates: Array<{ id: string; changes: Partial<SlideElement> }>,
  ) => void;
  deleteElements: (ids: string[]) => void;
  setSelectedElementIds: (ids: string[]) => void;
  updateSlideNotes: (notes: string) => void;
  applyLayout: (elements: SlideElement[]) => void;
  applyBackgroundToAll: (bg: SlideBackground) => void;
  copyElements: () => void;
  pasteElements: () => void;
  cutElements: () => void;
  duplicateElements: () => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  lockElement: (id: string) => void;
  unlockElement: (id: string) => void;
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
  clipboard: [],
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

  updateElements: (
    updates: Array<{ id: string; changes: Partial<SlideElement> }>,
  ) => {
    const idx = state.currentSlideIndex;
    const updateMap = new Map(updates.map((u) => [u.id, u.changes]));
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx
        ? {
            ...s,
            elements: s.elements.map((el: SlideElement) => {
              const changes = updateMap.get(el.id);
              return changes ? ({ ...el, ...changes } as SlideElement) : el;
            }),
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

  copyElements: () => {
    const slide = state.presentation.slides[state.currentSlideIndex];
    if (!slide) return;
    const selected = slide.elements.filter((el: SlideElement) =>
      state.selectedElementIds.includes(el.id),
    );
    if (selected.length > 0) {
      setState({
        clipboard: JSON.parse(JSON.stringify(selected)),
      });
    }
  },

  pasteElements: () => {
    if (state.clipboard.length === 0) return;
    pushHistory();
    const offset = 20;
    const newElements: SlideElement[] = state.clipboard.map(
      (el: SlideElement) => ({
        ...JSON.parse(JSON.stringify(el)),
        id: generateId(),
        left: el.left + offset,
        top: el.top + offset,
      }),
    );
    const idx = state.currentSlideIndex;
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx ? { ...s, elements: [...s.elements, ...newElements] } : s,
    );
    setState({
      presentation: { ...state.presentation, slides },
      selectedElementIds: newElements.map((el) => el.id),
    });
  },

  cutElements: () => {
    actions.copyElements();
    if (state.selectedElementIds.length > 0) {
      actions.deleteElements(state.selectedElementIds);
    }
  },

  duplicateElements: () => {
    actions.copyElements();
    actions.pasteElements();
  },

  bringForward: (id: string) => {
    const idx = state.currentSlideIndex;
    const slide = state.presentation.slides[idx];
    if (!slide) return;
    const elIdx = slide.elements.findIndex((el: SlideElement) => el.id === id);
    if (elIdx < 0 || elIdx >= slide.elements.length - 1) return;
    pushHistory();
    const elements = [...slide.elements];
    [elements[elIdx], elements[elIdx + 1]] = [
      elements[elIdx + 1],
      elements[elIdx],
    ];
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx ? { ...s, elements } : s,
    );
    setState({ presentation: { ...state.presentation, slides } });
  },

  sendBackward: (id: string) => {
    const idx = state.currentSlideIndex;
    const slide = state.presentation.slides[idx];
    if (!slide) return;
    const elIdx = slide.elements.findIndex((el: SlideElement) => el.id === id);
    if (elIdx <= 0) return;
    pushHistory();
    const elements = [...slide.elements];
    [elements[elIdx], elements[elIdx - 1]] = [
      elements[elIdx - 1],
      elements[elIdx],
    ];
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx ? { ...s, elements } : s,
    );
    setState({ presentation: { ...state.presentation, slides } });
  },

  bringToFront: (id: string) => {
    const idx = state.currentSlideIndex;
    const slide = state.presentation.slides[idx];
    if (!slide) return;
    const elIdx = slide.elements.findIndex((el: SlideElement) => el.id === id);
    if (elIdx < 0 || elIdx >= slide.elements.length - 1) return;
    pushHistory();
    const elements = slide.elements.filter((el: SlideElement) => el.id !== id);
    elements.push(slide.elements[elIdx]);
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx ? { ...s, elements } : s,
    );
    setState({ presentation: { ...state.presentation, slides } });
  },

  sendToBack: (id: string) => {
    const idx = state.currentSlideIndex;
    const slide = state.presentation.slides[idx];
    if (!slide) return;
    const elIdx = slide.elements.findIndex((el: SlideElement) => el.id === id);
    if (elIdx <= 0) return;
    pushHistory();
    const elements = slide.elements.filter((el: SlideElement) => el.id !== id);
    elements.unshift(slide.elements[elIdx]);
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx ? { ...s, elements } : s,
    );
    setState({ presentation: { ...state.presentation, slides } });
  },

  lockElement: (id: string) => {
    pushHistory();
    actions.updateElement(id, { lock: true });
  },

  unlockElement: (id: string) => {
    pushHistory();
    actions.updateElement(id, { lock: false });
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
