import type { Conversation, Message } from '@app/contracts';
import { api } from '@/lib/api';

export const chatApi = {
  conversations: async (): Promise<Conversation[]> => (await api.get('/conversations')).data,
  create: async (title?: string): Promise<Conversation> =>
    (await api.post('/conversations', title ? { title } : {})).data,
  rename: async (id: string, title: string): Promise<Conversation> =>
    (await api.patch(`/conversations/${id}`, { title })).data,
  togglePin: async (id: string): Promise<Conversation> =>
    (await api.post(`/conversations/${id}/pin`)).data,
  remove: async (id: string): Promise<void> => {
    await api.delete(`/conversations/${id}`);
  },
  messages: async (id: string): Promise<Message[]> =>
    (await api.get(`/conversations/${id}/messages`)).data,
};
