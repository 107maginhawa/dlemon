/**
 * AttentionQueue -- "Needs attention" rail (dashboard-home redesign).
 *
 * Renders the action items derived by buildAttentionItems. Each item is a
 * click-through to the relevant route (front-desk queue / billing). An empty
 * queue is a calm "All clear" rather than a dead empty box. Financial filtering
 * happens upstream in buildAttentionItems, so this component renders whatever
 * it is given.
 */

import React from 'react';
import type { AttentionItem, AttentionTone } from './morning-briefing.helpers';

export interface AttentionQueueProps {
  items: AttentionItem[];
  onSelect: (route: string) => void;
}

const TONE_DOT: Record<AttentionTone, string> = {
  info: 'bg-info',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

const TONE_COUNT: Record<AttentionTone, string> = {
  info: 'text-info-foreground',
  warning: 'text-warning-foreground',
  destructive: 'text-destructive-emphasis',
};

export function AttentionQueue({ items, onSelect }: AttentionQueueProps) {
  return (
    <div
      className="bg-background rounded-2xl shadow-sm p-5 flex flex-col gap-1"
      data-testid="attention-queue"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
          Needs attention
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">All clear — nothing needs you right now.</p>
      ) : (
        <div className="flex flex-col">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`attention-item-${item.id}`}
              onClick={() => onSelect(item.route)}
              className="flex items-center gap-2.5 py-2.5 border-b border-border last:border-b-0 text-left hover:bg-secondary/40 -mx-2 px-2 rounded-lg transition-colors"
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TONE_DOT[item.tone]}`} />
              <span className={`text-sm font-semibold tabular-nums ${TONE_COUNT[item.tone]}`}>
                {item.count}
              </span>
              <span className="text-sm text-muted-foreground truncate min-w-0">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
