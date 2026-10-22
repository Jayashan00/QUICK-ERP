import {
  CalendarClock,
  Check,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import { Button } from "@/shared/components/common/Button";
import { IconButton } from "@/shared/components/common/IconButton";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { Skeleton } from "@/shared/components/feedback/Skeleton";

import type { LeadActivity } from '@/features/crm/leads/types/lead-activity';

interface LeadActivityTimelineProps {
  activities: LeadActivity[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  isUpdating?: boolean;
  canManage?: boolean;
  onAdd: () => void;
  onComplete: (
    activity: LeadActivity,
  ) => void;
  onDelete: (
    activity: LeadActivity,
  ) => void;
}

function getActivityIcon(
  type: LeadActivity["type"],
) {
  switch (type) {
    case "call":
      return <Phone size={16} />;

    case "email":
      return <Mail size={16} />;

    case "meeting":
      return <Users size={16} />;

    case "task":
      return (
        <CalendarClock size={16} />
      );

    case "note":
      return (
        <MessageSquare size={16} />
      );
  }
}

function formatType(
  type: LeadActivity["type"],
) {
  return (
    type.charAt(0).toUpperCase() +
    type.slice(1)
  );
}

function formatDate(
  value?: string,
) {
  if (!value) {
    return "No date scheduled";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(value));
}

export function LeadActivityTimeline({
  activities,
  isLoading,
  isError = false,
  onRetry,
  isUpdating = false,
  canManage = true,
  onAdd,
  onComplete,
  onDelete,
}: LeadActivityTimelineProps) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Activities & Follow-ups
          </div>

          <div className="mt-0.5 text-xs text-slate-500">
            Calls, emails, meetings,
            tasks and notes
          </div>
        </div>

        {canManage && (
          <Button variant="secondary" size="sm" leftIcon={<Plus size={14} />} onClick={onAdd}>
            Add Activity
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3" aria-label="Loading activities" role="status">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="rounded-lg border border-slate-200 p-4">
              <Skeleton height={18} />
              <div className="mt-3 max-w-xs">
                <Skeleton height={14} />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load activities"
          message="Lead activities could not be loaded. Please try again."
          onRetry={onRetry}
        />
      ) : activities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No activities have been
          recorded for this lead.
        </div>
      ) : (
        <div className="grid gap-3">
          {activities.map(
            (activity) => (
              <div key={activity.id} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[36px_minmax(0,1fr)_auto]">
                <div className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  {getActivityIcon(
                    activity.type,
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {activity.subject}
                    </span>

                    <span className="text-xs text-slate-500">
                      {formatType(
                        activity.type,
                      )}
                    </span>

                    <span className="text-xs capitalize text-slate-600">
                      {activity.status}
                    </span>
                  </div>

                  {activity.description && (
                    <div className="mt-1.5 text-xs text-slate-600">
                      {
                        activity.description
                      }
                    </div>
                  )}

                  <div className="mt-2 text-xs text-slate-500">
                    {formatDate(
                      activity.scheduledAt ??
                        activity.completedAt,
                    )}
                  </div>
                </div>

                <div className="col-start-2 flex items-start gap-1 sm:col-start-auto">
                  {canManage && activity.status ===
                    "planned" && (
                    <IconButton
                      type="button"
                      label="Mark activity completed"
                      disabled={isUpdating}
                      onClick={() =>
                        onComplete(
                          activity,
                        )
                      }
                      icon={<Check size={16} />}
                    />
                  )}

                  {canManage && (
                    <IconButton
                      type="button"
                      label="Delete activity"
                      onClick={() => onDelete(activity)}
                      icon={<Trash2 size={16} />}
                    />
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
