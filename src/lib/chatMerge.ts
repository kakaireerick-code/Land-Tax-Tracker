import type { ChatMessage, ChatMessageReaction, PrivateChatRoom } from '../types/platform';

export function normalizeChatMessage(m: ChatMessage): ChatMessage {
  return {
    ...m,
    pinned: m.pinned ?? false,
    reactions: m.reactions ?? [],
  };
}

function mergeReactions(
  a: ChatMessageReaction[] = [],
  b: ChatMessageReaction[] = [],
): ChatMessageReaction[] {
  const map = new Map<string, Set<string>>();
  for (const group of [...a, ...b]) {
    const users = map.get(group.emoji) ?? new Set<string>();
    group.users.forEach((u) => users.add(u));
    map.set(group.emoji, users);
  }
  return Array.from(map.entries()).map(([emoji, users]) => ({
    emoji: emoji as ChatMessageReaction['emoji'],
    users: Array.from(users),
  }));
}

export function mergeChatMessages(local: ChatMessage[], remote: ChatMessage[]): ChatMessage[] {
  const map = new Map<number, ChatMessage>();
  for (const raw of [...remote, ...local].map(normalizeChatMessage)) {
    const prev = map.get(raw.id);
    if (!prev) {
      map.set(raw.id, raw);
      continue;
    }
    map.set(raw.id, {
      ...prev,
      message: raw.message || prev.message,
      sender: raw.sender || prev.sender,
      timestamp: raw.timestamp || prev.timestamp,
      pinned: prev.pinned || raw.pinned,
      pinnedBy: raw.pinned ? raw.pinnedBy ?? prev.pinnedBy : prev.pinnedBy,
      reactions: mergeReactions(prev.reactions, raw.reactions),
    });
  }
  return Array.from(map.values())
    .sort((a, b) => a.id - b.id)
    .slice(-50);
}

export function mergePrivateRooms(local: PrivateChatRoom[], remote: PrivateChatRoom[]): PrivateChatRoom[] {
  const map = new Map<string, PrivateChatRoom>();
  for (const raw of [...remote, ...local]) {
    const prev = map.get(raw.id);
    if (!prev) {
      map.set(raw.id, {
        ...raw,
        messages: (raw.messages ?? []).map(normalizeChatMessage),
      });
      continue;
    }
    map.set(raw.id, {
      ...prev,
      name: raw.name || prev.name,
      createdBy: prev.createdBy || raw.createdBy,
      createdAt: prev.createdAt || raw.createdAt,
      members: [...new Set([...prev.members, ...raw.members])],
      messages: mergeChatMessages(prev.messages, raw.messages ?? []),
    });
  }
  return Array.from(map.values());
}
