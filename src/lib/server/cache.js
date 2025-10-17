import { LRUCache } from 'lru-cache';
import { env } from '$env/dynamic/private';

let redis = null;
try {
	const redisUrl = env.UPSTASH_REDIS_REST_URL;
	const redisToken = env.UPSTASH_REDIS_REST_TOKEN;
	if (redisUrl && redisToken) {
		const { Redis } = await import('@upstash/redis');
		redis = new Redis({
			url: redisUrl,
			token: redisToken
		});
	}
} catch {}

const memory = new LRUCache({
	max: 1000
});

export async function cacheGetJSON(key) {
	if (redis) return await redis.get(key);
	return memory.get(key) ?? null;
}

export async function cacheSetJSON(key, value, ttlSeconds) {
	if (redis) {
		await redis.set(key, value, { ex: ttlSeconds });
	} else {
		memory.set(key, value, { ttl: ttlSeconds * 1000 });
	}
}

export async function cacheDel(key) {
	if (redis) await redis.del(key);
	memory.delete(key);
}

export const cache = { getJSON: cacheGetJSON, setJSON: cacheSetJSON, del: cacheDel };
