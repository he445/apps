/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { ChatMessage } from '../types';
import { toast } from 'sonner';

export function useChatPolling(partnerId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(true);
  const activeRef = useRef(true);
  const consecutiveFailures = useRef(0);
  const lastTimestampRef = useRef<number>(0);

  // Helper to normalize message format from NestJS or Express
  const normalizeMessage = (raw: any): ChatMessage => {
    const text = raw.text || raw.messageText || '';
    const ts = typeof raw.timestamp === 'number'
      ? raw.timestamp
      : raw.createdAt
        ? new Date(raw.createdAt).getTime()
        : Date.now();

    return {
      id: raw.id,
      senderId: raw.senderId,
      receiverId: raw.receiverId,
      text,
      timestamp: ts,
    };
  };

  // Synchronize messages
  const fetchMessages = async (isFirstLoad = false) => {
    if (!partnerId || !activeRef.current) return;

    try {
      const response = await api.get('/chat/messages/sync', {
        params: {
          partnerId,
          ...(lastTimestampRef.current > 0 ? { since: lastTimestampRef.current } : {}),
        },
      });

      const rawMessages: any[] = Array.isArray(response.data) ? response.data : [];
      const newMessages: ChatMessage[] = rawMessages.map(normalizeMessage);
      consecutiveFailures.current = 0; // reset failures on success

      if (newMessages.length > 0) {
        // Find the maximum timestamp in the batch to update our ref
        const maxTs = Math.max(...newMessages.map((m) => m.timestamp));
        lastTimestampRef.current = maxTs;

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const filteredNew = newMessages.filter((m) => !existingIds.has(m.id));
          return [...prev, ...filteredNew].sort((a, b) => a.timestamp - b.timestamp);
        });
      }
    } catch (err: any) {
      console.error('[Polling error]', err);
      consecutiveFailures.current += 1;
      
      // Stop polling after 5 consecutive failures to prevent API exhaustion
      if (consecutiveFailures.current >= 5) {
        activeRef.current = false;
        setActive(false);
        toast.error('Erro de conexão consecutiva. O chat foi pausado.');
      }
    } finally {
      if (isFirstLoad) setLoading(false);
    }
  };

  // Initial load and interval definition
  useEffect(() => {
    setMessages([]);
    lastTimestampRef.current = 0;
    consecutiveFailures.current = 0;
    activeRef.current = true;
    setActive(true);
    setLoading(true);

    if (!partnerId) {
      setLoading(false);
      return;
    }

    fetchMessages(true);

    const intervalId = setInterval(() => {
      if (activeRef.current) {
        fetchMessages(false);
      }
    }, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, [partnerId]);

  // Send message with optimistic update
  const sendMessage = async (text: string) => {
    if (!partnerId || !text.trim()) return;

    if (!activeRef.current) {
      activeRef.current = true;
      setActive(true);
      consecutiveFailures.current = 0;
    }

    const tempId = `temp-${Date.now()}`;
    const loggedInUser = window.sessionStorage.getItem('ojanuan_user');
    const senderId = loggedInUser ? JSON.parse(loggedInUser).id : 'me';

    const optimisticMsg: ChatMessage = {
      id: tempId,
      senderId,
      receiverId: partnerId,
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const response = await api.post('/chat/messages', {
        receiverId: partnerId,
        text,
        messageText: text,
      });

      const realMsg = normalizeMessage(response.data);

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? realMsg : m))
      );

      if (realMsg.timestamp > lastTimestampRef.current) {
        lastTimestampRef.current = realMsg.timestamp;
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Não foi possível enviar a mensagem. Verifique a conexão.');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  return {
    messages,
    loading,
    sendMessage,
    isPollingActive: active,
  };
}
