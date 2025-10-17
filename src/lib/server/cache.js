import { LRUCache } from 'lru-cache';
import { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } from '$env/static/private';

let redis = null;
try {
	if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
		const { Redis } = await import('@upstash/redis');
		redis = new Redis({
			url: UPSTASH_REDIS_REST_URL,
			token: UPSTASH_REDIS_REST_TOKEN
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
