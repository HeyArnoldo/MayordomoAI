import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/services/chat.api';

const CONVERSATIONS_KEY = ['conversations'];

export function useConversations() {
  return useQuery({ queryKey: CONVERSATIONS_KEY, queryFn: chatApi.conversations });
}

export function useConversationMessages(id: string | null) {
  return useQuery({
    queryKey: ['conversations', id, 'messages'],
    queryFn: () => chatApi.messages(id!),
    enabled: Boolean(id),
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) => chatApi.create(title),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
  });
}

export function useRenameConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => chatApi.rename(id, title),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
  });
}

export function useTogglePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => chatApi.togglePin(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => chatApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
  });
}
