import { useCallback, useEffect, useRef, useState } from "react";
import type { SlideTableElement, TableCell } from "../types";

interface TableElementProps {
  element: SlideTableElement;
  selected: boolean;
  onSelect: (id: string, append: boolean) => void;
  onUpdate: (id: string, updates: Partial<SlideTableElement>) => void;
}

export function TableElement({
  element,
  selected,
  onSelect,
  onUpdate,
}: TableElementProps) {
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidths = useRef<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(element.id, e.shiftKey);
    },
    [element.id, onSelect],
  );

  const handleCellClick = useCallback(
    (_row: number, _col: number, e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(element.id, false);
    },
    [element.id, onSelect],
  );

  const handleCellDoubleClick = useCallback(
    (row: number, col: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingCell({ row, col });
    },
    [],
  );

  const handleCellChange = useCallback(
    (row: number, col: number, content: string) => {
      const newData = element.data.map((r, ri) =>
        r.map((c, ci) => (ri === row && ci === col ? { ...c, content } : c)),
      );
      onUpdate(element.id, {
        data: newData,
      } as Partial<SlideTableElement>);
    },
    [element.id, element.data, onUpdate],
  );

  const handleCellBlur = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!editingCell) return;
      const { row, col } = editingCell;
      if (e.key === "Tab") {
        e.preventDefault();
        const nextCol = e.shiftKey ? col - 1 : col + 1;
        if (nextCol >= 0 && nextCol < element.cols) {
          setEditingCell({ row, col: nextCol });
        } else if (!e.shiftKey && row + 1 < element.rows) {
          setEditingCell({ row: row + 1, col: 0 });
        } else if (e.shiftKey && row - 1 >= 0) {
          setEditingCell({ row: row - 1, col: element.cols - 1 });
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (row + 1 < element.rows) {
          setEditingCell({ row: row + 1, col });
        } else {
          setEditingCell(null);
        }
      } else if (e.key === "Escape") {
        setEditingCell(null);
      }
    },
    [editingCell, element.rows, element.cols],
  );

  // Focus input when editing cell changes
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Column resize handlers
  const handleColResizeStart = useCallback(
    (colIndex: number, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setResizingCol(colIndex);
      resizeStartX.current = e.clientX;
      resizeStartWidths.current = [...element.colWidths];
    },
    [element.colWidths],
  );

  useEffect(() => {
    if (resizingCol === null) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStartX.current;
      const pctDelta = (dx / element.width) * 100;
      const newWidths = [...resizeStartWidths.current];
      const minWidth = 5;
      const newLeft = newWidths[resizingCol] + pctDelta;
      const newRight = newWidths[resizingCol + 1] - pctDelta;
      if (newLeft >= minWidth && newRight >= minWidth) {
        newWidths[resizingCol] = newLeft;
        newWidths[resizingCol + 1] = newRight;
        onUpdate(element.id, {
          colWidths: newWidths,
        } as Partial<SlideTableElement>);
      }
    };
    const onUp = () => setResizingCol(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingCol, element.id, element.width, onUpdate]);

  const { theme } = element;
  const borderColor = theme?.borderColor ?? "#d0d0d0";

  const getCellStyle = (
    cell: TableCell,
    rowIndex: number,
  ): React.CSSProperties => {
    const isHeader = rowIndex === 0;
    const isStriped = rowIndex > 0 && rowIndex % 2 === 0;
    return {
      backgroundColor:
        cell.style?.bgColor ??
        (isHeader
          ? (theme?.headerBg ?? "#4472C4")
          : isStriped
            ? (theme?.stripedBg ?? "transparent")
            : "transparent"),
      color:
        cell.style?.color ??
        (isHeader ? (theme?.headerColor ?? "#ffffff") : "inherit"),
      fontWeight: cell.style?.bold || isHeader ? "bold" : "normal",
      textAlign: cell.style?.align ?? (isHeader ? "center" : "left"),
      borderColor,
    };
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: slide element interaction
    <div
      data-element-id={element.id}
      className="absolute"
      style={{
        left: element.left,
        top: element.top,
        width: element.width,
        height: element.height,
        transform: `rotate(${element.rotate}deg)`,
        opacity: element.opacity ?? 1,
        outline: selected ? "2px solid #4A90D9" : undefined,
        outlineOffset: 2,
        cursor: editingCell ? "default" : "move",
      }}
      onMouseDown={handleMouseDown}
    >
      <table
        className="h-full w-full border-collapse"
        style={{ borderColor, fontSize: 12 }}
      >
        <colgroup>
          {element.colWidths.map((w, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable column indices
            <col key={i} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <tbody>
          {element.data.map((row, ri) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable row indices
            <tr key={ri}>
              {row.map((cell, ci) => {
                const cellKey = `${ri}-${ci}`;
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: table cell interaction
                  <td
                    key={cellKey}
                    className="relative border px-1.5 py-1"
                    style={getCellStyle(cell, ri)}
                    rowSpan={cell.rowSpan}
                    colSpan={cell.colSpan}
                    onClick={(e) => handleCellClick(ri, ci, e)}
                    onDoubleClick={(e) => handleCellDoubleClick(ri, ci, e)}
                  >
                    {editingCell?.row === ri && editingCell?.col === ci ? (
                      <input
                        ref={inputRef}
                        type="text"
                        className="w-full bg-transparent outline-none"
                        style={{
                          color: "inherit",
                          fontWeight: "inherit",
                          textAlign: "inherit",
                        }}
                        value={cell.content}
                        onChange={(e) =>
                          handleCellChange(ri, ci, e.target.value)
                        }
                        onBlur={handleCellBlur}
                        onKeyDown={handleCellKeyDown}
                      />
                    ) : (
                      <span className="block truncate">
                        {cell.content || "\u00A0"}
                      </span>
                    )}
                    {/* Column resize handle */}
                    {ci < element.cols - 1 && (
                      // biome-ignore lint/a11y/noStaticElementInteractions: resize handle
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize"
                        style={{
                          transform: "translateX(50%)",
                          zIndex: 1,
                        }}
                        onMouseDown={(e) => handleColResizeStart(ci, e)}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
