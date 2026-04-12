interface PresenterToolbarProps {
  currentIndex: number;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
  penActive: boolean;
  onTogglePen: () => void;
  laserActive: boolean;
  onToggleLaser: () => void;
  blackout: boolean;
  onToggleBlackout: () => void;
  onShowOverview: () => void;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: presenter toolbar
    // biome-ignore lint/a11y/noStaticElementInteractions: presenter toolbar
    <div
      className={`cursor-pointer rounded-full px-2 py-1 text-sm transition-colors ${
        active ? "bg-white/30 text-white" : "text-white/70 hover:text-white"
      }`}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      {children}
    </div>
  );
}

export function PresenterToolbar({
  currentIndex,
  totalSlides,
  onPrev,
  onNext,
  onExit,
  penActive,
  onTogglePen,
  laserActive,
  onToggleLaser,
  blackout,
  onToggleBlackout,
  onShowOverview,
}: PresenterToolbarProps) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-black/60 px-4 py-2 backdrop-blur-sm">
      <ToolbarButton onClick={onPrev} title="Previous slide (←)">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </ToolbarButton>

      <span className="min-w-[60px] text-center text-xs text-white/80">
        {currentIndex + 1} / {totalSlides}
      </span>

      <ToolbarButton onClick={onNext} title="Next slide (→)">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-white/30" />

      <ToolbarButton onClick={onTogglePen} active={penActive} title="Pen (P)">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={onToggleLaser}
        active={laserActive}
        title="Laser (L)"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={onToggleBlackout}
        active={blackout}
        title="Blackout (B)"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="2" y="2" width="20" height="20" rx="2" />
        </svg>
      </ToolbarButton>

      <ToolbarButton onClick={onShowOverview} title="Overview (G)">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-white/30" />

      <ToolbarButton onClick={onExit} title="Exit (Esc)">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </ToolbarButton>
    </div>
  );
}
