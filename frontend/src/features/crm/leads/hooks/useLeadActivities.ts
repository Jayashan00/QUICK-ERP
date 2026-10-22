import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { LeadActivity } from '@/features/crm/leads/types/lead-activity';

import {
  leadActivityKeys,
} from "../queries/leadActivityKeys";

import {
  leadActivityService,
} from "../services/leadActivityService";

import type {
  LeadActivityFormValues,
} from "../schemas/leadActivitySchema";
import { useTenant } from "@/core/tenant/tenant-context";
import { useBranch } from "@/core/branch/branch-context";

export function useLeadActivities(
  leadId?: string,
) {
  const queryClient =
    useQueryClient();
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  const scope = {
    tenantId: tenantId ?? "",
    branchId: branchId ?? "",
  };

  const activitiesQuery =
    useQuery({
      queryKey:
        leadActivityKeys.byLead(
          scope,
          leadId ?? "",
        ),

      queryFn: () =>
        leadActivityService.getByLeadId(
          scope,
          leadId!,
        ),

      enabled: Boolean(leadId && tenantId && branchId),
    });

  const createMutation =
    useMutation({
      mutationFn: (
        data: LeadActivityFormValues,
      ) => {
        if (!leadId) {
          throw new Error(
            "Lead ID is required",
          );
        }

        return leadActivityService.create(
          scope,
          leadId,
          data,
        );
      },

      onSuccess: async () => {
        if (!leadId) {
          return;
        }

        await queryClient.invalidateQueries(
          {
            queryKey:
              leadActivityKeys.byLead(
                scope,
                leadId,
              ),
          },
        );
      },
    });

  const statusMutation =
    useMutation({
      mutationFn: ({
        id,
        status,
      }: {
        id: string;
        status:
          LeadActivity["status"];
      }) =>
        leadActivityService.updateStatus(
          scope,
          id,
          status,
        ),

      onSuccess: async () => {
        if (!leadId) {
          return;
        }

        await queryClient.invalidateQueries(
          {
            queryKey:
              leadActivityKeys.byLead(
                scope,
                leadId,
              ),
          },
        );
      },
    });

  const deleteMutation =
    useMutation({
      mutationFn: (id: string) =>
        leadActivityService.delete(scope, id),

      onSuccess: async () => {
        if (!leadId) {
          return;
        }

        await queryClient.invalidateQueries(
          {
            queryKey:
              leadActivityKeys.byLead(
                scope,
                leadId,
              ),
          },
        );
      },
    });

  return {
    activities:
      activitiesQuery.data ?? [],

    isLoading:
      activitiesQuery.isLoading,

    isError:
      activitiesQuery.isError,

    refetch:
      activitiesQuery.refetch,

    createActivity: (
      data: LeadActivityFormValues,
    ) =>
      createMutation.mutateAsync(
        data,
      ),

    updateActivityStatus: (
      id: string,
      status:
        LeadActivity["status"],
    ) =>
      statusMutation.mutateAsync({
        id,
        status,
      }),

    deleteActivity: (id: string) =>
      deleteMutation.mutateAsync(
        id,
      ),

    isCreating:
      createMutation.isPending,

    isUpdating:
      statusMutation.isPending,

    isDeleting:
      deleteMutation.isPending,
  };
}
