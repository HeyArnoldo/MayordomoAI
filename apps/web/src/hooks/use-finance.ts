import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AllocationInput, CreateBoxInput, CreateTransactionInput } from '@app/contracts';
import { agentApi, boxesApi, transactionsApi } from '@/services/finance.api';

export function useBoxBalances() {
  return useQuery({ queryKey: ['boxes', 'balances'], queryFn: boxesApi.balances });
}

export function useTransactions(params: Record<string, string | number | boolean> = {}) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => transactionsApi.list(params),
  });
}

/** Invalida saldos + movimientos juntos: cualquier escritura toca ambos. */
function useInvalidateFinance() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['boxes'] });
    void qc.invalidateQueries({ queryKey: ['transactions'] });
  };
}

export function useCreateTransaction() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (input: CreateTransactionInput) => transactionsApi.create(input),
    onSuccess: invalidate,
  });
}

export function useVoidTransaction() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (id: string) => transactionsApi.void(id),
    onSuccess: invalidate,
  });
}

export function useCreateBox() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (input: CreateBoxInput) => boxesApi.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateAllocation() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (input: AllocationInput) => boxesApi.updateAllocation(input),
    onSuccess: invalidate,
  });
}

export function useToolAudits() {
  return useQuery({
    queryKey: ['agent', 'audits'],
    queryFn: () => agentApi.audits(),
    refetchInterval: 15_000, // el trail se refresca mientras el agente trabaja
  });
}
