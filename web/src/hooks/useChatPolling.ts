import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { ApiChatMessage, ChatMessage } from '../types';
import { toast } from 'sonner';

const MIN_POLL_MS = 3000;
const MAX_POLL_MS = 20000;

export function useChatPolling(partnerId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(true);
  const activeRef = useRef(true);
  const consecutiveFailures = useRef(0);
  const lastTimestampRef = useRef<number>(0);
  // Adaptive interval: an idle conversation does not need a database round trip every
  // 3s. Backs off towards MAX on each empty cycle and snaps back to MIN on activity.
  const idleDelayRef = useRef<number>(MIN_POLL_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * `createdAt` becomes a numeric timestamp here because the hook sorts messages and
   * uses the newest one as the `since` cursor for the next poll.
   */
  const toMessage = (raw: ApiChatMessage): ChatMessage => ({
    id: raw.id,
    senderId: raw.senderId,
    receiverId: raw.receiverId,
    text: raw.text,
    timestamp: new Date(raw.createdAt).getTime(),
  });

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

      const rawMessages: ApiChatMessage[] = Array.isArray(response.data) ? response.data : [];
      const newMessages: ChatMessage[] = rawMessages.map(toMessage);
      consecutiveFailures.current = 0; // reset failures on success

      if (newMessages.length > 0) {
        idleDelayRef.current = MIN_POLL_MS; // activity: back to the fast cadence
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

    idleDelayRef.current = MIN_POLL_MS;
    fetchMessages(true);

    // A hidden tab polls nothing. Polling used to keep running in the background,
    // holding the database awake and burning quota on a forgotten tab.
    const isVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

    const scheduleNext = () => {
      timerRef.current = setTimeout(async () => {
        if (activeRef.current && isVisible()) {
          const before = lastTimestampRef.current;
          await fetchMessages(false);
          if (lastTimestampRef.current === before) {
            // Empty cycle: relax the interval towards the ceiling.
            idleDelayRef.current = Math.min(idleDelayRef.current * 1.5, MAX_POLL_MS);
          }
        }
        scheduleNext();
      }, isVisible() ? idleDelayRef.current : MAX_POLL_MS);
    };

    const onVisibility = () => {
      if (isVisible()) {
        // Back on the tab: fetch immediately and resume the fast cadence.
        idleDelayRef.current = MIN_POLL_MS;
        if (activeRef.current) fetchMessages(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    scheduleNext();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
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

    // Sending is the strongest signal of an active conversation: reset to the fast
    // cadence so the reply is not stuck waiting at the backoff ceiling.
    idleDelayRef.current = MIN_POLL_MS;

    const tempId = `temp-${Date.now()}`;
    // An unguarded JSON.parse broke sending whenever the storage was corrupted.
    let senderId = 'me';
    try {
      const loggedInUser = window.sessionStorage.getItem('ojanuan_user');
      if (loggedInUser) senderId = JSON.parse(loggedInUser).id ?? 'me';
    } catch {
      // Keeps the placeholder: this only affects how the optimistic bubble aligns.
    }

    const optimisticMsg: ChatMessage = {
      id: tempId,
      senderId,
      receiverId: partnerId,
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const response = await api.post('/chat/messages', { receiverId: partnerId, text });
      const realMsg = toMessage(response.data);

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
