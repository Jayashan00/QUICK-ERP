import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

import { useDebounce } from "@/shared/hooks/useDebounce";
import type { Customer } from '@/features/customers/types/customer';
import { useTenant } from "@/core/tenant/tenant-context";
import { useBranch } from "@/core/branch/branch-context";

import { customerKeys } from "../queries/customerKeys";
import {
  customerService,
  type GetCustomersParams,
} from "../services/customerService";

export function useCustomers(
  initialParams: GetCustomersParams = {},
) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  const scope = { tenantId: tenantId ?? "", branchId: branchId ?? "" };

  const [search, setSearch] = useState(
    initialParams.search ?? "",
  );

  const [status, setStatus] = useState(
    initialParams.status ?? "all",
  );

  const [type, setType] = useState(
    initialParams.type ?? "all",
  );

  const [page, setPage] = useState(
    initialParams.page ?? 1,
  );

  const [pageSize, setPageSize] = useState(
    initialParams.pageSize ?? 10,
  );

  const debouncedSearch = useDebounce(
    search,
    300,
  );

  const params: GetCustomersParams = {
    search: debouncedSearch,
    status,
    type,
    page,
    pageSize,
  };

  const customersQuery = useQuery({
    queryKey: customerKeys.list(scope, params),

    queryFn: () =>
      customerService.getCustomers(scope, params),

    placeholderData: keepPreviousData,
    enabled: Boolean(tenantId && branchId),
  });

  const createMutation = useMutation({
    mutationFn: (
      data: Omit<
        Customer,
        | "id"
        | "createdAt"
        | "updatedAt"
        | "tenantId"
        | "branchId"
      >,
    ) =>
      customerService.createCustomer(scope, data),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customerKeys.lists(),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Customer>;
    }) =>
      customerService.updateCustomer(
        scope,
        id,
        updates,
      ),

    onSuccess: async (customer) => {
      queryClient.setQueryData(
        customerKeys.detail(scope, customer.id),
        customer,
      );

      await queryClient.invalidateQueries({
        queryKey: customerKeys.lists(),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      customerService.deleteCustomer(scope, id),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customerKeys.lists(),
      });
    },
  });

  const createCustomer = (
    data: Omit<
      Customer,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "tenantId"
      | "branchId"
    >,
  ) => createMutation.mutateAsync(data);

  const updateCustomer = (
    id: string,
    updates: Partial<Customer>,
  ) =>
    updateMutation.mutateAsync({
      id,
      updates,
    });

  const deleteCustomer = (id: string) =>
    deleteMutation.mutateAsync(id);

  return {
    customers:
      customersQuery.data?.data ?? [],

    total:
      customersQuery.data?.total ?? 0,

    isLoading:
      customersQuery.isLoading,

    isFetching:
      customersQuery.isFetching,

    error: customersQuery.error
      ? "Failed to load customers"
      : null,

    search,
    setSearch,

    status,
    setStatus,

    type,
    setType,

    page,
    setPage,

    pageSize,
    setPageSize,

    refetch: customersQuery.refetch,

    createCustomer,
    updateCustomer,
    deleteCustomer,

    isCreating:
      createMutation.isPending,

    isUpdating:
      updateMutation.isPending,

    isDeleting:
      deleteMutation.isPending,
  };
}
