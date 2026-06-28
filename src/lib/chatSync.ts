import type { ChatMessage, PrivateChatRoom } from '../types/platform';
import { loadJson, saveJson } from './storage';
import { mergeChatMessages, mergePrivateRooms, normalizeChatMessage } from './chatMerge';

const PUBLIC_KEY = 'ultt_meeting_chat';
const ROOMS_KEY = 'ultt_private_chat_rooms';
const API = '/api/chat';

export type ChatSyncMode = 'cloud' | 'local';

function loadLocalPublic(): ChatMessage[] {
  return (loadJson(PUBLIC_KEY, []) as ChatMessage[]).map(normalizeChatMessage);
}

function loadLocalRooms(): PrivateChatRoom[] {
  return (loadJson(ROOMS_KEY, []) as PrivateChatRoom[]).map((room) => ({
    ...room,
    messages: (room.messages ?? []).map(normalizeChatMessage),
  }));
}

export async function fetchChatState(): Promise<{
  public: ChatMessage[];
  rooms: PrivateChatRoom[];
  mode: ChatSyncMode;
}> {
  const localPublic = loadLocalPublic();
  const localRooms = loadLocalRooms();

  try {
    const res = await fetch(API, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('sync unavailable');

    const data = (await res.json()) as { public?: ChatMessage[]; rooms?: PrivateChatRoom[] };
    const mergedPublic = mergeChatMessages(localPublic, (data.public ?? []).map(normalizeChatMessage));
    const mergedRooms = mergePrivateRooms(localRooms, data.rooms ?? []);

    saveJson(PUBLIC_KEY, mergedPublic);
    saveJson(ROOMS_KEY, mergedRooms);

    return { public: mergedPublic, rooms: mergedRooms, mode: 'cloud' };
  } catch {
    return { public: localPublic, rooms: localRooms, mode: 'local' };
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function cacheChatState(publicMessages: ChatMessage[], rooms: PrivateChatRoom[]): void {
  saveJson(PUBLIC_KEY, publicMessages.slice(-50));
  saveJson(ROOMS_KEY, rooms);
}

export function pushChatState(
  publicMessages: ChatMessage[],
  rooms: PrivateChatRoom[],
  mode: ChatSyncMode,
): void {
  cacheChatState(publicMessages, rooms);
  if (mode !== 'cloud') return;

  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      await fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public: publicMessages.slice(-50),
          rooms,
        }),
      });
    } catch {
      /* keep local cache */
    }
  }, 400);
}
