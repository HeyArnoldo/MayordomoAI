import type {
  AllocationInput,
  Box,
  BoxBalance,
  CreateBoxInput,
  CreateTransactionInput,
  ToolAudit,
  Transaction,
} from '@app/contracts';
import { api } from '@/lib/api';

export const boxesApi = {
  list: async (): Promise<Box[]> => (await api.get('/boxes')).data,
  balances: async (): Promise<BoxBalance[]> => (await api.get('/boxes/balances')).data,
  create: async (input: CreateBoxInput): Promise<Box> => (await api.post('/boxes', input)).data,
  updateAllocation: async (input: AllocationInput): Promise<Box[]> =>
    (await api.put('/boxes/allocation', input)).data,
};

export const transactionsApi = {
  list: async (params: Record<string, string | number | boolean> = {}): Promise<Transaction[]> =>
    (await api.get('/transactions', { params })).data,
  create: async (input: CreateTransactionInput): Promise<Transaction> =>
    (await api.post('/transactions', input)).data,
  void: async (id: string): Promise<Transaction> => (await api.delete(`/transactions/${id}`)).data,
};

export const agentApi = {
  audits: async (limit = 50): Promise<ToolAudit[]> =>
    (await api.get('/agent/audits', { params: { limit } })).data,
};
