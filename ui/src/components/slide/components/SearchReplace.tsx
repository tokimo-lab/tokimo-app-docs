import {
  ChevronDown,
  ChevronUp,
  Replace,
  ReplaceAll,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSlideStore } from "../use-slide-store";

interface SearchMatch {
  slideIndex: number;
  elementId: string;
  startIndex: number;
  length: number;
}

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? "";
}

function replaceInHtml(
  html: string,
  searchStr: string,
  replaceStr: string,
  startIndex: number,
): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  let charCount = 0;
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? "";
    const nodeStart = charCount;
    const nodeEnd = charCount + text.length;
    if (startIndex >= nodeStart && startIndex < nodeEnd) {
      const offsetInNode = startIndex - nodeStart;
      node.textContent =
        text.slice(0, offsetInNode) +
        replaceStr +
        text.slice(offsetInNode + searchStr.length);
      break;
    }
    charCount = nodeEnd;
    node = walker.nextNode();
  }
  return div.innerHTML;
}

function findAllOccurrences(text: string, search: string): number[] {
  const indices: number[] = [];
  if (!search) return indices;
  const lower = text.toLowerCase();
  const searchLower = search.toLowerCase();
  let pos = 0;
  while (pos < lower.length) {
    const idx = lower.indexOf(searchLower, pos);
    if (idx === -1) break;
    indices.push(idx);
    pos = idx + 1;
  }
  return indices;
}

