import { cn } from "@tokiomo/components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const TOTAL_COLS = 7;
const TOTAL_ROWS = 15;
const COL_LETTERS = "ABCDEFG";

export type Grid = string[][];

interface CellPos {
  row: number;
  col: number;
}

interface SpreadsheetGridProps {
  grid: Grid;
  onGridChange: (grid: Grid) => void;
}

export function createEmptyGrid(cols = TOTAL_COLS, rows = TOTAL_ROWS): Grid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ""),
  );
}

export function SpreadsheetGrid({ grid, onGridChange }: SpreadsheetGridProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<CellPos | null>(null);
  const [editingCell, setEditingCell] = useState<CellPos | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const rows = grid.length;
  const cols = grid[0]?.length ?? TOTAL_COLS;
  const colIndices = useMemo(
    () => Array.from({ length: cols }, (_, i) => i),
    [cols],
  );
  const rowIndices = useMemo(
    () => Array.from({ length: rows }, (_, i) => i),
    [rows],
  );

  const updateCell = useCallback(
    (row: number, col: number, value: string) => {
      const next = grid.map((r) => [...r]);
      while (next.length <= row)
        next.push(Array.from({ length: cols }, () => ""));
      while (next[row].length <= col) next[row].push("");
      next[row][col] = value;
      onGridChange(next);
    },
    [grid, cols, onGridChange],
  );

  const startEdit = useCallback(
    (row: number, col: number) => {
      setEditingCell({ row, col });
      setEditValue(grid[row]?.[col] ?? "");
    },
    [grid],
  );

  const commitEdit = useCallback(() => {
    if (editingCell) {
      updateCell(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
    }
  }, [editingCell, editValue, updateCell]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const moveSelection = useCallback(
    (dr: number, dc: number) => {
      setSelected((prev) => {
        if (!prev) return { row: 0, col: 0 };
        const nr = Math.max(0, Math.min(rows - 1, prev.row + dr));
        const nc = Math.max(0, Math.min(cols - 1, prev.col + dc));
        return { row: nr, col: nc };
      });
    },
    [rows, cols],
  );

  useEffect(() => {
    if (editingCell) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingCell]);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (editingCell) commitEdit();
      setSelected({ row, col });
    },
    [editingCell, commitEdit],
  );

  const handleCellDoubleClick = useCallback(
    (row: number, col: number) => {
      startEdit(row, col);
    },
    [startEdit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingCell) {
        if (e.key === "Escape") {
          e.preventDefault();
          cancelEdit();
        } else if (e.key === "Enter") {
          e.preventDefault();
          commitEdit();
          moveSelection(1, 0);
        } else if (e.key === "Tab") {
          e.preventDefault();
          commitEdit();
          moveSelection(0, e.shiftKey ? -1 : 1);
        }
        return;
      }

      if (!selected) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          moveSelection(-1, 0);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveSelection(1, 0);
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveSelection(0, -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveSelection(0, 1);
          break;
        case "Enter":
          e.preventDefault();
          startEdit(selected.row, selected.col);
          break;
        case "Tab":
          e.preventDefault();
          moveSelection(0, e.shiftKey ? -1 : 1);
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          updateCell(selected.row, selected.col, "");
          break;
        case "Escape":
          e.preventDefault();
          setSelected(null);
          break;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            startEdit(selected.row, selected.col);
            setEditValue(e.key);
          }
          break;
      }
    },
    [
      editingCell,
      selected,
      cancelEdit,
      commitEdit,
      moveSelection,
      startEdit,
      updateCell,
    ],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!selected) return;
      const text = e.clipboardData.getData("text/plain");
      if (!text) return;
      e.preventDefault();

      const pasteRows = text.split("\n").map((line) => line.split("\t"));
      const next = grid.map((r) => [...r]);

      for (let r = 0; r < pasteRows.length; r++) {
        const targetRow = selected.row + r;
        if (targetRow >= rows) break;
        for (let c = 0; c < pasteRows[r].length; c++) {
          const targetCol = selected.col + c;
          if (targetCol >= cols) break;
          next[targetRow][targetCol] = pasteRows[r][c].trim();
        }
      }

      onGridChange(next);
      if (editingCell) setEditingCell(null);
    },
    [selected, grid, rows, cols, onGridChange, editingCell],
  );

  const isHeaderRow = (row: number) => row === 0;
  const isLabelCol = (col: number) => col === 0;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: spreadsheet grid needs keyboard/paste
    <div
      ref={gridRef}
      className="overflow-auto rounded border border-neutral-200 dark:border-neutral-600"
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: grid must be focusable for keyboard nav
      tabIndex={0}
    >
      <table
        className="border-collapse select-none"
        style={{ tableLayout: "fixed" }}
      >
        <colgroup>
          <col style={{ width: 40 }} />
          {colIndices.map((ci) => (
            <col key={`cg-${ci}`} style={{ width: 88 }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {/* Top-left corner */}
            <th className="h-7 border-b border-r border-neutral-200 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-700" />
            {/* Column letters */}
            {colIndices.map((ci) => (
              <th
                key={`col-${ci}`}
                className="h-7 border-b border-r border-neutral-200 bg-[var(--accent-subtle)]/70 text-center text-xs font-medium text-neutral-500 dark:border-neutral-600 dark:bg-[var(--accent-subtle)] dark:text-neutral-400"
              >
                {COL_LETTERS[ci] ?? String.fromCharCode(65 + ci)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowIndices.map((ri) => (
            <tr key={`row-${ri}`}>
              {/* Row number */}
              <td className="h-7 border-b border-r border-neutral-200 bg-neutral-50 text-center text-xs text-neutral-400 dark:border-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-500">
                {ri + 1}
              </td>
              {/* Data cells */}
              {colIndices.map((ci) => {
                const isEditing =
                  editingCell?.row === ri && editingCell?.col === ci;
                const isSelected = selected?.row === ri && selected?.col === ci;
                const isA1 = ri === 0 && ci === 0;
                const cellValue = grid[ri]?.[ci] ?? "";

                return (
                  <td
                    key={`cell-${ri}-${ci}`}
                    className={cn(
                      "relative h-7 cursor-pointer border-b border-r border-neutral-200 px-1 text-xs dark:border-neutral-600",
                      isA1 && "bg-neutral-50 dark:bg-neutral-700/50",
                      isHeaderRow(ri) &&
                        !isA1 &&
                        "bg-amber-50/50 font-medium text-neutral-700 dark:bg-amber-900/10 dark:text-neutral-300",
                      isLabelCol(ci) &&
                        !isA1 &&
                        "bg-emerald-50/50 font-medium text-neutral-700 dark:bg-emerald-900/10 dark:text-neutral-300",
                      !isHeaderRow(ri) &&
                        !isLabelCol(ci) &&
                        "bg-white text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
                      isSelected &&
                        !isEditing &&
                        "ring-2 ring-inset ring-[var(--accent)]",
                    )}
                    onClick={() => handleCellClick(ri, ci)}
                    onDoubleClick={() => handleCellDoubleClick(ri, ci)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCellDoubleClick(ri, ci);
                    }}
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        className="absolute inset-0 z-10 border-none bg-white px-1 text-xs outline-none dark:bg-neutral-800 dark:text-neutral-100"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                      />
                    ) : (
                      <span className="block truncate">
                        {isA1
                          ? ""
                          : isHeaderRow(ri) && !cellValue
                            ? `${t("docs.series")} ${ci}`
                            : cellValue}
                      </span>
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
