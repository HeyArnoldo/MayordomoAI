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
  /** Nota de voz del mic → texto (el audio no se guarda). */
  transcribe: async (audio: Blob): Promise<string> => {
    const form = new FormData();
    form.append('audio', audio, 'voice.webm');
    const { data } = await api.post<{ text: string }>('/chat/transcribe', form);
    return data.text;
  },
};
