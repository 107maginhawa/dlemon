/**
 * ResizableDivider — drag handle between carousel and treatment table
 *
 * Props:
 *   onResize: (delta: number) => void — called with pixel delta on drag
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import React, { useState } from 'react';

interface ResizableDividerProps {
  onResize: (delta: number) => void;
}

export function ResizableDivider({ onResize }: ResizableDividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    setIsDragging(true);
    setStartY(e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    const delta = e.clientY - startY;
    setStartY(e.clientY);
    onResize(delta);
  }

  function handlePointerUp() {
    setIsDragging(false);
  }

  return (
    <div
      role="separator"
      aria-label="Drag to resize"
      className={[
        'h-2 relative flex items-center justify-center cursor-row-resize shrink-0',
        'bg-border/30 hover:bg-border/60 group transition-colors',
        isDragging ? 'bg-border/60' : '',
      ].join(' ')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="w-9 h-[5px] rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/50 transition-colors" />
    </div>
  );
}
