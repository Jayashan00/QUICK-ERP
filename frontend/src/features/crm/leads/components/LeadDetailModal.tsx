import { useState, type ReactNode } from "react";

import { Button } from "@/shared/components/common/Button";
import { Modal } from "@/shared/components/common/Modal";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { ConfirmDialog } from "@/shared/components/feedback/ConfirmDialog";
import { getErrorMessage } from "@/shared/utils/errors";
import { appToast } from "@/shared/utils/toast";
import { useUserOptions } from '@/features/settings/users/hooks/useUserOptions';

import type { Lead } from '@/features/crm/leads/types/lead';
import type { LeadActivity } from '@/features/crm/leads/types/lead-activity';

import { LeadActivityFormModal } from "./LeadActivityFormModal";
import { LeadActivityTimeline } from "./LeadActivityTimeline";
import { LeadConversionModal } from "./LeadConversionModal";
import { useLeadActivities } from "../hooks/useLeadActivities";
import type { LeadConversionFormValues } from "../schemas/leadConversionSchema";

interface LeadDetailModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  canEdit?: boolean;
  canConvert?: boolean;
  canManageActivities?: boolean;
  canCreateOpportunity?: boolean;
  onCreateOpportunity?: (lead: Lead) => void;
  onConvert: (
    lead: Lead,
    data: LeadConversionFormValues,
  ) => Promise<void>;
}

function formatSource(
  source: Lead["source"],
) {
  return source
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function formatValue(value?: number) {
  if (value === undefined) {
    return "â€”";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    },
  ).format(value);
}

function formatDate(value?: string) {
  if (!value) {
    return "â€”";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "medium",
    },
  ).format(date);
}



function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-slate-500">
        {label}
      </div>

      <div className="text-sm font-medium text-slate-900">
        {value || "â€”"}
      </div>
    </div>
  );
}

