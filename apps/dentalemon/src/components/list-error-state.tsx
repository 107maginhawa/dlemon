import React from 'react';

interface ListErrorStateProps {
  /** Concise, human-readable error message. */
  message?: string;
  /** Called when the user clicks Retry — wire to the query's refetch. */
  onRetry: () => void;
}

/**
 * Shared error UI for list / table surfaces (patients, scheduling, billing).
 *
 * Intentionally distinct from EmptyState so an API failure never looks like
 * "you have no data". Renders a concise message + a Retry button.
 */
export function ListErrorState({ message, onRetry }: ListErrorStateProps) {
  return (
    <div
      data-testid="list-error-state"
      role="alert"
      className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center"
    >
      <span className="text-3xl" aria-hidden="true">⚠️</span>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-foreground">Something went wrong</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {message || 'We couldn’t load this list. Please try again.'}
        </p>
      </div>
      <button
        type="button"
        data-testid="list-error-retry"
        onClick={onRetry}
        className="mt-1 h-9 px-4 rounded-lg bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors focus:outline-none focus:ring-2 focus:ring-[rgba(255,233,125,0.35)]"
      >
        Retry
      </button>
    </div>
  );
}
