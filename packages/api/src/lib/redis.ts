import { Redis } from 'ioredis';
import { config } from '../config.js';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    if (!config.REDIS_URL) {
      throw new Error('REDIS_URL is not configured');
    }
    redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });

    redis.on('error', (err) => {
      console.error('❌ Redis connection error:', err.message);
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected');
    });
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