export function LeadDetailModal({
  lead,
  isOpen,
  onClose,
  onEdit,
  onConvert,
  canEdit = true,
  canConvert = true,
  canManageActivities = true,
  canCreateOpportunity = false,
  onCreateOpportunity,
}: LeadDetailModalProps) {
  const { users } = useUserOptions({ includeInactive: true });
  const getAssignedUserName = (assignedTo?: string) => users.find(user => user.id === assignedTo)?.name || assignedTo || "Unassigned";
  const [
    isConversionOpen,
    setIsConversionOpen,
  ] = useState(false);

  const [
    isActivityFormOpen,
    setIsActivityFormOpen,
  ] = useState(false);

  const [
    deletingActivity,
    setDeletingActivity,
  ] = useState<LeadActivity | null>(
    null,
  );

  const {
    activities,
    isLoading,
    isError,
    refetch,
    createActivity,
    updateActivityStatus,
    deleteActivity,
    isUpdating,
    isDeleting,
  } = useLeadActivities(lead?.id);

  if (!lead) {
    return null;
  }

  const handleClose = () => {
    setIsConversionOpen(false);
    setIsActivityFormOpen(false);
    setDeletingActivity(null);
    onClose();
  };

  const handleEdit = () => {
    onEdit(lead);
  };

  const handleCompleteActivity = async (
    activity: LeadActivity,
  ) => {
    try {
      await updateActivityStatus(
        activity.id,
        "completed",
      );
      appToast.success("Activity marked as completed.");
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to update the activity. Please try again."));
    }
  };

  const handleConfirmDeleteActivity =
    async () => {
      if (!deletingActivity) {
        return;
      }

      try {
        await deleteActivity(
          deletingActivity.id,
        );

        setDeletingActivity(null);
        appToast.success("Activity deleted successfully.");
      } catch (error) {
        appToast.error(getErrorMessage(error, "Unable to delete the activity. Please try again."));
      }
    };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Lead Details"
        maxWidth="760px"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={handleClose}
            >
              Close
            </Button>

            {canConvert && lead.status === "qualified" && (
              <Button
                variant="secondary"
                onClick={() =>
                  setIsConversionOpen(true)
                }
              >
                Convert to Customer
              </Button>
            )}

            {canCreateOpportunity && onCreateOpportunity && (lead.status === "qualified" || lead.status === "converted") && (
              <Button variant="secondary" onClick={() => onCreateOpportunity(lead)}>
                Create Opportunity
              </Button>
            )}

            {canEdit && (
              <Button variant="primary" onClick={handleEdit}>
                Edit Lead
              </Button>
            )}
          </div>
        }
      >
        <div className="grid gap-6">
          {/* Lead Header */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  {lead.firstName}{" "}
                  {lead.lastName}
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  {lead.company ||
                    "Individual Lead"}
                </div>
              </div>

              <StatusBadge
                status={lead.status}
              />
            </div>
          </div>

          {/* Lead Information */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <DetailItem
              label="Lead Code"
              value={lead.code}
            />

            <DetailItem
              label="Source"
              value={formatSource(
                lead.source,
              )}
            />

            <DetailItem
              label="Email"
              value={lead.email}
            />

            <DetailItem
              label="Phone"
              value={lead.phone}
            />

            <DetailItem
              label="Estimated Value"
              value={formatValue(
                lead.estimatedValue,
              )}
            />

            <DetailItem
              label="Next Follow-up"
              value={formatDate(
                lead.nextFollowUpAt,
              )}
            />

            <DetailItem
              label="Assigned User"
              value={getAssignedUserName(
                lead.assignedTo,
              )}
            />
          </div>

          {lead.status === "converted" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="text-sm font-semibold text-emerald-900">
                Lead Converted
              </div>

              <div className="mt-1 text-xs text-emerald-800">
                Customer ID:{" "}
                {lead.convertedCustomerId ||
                  "Customer created"}
              </div>

              {lead.convertedAt && (
                <div className="mt-1 text-xs text-emerald-800">
                  Converted:{" "}
                  {new Date(
                    lead.convertedAt,
                  ).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {lead.status === "lost" && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
              <div className="text-sm font-semibold text-rose-900">Lead Lost</div>
              <div className="mt-1 text-xs text-rose-800">
                Reason: {lead.lostReason?.replace(/_/g, " ") || "Not recorded"}
              </div>
              {lead.lostNote && <div className="mt-2 whitespace-pre-wrap text-xs text-rose-800">{lead.lostNote}</div>}
            </div>
          )}

          {/* Notes */}
          <div>
            <div className="mb-2 text-xs font-medium text-slate-500">
              Notes
            </div>

            <div className="min-h-[70px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {lead.notes ||
                "No notes have been added."}
            </div>
          </div>

          {/* Activities */}
          <div className="border-t border-slate-200 pt-5">
            <LeadActivityTimeline
              activities={activities}
              isLoading={isLoading}
              isError={isError}
              onRetry={() => void refetch()}
              isUpdating={isUpdating}
              canManage={canManageActivities}
              onAdd={() =>
                setIsActivityFormOpen(
                  true,
                )
              }
              onComplete={
                handleCompleteActivity
              }
              onDelete={(activity) =>
                setDeletingActivity(
                  activity,
                )
              }
            />
          </div>
        </div>
      </Modal>

      {/* Add Activity */}
      {canManageActivities && <LeadActivityFormModal
        isOpen={isActivityFormOpen}
        onClose={() =>
          setIsActivityFormOpen(false)
        }
        onSubmit={async (data) => {
          await createActivity(data);
        }}
      />}

      {canConvert && <LeadConversionModal
        lead={lead}
        isOpen={isConversionOpen}
        onClose={() =>
          setIsConversionOpen(false)
        }
        onSubmit={async (data) => {
          await onConvert(
            lead,
            data,
          );
        }}
      />}

      {/* Delete Activity Confirmation */}
      {canManageActivities && <ConfirmDialog
        isOpen={Boolean(
          deletingActivity,
        )}
        title="Delete Activity"
        message="Are you sure you want to delete this lead activity? This action cannot be undone."
        variant="danger"
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={
          handleConfirmDeleteActivity
        }
        onCancel={() =>
          setDeletingActivity(null)
        }
      />}
    </>
  );
}