export function SearchReplace() {
  const [open, setOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const presentation = useSlideStore((s) => s.presentation);
  const setCurrentSlideIndex = useSlideStore((s) => s.setCurrentSlideIndex);
  const setSelectedElementIds = useSlideStore((s) => s.setSelectedElementIds);
  const updateElement = useSlideStore((s) => s.updateElement);
  const pushHistory = useSlideStore((s) => s.pushHistory);

  // Listen for custom event to open
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ replace: boolean }>).detail;
      setOpen(true);
      setShowReplace(detail.replace);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    };
    window.addEventListener("slide-search", handler);
    return () => window.removeEventListener("slide-search", handler);
  }, []);

  // Run search
  const runSearch = useCallback(
    (query: string) => {
      if (!query) {
        setMatches([]);
        setCurrentMatchIndex(0);
        return;
      }
      const found: SearchMatch[] = [];
      for (let si = 0; si < presentation.slides.length; si++) {
        const slide = presentation.slides[si];
        for (const el of slide.elements) {
          let plainText = "";
          if (el.type === "text") {
            plainText = stripHtml(el.content);
          } else if (el.type === "shape" && el.text) {
            plainText = stripHtml(el.text.content);
          }
          if (!plainText) continue;
          const indices = findAllOccurrences(plainText, query);
          for (const idx of indices) {
            found.push({
              slideIndex: si,
              elementId: el.id,
              startIndex: idx,
              length: query.length,
            });
          }
        }
      }
      setMatches(found);
      setCurrentMatchIndex(found.length > 0 ? 0 : 0);
    },
    [presentation.slides],
  );

  useEffect(() => {
    runSearch(searchText);
  }, [searchText, runSearch]);

  const navigateToMatch = useCallback(
    (index: number) => {
      if (matches.length === 0) return;
      const match = matches[index];
      setCurrentSlideIndex(match.slideIndex);
      setSelectedElementIds([match.elementId]);
    },
    [matches, setCurrentSlideIndex, setSelectedElementIds],
  );

  const handleNext = useCallback(() => {
    if (matches.length === 0) return;
    const next = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(next);
    navigateToMatch(next);
  }, [currentMatchIndex, matches.length, navigateToMatch]);

  const handlePrev = useCallback(() => {
    if (matches.length === 0) return;
    const prev = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prev);
    navigateToMatch(prev);
  }, [currentMatchIndex, matches.length, navigateToMatch]);

  const handleReplace = useCallback(() => {
    if (matches.length === 0) return;
    const match = matches[currentMatchIndex];
    if (!match) return;
    const slide = presentation.slides[match.slideIndex];
    const el = slide?.elements.find((e) => e.id === match.elementId);
    if (!el) return;

    pushHistory();
    if (el.type === "text") {
      const newContent = replaceInHtml(
        el.content,
        searchText,
        replaceText,
        match.startIndex,
      );
      updateElement(match.elementId, { content: newContent });
    } else if (el.type === "shape" && el.text) {
      const newContent = replaceInHtml(
        el.text.content,
        searchText,
        replaceText,
        match.startIndex,
      );
      updateElement(match.elementId, {
        text: { ...el.text, content: newContent },
      });
    }
    // Re-run after a tick for state to settle
    setTimeout(() => runSearch(searchText), 50);
  }, [
    matches,
    currentMatchIndex,
    presentation.slides,
    pushHistory,
    updateElement,
    searchText,
    replaceText,
    runSearch,
  ]);

  const handleReplaceAll = useCallback(() => {
    if (matches.length === 0) return;
    pushHistory();

    // Group by slide+element and process in reverse
    const sortedMatches = [...matches].sort((a, b) => {
      if (a.slideIndex !== b.slideIndex) return b.slideIndex - a.slideIndex;
      if (a.elementId !== b.elementId)
        return a.elementId < b.elementId ? 1 : -1;
      return b.startIndex - a.startIndex;
    });

    for (const match of sortedMatches) {
      const slide = presentation.slides[match.slideIndex];
      const el = slide?.elements.find((e) => e.id === match.elementId);
      if (!el) continue;
      if (el.type === "text") {
        const newContent = replaceInHtml(
          el.content,
          searchText,
          replaceText,
          match.startIndex,
        );
        updateElement(match.elementId, { content: newContent });
      } else if (el.type === "shape" && el.text) {
        const newContent = replaceInHtml(
          el.text.content,
          searchText,
          replaceText,
          match.startIndex,
        );
        updateElement(match.elementId, {
          text: { ...el.text, content: newContent },
        });
      }
    }
    setTimeout(() => runSearch(searchText), 50);
  }, [
    matches,
    pushHistory,
    presentation.slides,
    updateElement,
    searchText,
    replaceText,
    runSearch,
  ]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleNext();
      }
    },
    [handleNext],
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    setSearchText("");
    setReplaceText("");
    setMatches([]);
  }, []);

  if (!open) return null;

  return (
    <div className="absolute right-4 top-4 z-50 w-80 rounded-lg border border-border-subtle bg-white p-3 shadow-lg dark:bg-neutral-800">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Search size={14} />
          {showReplace ? "搜索替换" : "搜索"}
        </div>
        <div className="flex items-center gap-1">
          {!showReplace && (
            <button
              type="button"
              className="cursor-pointer rounded p-0.5 text-fg-muted hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => setShowReplace(true)}
              title="显示替换"
            >
              <Replace size={14} />
            </button>
          )}
          <button
            type="button"
            className="cursor-pointer rounded p-0.5 text-fg-muted hover:bg-black/5 dark:hover:bg-white/5"
            onClick={handleClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Search row */}
      <div className="mb-2 flex items-center gap-1">
        <input
          ref={searchInputRef}
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="搜索..."
          className="flex-1 rounded border border-border-subtle bg-transparent px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
        />
        <button
          type="button"
          className="cursor-pointer rounded p-1 hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/5"
          onClick={handlePrev}
          disabled={matches.length === 0}
          title="上一个"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          className="cursor-pointer rounded p-1 hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/5"
          onClick={handleNext}
          disabled={matches.length === 0}
          title="下一个"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Replace row */}
      {showReplace && (
        <div className="mb-2 flex items-center gap-1">
          <input
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="替换..."
            className="flex-1 rounded border border-border-subtle bg-transparent px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            className="cursor-pointer rounded p-1 hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/5"
            onClick={handleReplace}
            disabled={matches.length === 0}
            title="替换"
          >
            <Replace size={14} />
          </button>
          <button
            type="button"
            className="cursor-pointer rounded p-1 hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/5"
            onClick={handleReplaceAll}
            disabled={matches.length === 0}
            title="全部替换"
          >
            <ReplaceAll size={14} />
          </button>
        </div>
      )}

      {/* Match count */}
      <div className="text-[11px] text-fg-muted">
        {searchText
          ? matches.length > 0
            ? `${currentMatchIndex + 1} / ${matches.length} 个匹配`
            : "无匹配结果"
          : "输入搜索内容"}
      </div>
    </div>
  );
}
