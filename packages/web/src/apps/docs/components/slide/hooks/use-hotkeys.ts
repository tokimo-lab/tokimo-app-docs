import { useEffect } from "react";
import type { Slide, SlideElement } from "../types";
import { useSlideStore } from "../use-slide-store";

export function useHotkeys(slide: Slide) {
  const selectedIds = useSlideStore((s) => s.selectedElementIds);
  const setSelectedIds = useSlideStore((s) => s.setSelectedElementIds);
  const deleteElements = useSlideStore((s) => s.deleteElements);
  const undo = useSlideStore((s) => s.undo);
  const redo = useSlideStore((s) => s.redo);
  const copyElements = useSlideStore((s) => s.copyElements);
  const pasteElements = useSlideStore((s) => s.pasteElements);
  const cutElements = useSlideStore((s) => s.cutElements);
  const duplicateElements = useSlideStore((s) => s.duplicateElements);
  const bringForward = useSlideStore((s) => s.bringForward);
  const sendBackward = useSlideStore((s) => s.sendBackward);
  const bringToFront = useSlideStore((s) => s.bringToFront);
  const sendToBack = useSlideStore((s) => s.sendToBack);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).contentEditable === "true") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const mod = e.metaKey || e.ctrlKey;

      // Delete / Backspace
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        deleteElements(selectedIds);
        return;
      }

      // Undo: Ctrl+Z
      if (e.key === "z" && mod && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.key === "z" && mod && e.shiftKey) || (e.key === "y" && mod)) {
        e.preventDefault();
        redo();
        return;
      }

      // Select All: Ctrl+A
      if (e.key === "a" && mod) {
        e.preventDefault();
        setSelectedIds(slide.elements.map((el: SlideElement) => el.id));
        return;
      }

      // Copy: Ctrl+C
      if (e.key === "c" && mod) {
        e.preventDefault();
        copyElements();
        return;
      }

      // Paste: Ctrl+V
      if (e.key === "v" && mod) {
        e.preventDefault();
        pasteElements();
        return;
      }

      // Cut: Ctrl+X
      if (e.key === "x" && mod) {
        e.preventDefault();
        cutElements();
        return;
      }

      // Duplicate: Ctrl+D
      if (e.key === "d" && mod) {
        e.preventDefault();
        duplicateElements();
        return;
      }

      // Layer ordering
      if (e.key === "ArrowUp" && mod && selectedIds.length === 1) {
        e.preventDefault();
        if (e.shiftKey) {
          bringToFront(selectedIds[0]);
        } else {
          bringForward(selectedIds[0]);
        }
        return;
      }
      if (e.key === "ArrowDown" && mod && selectedIds.length === 1) {
        e.preventDefault();
        if (e.shiftKey) {
          sendToBack(selectedIds[0]);
        } else {
          sendBackward(selectedIds[0]);
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    selectedIds,
    slide.elements,
    deleteElements,
    undo,
    redo,
    setSelectedIds,
    copyElements,
    pasteElements,
    cutElements,
    duplicateElements,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
  ]);
}
