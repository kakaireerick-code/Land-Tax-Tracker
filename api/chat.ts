import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import type { ChatMessage, PrivateChatRoom } from '../src/types/platform';
import { mergeChatMessages, mergePrivateRooms } from '../src/lib/chatMerge';

const PUBLIC_KEY = 'ultt:chat:public';
const ROOMS_KEY = 'ultt:chat:rooms';

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const redis = getRedis();
  if (!redis) {
    return res.status(503).json({ error: 'Chat sync not configured' });
  }

  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const [pub, rooms] = await Promise.all([
      redis.get<ChatMessage[]>(PUBLIC_KEY),
      redis.get<PrivateChatRoom[]>(ROOMS_KEY),
    ]);
    return res.status(200).json({
      public: pub ?? [],
      rooms: rooms ?? [],
    });
  }

  if (req.method === 'PUT') {
    const body = req.body as { public?: ChatMessage[]; rooms?: PrivateChatRoom[] };
    const [existingPub, existingRooms] = await Promise.all([
      redis.get<ChatMessage[]>(PUBLIC_KEY),
      redis.get<PrivateChatRoom[]>(ROOMS_KEY),
    ]);

    const mergedPublic = mergeChatMessages(existingPub ?? [], body.public ?? []);
    const mergedRooms = mergePrivateRooms(existingRooms ?? [], body.rooms ?? []);

    await Promise.all([
      redis.set(PUBLIC_KEY, mergedPublic),
      redis.set(ROOMS_KEY, mergedRooms),
    ]);

    return res.status(200).json({
      public: mergedPublic,
      rooms: mergedRooms,
    });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}
