/**
 * ResizableDivider — drag handle between resizable panels
 *
 * Props:
 *   onResize: (delta: number) => void — called with pixel delta on drag
 *   direction?: 'x' | 'y' — axis to track; defaults to 'x' (horizontal)
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import React, { useState } from 'react';

interface ResizableDividerProps {
  onResize: (delta: number) => void;
  direction?: 'x' | 'y';
}

export function ResizableDivider({ onResize, direction = 'x' }: ResizableDividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState(0);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    setIsDragging(true);
    setStartPos(direction === 'y' ? e.clientY : e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    const current = direction === 'y' ? e.clientY : e.clientX;
    const delta = current - startPos;
    setStartPos(current);
    onResize(delta);
  }

  function handlePointerUp() {
    setIsDragging(false);
  }

  function handlePointerCancel() {
    setIsDragging(false);
  }

  return (
    <div
      role="separator"
      aria-label="Drag to resize"
      aria-orientation={direction === 'y' ? 'horizontal' : 'vertical'}
      className={[
        direction === 'y'
          ? 'h-2 w-full flex items-center justify-center cursor-row-resize'
          : 'w-2 relative flex items-center justify-center cursor-col-resize',
        'shrink-0 touch-none select-none bg-border/30 hover:bg-border/60 group transition-colors',
        isDragging ? 'bg-border/60' : '',
      ].join(' ')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div
        className={[
          direction === 'y' ? 'w-9 h-[5px]' : 'h-9 w-[5px]',
          'rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/50 transition-colors',
        ].join(' ')}
      />
    </div>
  );
}
