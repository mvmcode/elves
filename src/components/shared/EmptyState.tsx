/* Empty state display — shows a fun message when there's nothing to see. */

interface EmptyStateProps {
  readonly message: string;
  readonly submessage?: string;
}

/**
 * Centered empty state with oversized text per neo-brutalist typography rules.
 * Used when project list is empty, no active session, etc.
 */
export function EmptyState({
  message,
  submessage,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <p className="text-center font-display text-2xl font-bold text-text-light/40">
        {message}
      </p>
      {submessage ? (
        <p className="text-center font-body text-sm text-text-light/30">
          {submessage}
        </p>
      ) : null}
    </div>
  );
}
