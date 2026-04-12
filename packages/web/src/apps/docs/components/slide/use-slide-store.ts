import { useCallback, useSyncExternalStore } from "react";
import type {
  ElementAnimation,
  Slide,
  SlideBackground,
  SlideElement,
  SlideElementBase,
  SlidePresentation,
  SlideTransition,
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
  formatPainterStyle: Record<string, unknown> | null;
  formatPainterMode: "off" | "single" | "persistent";
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
  groupElements: (ids: string[]) => void;
  ungroupElements: (groupId: string) => void;
  updateSlideTransition: (transition: SlideTransition) => void;
  applyTransitionToAll: (transition: SlideTransition) => void;
  addAnimation: (slideId: string, animation: ElementAnimation) => void;
  updateAnimation: (
    slideId: string,
    animationId: string,
    updates: Partial<ElementAnimation>,
  ) => void;
  deleteAnimation: (slideId: string, animationId: string) => void;
  reorderAnimations: (slideId: string, animationIds: string[]) => void;
  lockElement: (id: string) => void;
  unlockElement: (id: string) => void;
  alignElements: (
    ids: string[],
    alignment: "left" | "center" | "right" | "top" | "middle" | "bottom",
  ) => void;
  distributeElements: (
    ids: string[],
    direction: "horizontal" | "vertical",
  ) => void;
  matchElementSize: (
    ids: string[],
    dimension: "width" | "height" | "both",
  ) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  currentSlide: () => Slide | undefined;
  activateFormatPainter: (mode: "single" | "persistent") => void;
  applyFormatPainter: (targetId: string) => void;
  deactivateFormatPainter: () => void;
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
  formatPainterStyle: null,
  formatPainterMode: "off" as const,
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

  groupElements: (ids: string[]) => {
    if (ids.length < 2) return;
    pushHistory();
    const groupId = generateId();
    const idx = state.currentSlideIndex;
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx
        ? {
            ...s,
            elements: s.elements.map((el: SlideElement) =>
              ids.includes(el.id) ? ({ ...el, groupId } as SlideElement) : el,
            ),
          }
        : s,
    );
    setState({ presentation: { ...state.presentation, slides } });
  },

  ungroupElements: (groupId: string) => {
    pushHistory();
    const idx = state.currentSlideIndex;
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx
        ? {
            ...s,
            elements: s.elements.map((el: SlideElement) =>
              el.groupId === groupId
                ? ({ ...el, groupId: undefined } as SlideElement)
                : el,
            ),
          }
        : s,
    );
    setState({ presentation: { ...state.presentation, slides } });
  },

  updateSlideTransition: (transition: SlideTransition) => {
    const idx = state.currentSlideIndex;
    pushHistory();
    const slides = state.presentation.slides.map((s: Slide, i: number) =>
      i === idx ? { ...s, transition } : s,
    );
    setState({ presentation: { ...state.presentation, slides } });
  },

  applyTransitionToAll: (transition: SlideTransition) => {
    pushHistory();
    const slides = state.presentation.slides.map((s: Slide) => ({
      ...s,
      transition,
    }));
    setState({ presentation: { ...state.presentation, slides } });
  },

  addAnimation: (slideId: string, animation: ElementAnimation) => {
    pushHistory();
    const slides = state.presentation.slides.map((s: Slide) =>
      s.id === slideId
        ? { ...s, animations: [...(s.animations ?? []), animation] }
        : s,
    );
    setState({ presentation: { ...state.presentation, slides } });
  },

  updateAnimation: (
    slideId: string,
    animationId: string,
    updates: Partial<ElementAnimation>,
  ) => {
    const slides = state.presentation.slides.map((s: Slide) =>
      s.id === slideId
        ? {
            ...s,
            animations: (s.animations ?? []).map((a: ElementAnimation) =>
              a.id === animationId ? { ...a, ...updates } : a,
            ),
          }
        : s,
    );
    setState({ presentation: { ...state.presentation, slides } });
  },

  deleteAnimation: (slideId: string, animationId: string) => {
    pushHistory();
    const slides = state.presentation.slides.map((s: Slide) =>
      s.id === slideId
        ? {
            ...s,
            animations: (s.animations ?? []).filter(
              (a: ElementAnimation) => a.id !== animationId,
            ),
          }
        : s,
    );
    setState({ presentation: { ...state.presentation, slides } });
  },

  reorderAnimations: (slideId: string, animationIds: string[]) => {
    pushHistory();
    const slides = state.presentation.slides.map((s: Slide) => {
      if (s.id !== slideId) return s;
      const anims = s.animations ?? [];
      const reordered = animationIds
        .map((id, index) => {
          const anim = anims.find((a: ElementAnimation) => a.id === id);
          return anim ? { ...anim, order: index } : undefined;
        })
        .filter((a): a is ElementAnimation => a !== undefined);
      return { ...s, animations: reordered };
    });
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

  alignElements: (
    ids: string[],
    alignment: "left" | "center" | "right" | "top" | "middle" | "bottom",
  ) => {
    const slide = state.presentation.slides[state.currentSlideIndex];
    if (!slide || ids.length < 2) return;
    pushHistory();
    const elements = slide.elements.filter((el: SlideElement) =>
      ids.includes(el.id),
    );
    const updates: Array<{ id: string; changes: Partial<SlideElement> }> = [];
    const getH = (el: SlideElement) => (el.type === "line" ? 0 : el.height);

    switch (alignment) {
      case "left": {
        const min = Math.min(...elements.map((el) => el.left));
        for (const el of elements)
          if (el.left !== min)
            updates.push({ id: el.id, changes: { left: min } });
        break;
      }
      case "center": {
        const avg =
          elements.reduce((s, el) => s + el.left + el.width / 2, 0) /
          elements.length;
        for (const el of elements)
          updates.push({ id: el.id, changes: { left: avg - el.width / 2 } });
        break;
      }
      case "right": {
        const max = Math.max(...elements.map((el) => el.left + el.width));
        for (const el of elements)
          updates.push({ id: el.id, changes: { left: max - el.width } });
        break;
      }
      case "top": {
        const min = Math.min(...elements.map((el) => el.top));
        for (const el of elements)
          if (el.top !== min)
            updates.push({ id: el.id, changes: { top: min } });
        break;
      }
      case "middle": {
        const avg =
          elements.reduce((s, el) => s + el.top + getH(el) / 2, 0) /
          elements.length;
        for (const el of elements)
          updates.push({ id: el.id, changes: { top: avg - getH(el) / 2 } });
        break;
      }
      case "bottom": {
        const max = Math.max(...elements.map((el) => el.top + getH(el)));
        for (const el of elements)
          updates.push({ id: el.id, changes: { top: max - getH(el) } });
        break;
      }
    }
    if (updates.length > 0) actions.updateElements(updates);
  },

  distributeElements: (ids: string[], direction: "horizontal" | "vertical") => {
    const slide = state.presentation.slides[state.currentSlideIndex];
    if (!slide || ids.length < 3) return;
    pushHistory();
    const elements = slide.elements.filter((el: SlideElement) =>
      ids.includes(el.id),
    );
    const getH = (el: SlideElement) => (el.type === "line" ? 0 : el.height);

    if (direction === "horizontal") {
      const sorted = [...elements].sort((a, b) => a.left - b.left);
      const totalWidth = sorted.reduce((s, el) => s + el.width, 0);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = last.left + last.width - first.left;
      const gap = (totalSpan - totalWidth) / (sorted.length - 1);
      let x = first.left + first.width + gap;
      const updates: Array<{ id: string; changes: Partial<SlideElement> }> = [];
      for (let i = 1; i < sorted.length - 1; i++) {
        updates.push({ id: sorted[i].id, changes: { left: x } });
        x += sorted[i].width + gap;
      }
      if (updates.length > 0) actions.updateElements(updates);
    } else {
      const sorted = [...elements].sort((a, b) => a.top - b.top);
      const totalHeight = sorted.reduce((s, el) => s + getH(el), 0);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = last.top + getH(last) - first.top;
      const gap = (totalSpan - totalHeight) / (sorted.length - 1);
      let y = first.top + getH(first) + gap;
      const updates: Array<{ id: string; changes: Partial<SlideElement> }> = [];
      for (let i = 1; i < sorted.length - 1; i++) {
        updates.push({ id: sorted[i].id, changes: { top: y } });
        y += getH(sorted[i]) + gap;
      }
      if (updates.length > 0) actions.updateElements(updates);
    }
  },

  matchElementSize: (ids: string[], dimension: "width" | "height" | "both") => {
    const slide = state.presentation.slides[state.currentSlideIndex];
    if (!slide || ids.length < 2) return;
    pushHistory();
    const elements = slide.elements.filter((el: SlideElement) =>
      ids.includes(el.id),
    );
    const getH = (el: SlideElement) => (el.type === "line" ? 0 : el.height);
    const maxW = Math.max(...elements.map((el) => el.width));
    const maxH = Math.max(...elements.map((el) => getH(el)));
    const updates: Array<{ id: string; changes: Partial<SlideElement> }> = [];
    for (const el of elements) {
      if (el.type === "line") continue;
      const changes: Partial<Omit<SlideElementBase, "id">> = {};
      if ((dimension === "width" || dimension === "both") && el.width !== maxW)
        changes.width = maxW;
      if (
        (dimension === "height" || dimension === "both") &&
        el.height !== maxH
      )
        changes.height = maxH;
      if (Object.keys(changes).length > 0) updates.push({ id: el.id, changes });
    }
    if (updates.length > 0) actions.updateElements(updates);
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

  activateFormatPainter: (mode: "single" | "persistent") => {
    const slide = state.presentation.slides[state.currentSlideIndex];
    if (!slide) return;
    const firstId = state.selectedElementIds[0];
    if (!firstId) return;
    const el = slide.elements.find((e: SlideElement) => e.id === firstId);
    if (!el) return;

    let style: Record<string, unknown>;
    switch (el.type) {
      case "text":
        style = {
          type: "text",
          defaultFontName: el.defaultFontName,
          defaultColor: el.defaultColor,
          fill: el.fill,
          outline: el.outline,
          lineHeight: el.lineHeight,
          wordSpace: el.wordSpace,
          shadow: el.shadow,
        };
        break;
      case "image":
        style = {
          type: "image",
          outline: el.outline,
          shadow: el.shadow,
          radius: el.radius,
          opacity: el.opacity,
        };
        break;
      case "shape":
        style = {
          type: "shape",
          fill: el.fill,
          gradient: el.gradient,
          outline: el.outline,
          shadow: el.shadow,
          opacity: el.opacity,
        };
        break;
      case "line":
        style = {
          type: "line",
          color: el.color,
          style: el.style,
          strokeWidth: el.strokeWidth,
          points: el.points,
        };
        break;
      default:
        style = { type: el.type };
        break;
    }
    setState({ formatPainterStyle: style, formatPainterMode: mode });
  },

  applyFormatPainter: (targetId: string) => {
    const fps = state.formatPainterStyle;
    if (!fps) return;
    pushHistory();
    const slide = state.presentation.slides[state.currentSlideIndex];
    if (!slide) return;
    const target = slide.elements.find((e: SlideElement) => e.id === targetId);
    if (!target) return;

    const updates: Record<string, unknown> = {};
    const srcType = fps.type as string;

    if (target.type === "text") {
      if (srcType === "text") {
        if (fps.defaultFontName !== undefined)
          updates.defaultFontName = fps.defaultFontName;
        if (fps.defaultColor !== undefined)
          updates.defaultColor = fps.defaultColor;
        if (fps.fill !== undefined) updates.fill = fps.fill;
        if (fps.lineHeight !== undefined) updates.lineHeight = fps.lineHeight;
        if (fps.wordSpace !== undefined) updates.wordSpace = fps.wordSpace;
      }
      if (fps.outline !== undefined) updates.outline = fps.outline;
      if (fps.shadow !== undefined) updates.shadow = fps.shadow;
    } else if (target.type === "image") {
      if (fps.outline !== undefined) updates.outline = fps.outline;
      if (fps.shadow !== undefined) updates.shadow = fps.shadow;
      if (srcType === "image") {
        if (fps.radius !== undefined) updates.radius = fps.radius;
      }
      if (fps.opacity !== undefined) updates.opacity = fps.opacity;
    } else if (target.type === "shape") {
      if (srcType === "shape") {
        if (fps.fill !== undefined) updates.fill = fps.fill;
        if (fps.gradient !== undefined) updates.gradient = fps.gradient;
      }
      if (fps.outline !== undefined) updates.outline = fps.outline;
      if (fps.shadow !== undefined) updates.shadow = fps.shadow;
      if (fps.opacity !== undefined) updates.opacity = fps.opacity;
    } else if (target.type === "line") {
      if (srcType === "line") {
        if (fps.color !== undefined) updates.color = fps.color;
        if (fps.style !== undefined) updates.style = fps.style;
        if (fps.strokeWidth !== undefined)
          updates.strokeWidth = fps.strokeWidth;
        if (fps.points !== undefined) updates.points = fps.points;
      }
    }

    if (Object.keys(updates).length > 0) {
      actions.updateElement(targetId, updates as Partial<SlideElement>);
    }

    if (state.formatPainterMode === "single") {
      actions.deactivateFormatPainter();
    }
  },

  deactivateFormatPainter: () => {
    setState({ formatPainterStyle: null, formatPainterMode: "off" as const });
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
