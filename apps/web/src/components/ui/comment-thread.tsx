import React from 'react';
import { api } from '../../lib/api-client';
import { Skeleton } from './skeleton';
import { cn, timeAgo } from '../../lib/utils';
import { Send } from 'lucide-react';
import type { Comment, CommentEntityType } from '../../lib/types';

// ─── Props ──────────────────────────────────────────────────────────────────

interface CommentThreadProps {
  entityType: CommentEntityType;
  entityId: string;
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CommentThread({ entityType, entityId, className }: CommentThreadProps) {
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [newComment, setNewComment] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // ── Fetch comments ──────────────────────────────────────────────────────

  const fetchComments = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await api.get<Comment[]>('/collab/comments', {
        entityType,
        entityId,
      });
      setComments(data);
    } catch (err) {
      console.warn('[CommentThread] Failed to load comments:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  React.useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // ── Submit comment ──────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const created = await api.post<Comment>('/collab/comments', {
        entityType,
        entityId,
        content: trimmed,
      });
      setComments((prev) => [...prev, created]);
      setNewComment('');
    } catch (err) {
      console.warn('[CommentThread] Failed to post comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Comments</p>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state — hide gracefully ───────────────────────────────────────

  if (error) {
    return null;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Comments
          {comments.length > 0 && (
            <span className="ml-1 text-gray-400 dark:text-gray-500">({comments.length})</span>
          )}
        </p>
      </div>

      {/* Comment list */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            No comments yet
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="flex gap-2.5 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/40"
            >
              {/* Avatar */}
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kenya-green-100 text-xs font-semibold text-kenya-green-700 dark:bg-kenya-green-900/40 dark:text-kenya-green-300"
                aria-hidden="true"
              >
                {getInitials(comment.author.name)}
              </div>

              {/* Body */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-kenya-green-900 dark:text-kenya-green-50">
                    {comment.author.name}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {timeAgo(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Comment input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Type a comment..."
          disabled={submitting}
          className={cn(
            'flex-1 rounded-lg border border-kenya-green-200 bg-white px-3 py-2 text-sm',
            'placeholder:text-gray-400 dark:border-kenya-green-700 dark:bg-kenya-surface-dark dark:text-kenya-green-50',
            'focus:outline-none focus:ring-2 focus:ring-kenya-green-500/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'touch-target min-h-[44px]',
          )}
          aria-label="New comment"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || submitting}
          className={cn(
            'flex items-center justify-center rounded-lg px-3 transition-colors',
            'touch-target min-h-[44px] min-w-[44px]',
            newComment.trim() && !submitting
              ? 'bg-kenya-green-500 text-white hover:bg-kenya-green-600'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed',
          )}
          aria-label="Send comment"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
