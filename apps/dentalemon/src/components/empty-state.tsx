import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center" role="status">
      {icon && <span className="text-4xl mb-4" aria-hidden="true">{icon}</span>}
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      {action && (
        <button type="button" onClick={action.onClick}
          className="mt-4 h-9 px-4 rounded-lg bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors focus:outline-none focus:ring-2 focus:ring-lemon-focus">
          {action.label}
        </button>
      )}
    </div>
  );
}
