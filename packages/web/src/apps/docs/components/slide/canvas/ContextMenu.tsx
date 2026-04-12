import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SlideElement } from "../types";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "../types";
import { useSlideStore } from "../use-slide-store";

interface ContextMenuProps {
  viewportRef: React.RefObject<HTMLDivElement | null>;
}

interface MenuPosition {
  x: number;
  y: number;
}

interface SubMenuState {
  label: string;
  items: MenuItem[];
  parentRect: DOMRect | null;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
  submenu?: MenuItem[];
}

let separatorCounter = 0;
function nextSepKey(): string {
  return `sep-${++separatorCounter}`;
}

export function ContextMenu({ viewportRef }: ContextMenuProps) {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [targetElementId, setTargetElementId] = useState<string | null>(null);
  const [subMenu, setSubMenu] = useState<SubMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const subMenuRef = useRef<HTMLDivElement>(null);

  const selectedIds = useSlideStore((s) => s.selectedElementIds);
  const setSelectedIds = useSlideStore((s) => s.setSelectedElementIds);
  const copyElements = useSlideStore((s) => s.copyElements);
  const pasteElements = useSlideStore((s) => s.pasteElements);
  const cutElements = useSlideStore((s) => s.cutElements);
  const deleteElements = useSlideStore((s) => s.deleteElements);
  const bringForward = useSlideStore((s) => s.bringForward);
  const sendBackward = useSlideStore((s) => s.sendBackward);
  const bringToFront = useSlideStore((s) => s.bringToFront);
  const sendToBack = useSlideStore((s) => s.sendToBack);
  const lockElement = useSlideStore((s) => s.lockElement);
  const unlockElement = useSlideStore((s) => s.unlockElement);
  const pushHistory = useSlideStore((s) => s.pushHistory);
  const updateElement = useSlideStore((s) => s.updateElement);
  const currentSlide = useSlideStore((s) => s.currentSlide);

  const close = useCallback(() => {
    setPosition(null);
    setTargetElementId(null);
    setSubMenu(null);
  }, []);

  // Listen for right-click on the viewport
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Find if we right-clicked on an element
      const target = e.target as HTMLElement;
      const elementDiv = target.closest("[data-element-id]");
      const elementId = elementDiv?.getAttribute("data-element-id") ?? null;

      if (elementId && !selectedIds.includes(elementId)) {
        setSelectedIds([elementId]);
      }

      setTargetElementId(elementId);
      setPosition({ x: e.clientX, y: e.clientY });
      setSubMenu(null);
    };

    viewport.addEventListener("contextmenu", handler);
    return () => viewport.removeEventListener("contextmenu", handler);
  }, [viewportRef, selectedIds, setSelectedIds]);

  // Close on click outside
  useEffect(() => {
    if (!position) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        subMenuRef.current &&
        !subMenuRef.current.contains(e.target as Node)
      ) {
        close();
      }
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !subMenuRef.current
      ) {
        close();
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [position, close]);

  // Close on scroll/resize
  useEffect(() => {
    if (!position) return;
    const handler = () => close();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [position, close]);

  const slide = currentSlide();
  const targetElement = slide?.elements.find(
    (el: SlideElement) => el.id === targetElementId,
  );
  const hasSelection = selectedIds.length > 0;
  const isLocked = targetElement?.lock ?? false;

  const alignElement = useCallback(
    (axis: "horizontal" | "vertical", position: "start" | "center" | "end") => {
      if (!targetElementId || !targetElement) return;
      if (targetElement.type === "line") return;
      pushHistory();
      let updates: Partial<SlideElement> = {};
      if (axis === "horizontal") {
        if (position === "start") updates = { left: 0 };
        else if (position === "center")
          updates = { left: (VIEWPORT_WIDTH - targetElement.width) / 2 };
        else updates = { left: VIEWPORT_WIDTH - targetElement.width };
      } else {
        if (position === "start") updates = { top: 0 };
        else if (position === "center")
          updates = { top: (VIEWPORT_HEIGHT - targetElement.height) / 2 };
        else updates = { top: VIEWPORT_HEIGHT - targetElement.height };
      }
      updateElement(targetElementId, updates);
    },
    [targetElementId, targetElement, pushHistory, updateElement],
  );

  const getElementMenuItems = useCallback((): MenuItem[] => {
    if (!targetElementId) return [];
    return [
      {
        label: "剪切",
        shortcut: "Ctrl+X",
        action: () => {
          cutElements();
          close();
        },
      },
      {
        label: "复制",
        shortcut: "Ctrl+C",
        action: () => {
          copyElements();
          close();
        },
      },
      {
        label: "粘贴",
        shortcut: "Ctrl+V",
        action: () => {
          pasteElements();
          close();
        },
      },
      { label: "", separator: true },
      {
        label: "水平居中",
        submenu: [
          {
            label: "左对齐",
            action: () => {
              alignElement("horizontal", "start");
              close();
            },
          },
          {
            label: "居中",
            action: () => {
              alignElement("horizontal", "center");
              close();
            },
          },
          {
            label: "右对齐",
            action: () => {
              alignElement("horizontal", "end");
              close();
            },
          },
        ],
      },
      {
        label: "垂直居中",
        submenu: [
          {
            label: "上对齐",
            action: () => {
              alignElement("vertical", "start");
              close();
            },
          },
          {
            label: "居中",
            action: () => {
              alignElement("vertical", "center");
              close();
            },
          },
          {
            label: "下对齐",
            action: () => {
              alignElement("vertical", "end");
              close();
            },
          },
        ],
      },
      { label: "", separator: true },
      {
        label: "置于顶层",
        submenu: [
          {
            label: "置顶",
            action: () => {
              bringToFront(targetElementId);
              close();
            },
          },
          {
            label: "上移一层",
            action: () => {
              bringForward(targetElementId);
              close();
            },
          },
        ],
      },
      {
        label: "置于底层",
        submenu: [
          {
            label: "置底",
            action: () => {
              sendToBack(targetElementId);
              close();
            },
          },
          {
            label: "下移一层",
            action: () => {
              sendBackward(targetElementId);
              close();
            },
          },
        ],
      },
      { label: "", separator: true },
      {
        label: "全选",
        shortcut: "Ctrl+A",
        action: () => {
          if (slide) {
            setSelectedIds(slide.elements.map((el: SlideElement) => el.id));
          }
          close();
        },
      },
      {
        label: isLocked ? "解锁" : "锁定",
        action: () => {
          if (isLocked) {
            unlockElement(targetElementId);
          } else {
            lockElement(targetElementId);
          }
          close();
        },
      },
      {
        label: "删除",
        shortcut: "Delete",
        action: () => {
          deleteElements(hasSelection ? selectedIds : [targetElementId]);
          close();
        },
      },
    ];
  }, [
    targetElementId,
    cutElements,
    copyElements,
    pasteElements,
    alignElement,
    bringToFront,
    bringForward,
    sendToBack,
    sendBackward,
    slide,
    setSelectedIds,
    isLocked,
    unlockElement,
    lockElement,
    deleteElements,
    hasSelection,
    selectedIds,
    close,
  ]);

  const getCanvasMenuItems = useCallback((): MenuItem[] => {
    return [
      {
        label: "粘贴",
        shortcut: "Ctrl+V",
        action: () => {
          pasteElements();
          close();
        },
      },
      { label: "", separator: true },
      {
        label: "全选",
        shortcut: "Ctrl+A",
        action: () => {
          if (slide) {
            setSelectedIds(slide.elements.map((el: SlideElement) => el.id));
          }
          close();
        },
      },
    ];
  }, [pasteElements, slide, setSelectedIds, close]);

  if (!position) return null;

  const items = targetElementId ? getElementMenuItems() : getCanvasMenuItems();

  const handleSubMenuEnter = (
    item: MenuItem,
    e: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (!item.submenu) {
      setSubMenu(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSubMenu({
      label: item.label,
      items: item.submenu,
      parentRect: rect,
    });
  };

  return createPortal(
    <>
      <div
        ref={menuRef}
        className="fixed z-[9999] min-w-[180px] rounded-lg bg-white py-1 shadow-lg dark:bg-neutral-800"
        style={{ left: position.x, top: position.y }}
      >
        {items.map((item) =>
          item.separator ? (
            <div
              key={nextSepKey()}
              className="my-1 h-px bg-neutral-200 dark:bg-neutral-700"
            />
          ) : (
            // biome-ignore lint/a11y/noStaticElementInteractions: context menu item
            <div
              key={item.label}
              className="flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (item.action) item.action();
              }}
              onMouseEnter={(e) => handleSubMenuEnter(item, e)}
            >
              <span>{item.label}</span>
              <span className="ml-6 text-xs text-neutral-400">
                {item.submenu ? "▸" : (item.shortcut ?? "")}
              </span>
            </div>
          ),
        )}
      </div>
      {subMenu?.parentRect && (
        <div
          ref={subMenuRef}
          className="fixed z-[10000] min-w-[120px] rounded-lg bg-white py-1 shadow-lg dark:bg-neutral-800"
          style={{
            left: subMenu.parentRect.right + 2,
            top: subMenu.parentRect.top,
          }}
        >
          {subMenu.items.map((item) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: submenu item
            <div
              key={item.label}
              className="flex cursor-pointer items-center px-3 py-1.5 text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (item.action) item.action();
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </>,
    document.body,
  );
}
