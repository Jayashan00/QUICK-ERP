import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { Lead, LeadSource, LeadStatus } from '@/features/crm/leads/types/lead';
import { customerKeys } from "@/features/customers/queries/customerKeys";
import { useTenant } from "@/core/tenant/tenant-context";
import { useBranch } from "@/core/branch/branch-context";

import { leadKeys } from "../queries/leadKeys";
import type { LeadConversionFormValues } from "../schemas/leadConversionSchema";
import type { LeadFormValues } from "../schemas/leadSchema";
import { leadConversionService } from "../services/leadConversionService";
import { leadService } from "../services/leadService";

export function useLeads(initialSearch = "") {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  const scope = { tenantId: tenantId ?? "", branchId: branchId ?? "" };

  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState<
    LeadStatus | "all"
  >("all");
  const [source, setSource] = useState<
    LeadSource | "all"
  >("all");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState(10);

  const params = {
    search,
    status,
    source,
    page,
    pageSize,
  };

  const leadsQuery = useQuery({
    queryKey: leadKeys.list(scope, params),
    queryFn: () =>
      leadService.getAll(scope, params),
    enabled: Boolean(tenantId && branchId),
  });

  const createMutation = useMutation({
    mutationFn: (
      data: LeadFormValues,
    ) => leadService.create(scope, data),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: leadKeys.lists(),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: LeadFormValues;
    }) => leadService.update(scope, id, data),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: leadKeys.all,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      leadService.delete(scope, id),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: leadKeys.lists(),
      });
    },
  });

  const convertMutation = useMutation({
    mutationFn: ({
      lead,
      data,
    }: {
      lead: Lead;
      data: LeadConversionFormValues;
    }) =>
      leadConversionService.convertLead(
        scope,
        lead,
        data,
      ),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: leadKeys.all,
        }),

        queryClient.invalidateQueries({
          queryKey: customerKeys.all,
        }),
      ]);
    },
  });

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const updateStatus = (
    value: LeadStatus | "all",
  ) => {
    setStatus(value);
    setPage(1);
  };

  const updateSource = (
    value: LeadSource | "all",
  ) => {
    setSource(value);
    setPage(1);
  };

  const updatePageSize = (
    value: number,
  ) => {
    setPageSize(value);
    setPage(1);
  };

  return {
    leads: leadsQuery.data?.data ?? [],
    total: leadsQuery.data?.total ?? 0,

    isLoading: leadsQuery.isLoading,
    isError: leadsQuery.isError,
    error: leadsQuery.error,
    refetch: leadsQuery.refetch,

    search,
    setSearch: updateSearch,

    status,
    setStatus: updateStatus,

    source,
    setSource: updateSource,

    page,
    setPage,

    pageSize,
    setPageSize: updatePageSize,

    createLead: (
      data: LeadFormValues,
    ) => createMutation.mutateAsync(data),

    updateLead: (
      id: string,
      data: LeadFormValues,
    ) =>
      updateMutation.mutateAsync({
        id,
        data,
      }),

    deleteLead: (id: string) =>
      deleteMutation.mutateAsync(id),

    convertLead: (
      lead: Lead,
      data: LeadConversionFormValues,
    ) =>
      convertMutation.mutateAsync({
        lead,
        data,
      }),

    isCreating:
      createMutation.isPending,

    isUpdating:
      updateMutation.isPending,

    isDeleting:
      deleteMutation.isPending,

    isConverting:
      convertMutation.isPending,
  };
}
