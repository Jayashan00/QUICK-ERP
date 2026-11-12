import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformService } from '@/features/platform/services/platformService';
import type { SupportStatus } from '@/features/support/types/support';

export const platformKeys = { foundation: ['platform', 'foundation'] as const, support: ['platform', 'support'] as const };
export function usePlatformFoundation() { return useQuery({ queryKey: platformKeys.foundation, queryFn: platformService.getFoundation }); }
export function usePlatformMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) { const client = useQueryClient(); return useMutation({ mutationFn, onSuccess: () => client.invalidateQueries({ queryKey: platformKeys.foundation }) }); }
export function usePlatformSupport() { const client = useQueryClient(); const refresh = () => { void client.invalidateQueries({ queryKey: platformKeys.support }); void client.invalidateQueries({ queryKey: platformKeys.foundation }); }; const mutation = useMutation({ mutationFn: ({ ticketId, status, assignee, reply }: { ticketId: string; status: SupportStatus; assignee?: string; reply?: string }) => platformService.updateSupport(ticketId, status, assignee, reply), onSuccess: refresh }); const remove = useMutation({ mutationFn: platformService.deleteSupport, onSuccess: refresh }); const query = useQuery({ queryKey: platformKeys.support, queryFn: platformService.listSupport }); return { ...query, update: mutation.mutateAsync, delete: remove.mutateAsync, isUpdating: mutation.isPending || remove.isPending }; }
