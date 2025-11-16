/**
 * CoinMetadataCache - Reactive class for caching coin metadata
 * Uses Svelte 5 runes for reactivity
 */

import type { CoinMetadata } from '$lib/utils/coinHelpers';
import { COIN_METADATA_CACHE_TTL } from '$lib/constants';
import { browser } from '$app/environment';

interface CacheEntry {
	data: CoinMetadata;
	timestamp: number;
}

const STORAGE_KEY_PREFIX = 'coin_metadata_';

/**
 * Reactive cache class for coin metadata
 */
export class CoinMetadataCache {
	// Private reactive state
	#cache = $state<Map<string, CacheEntry>>(new Map());
	#loading = $state<Set<string>>(new Set());
	#errors = $state<Map<string, string>>(new Map());

	// Public getters
	get cache() {
		return this.#cache;
	}

	get loading() {
		return this.#loading;
	}

	get errors() {
		return this.#errors;
	}

	// Derived values
	cacheSize = $derived(this.#cache.size);
	loadingCount = $derived(this.#loading.size);
	errorCount = $derived(this.#errors.size);

	constructor() {
		// Periodically clear expired entries
		if (browser) {
			setInterval(() => {
				this.clearExpired();
			}, 5 * 60 * 1000); // Every 5 minutes
		}
	}

	/**
	 * Gets metadata from cache (memory or local storage)
	 */
	get(coinType: string): CoinMetadata | null {
		// Check memory cache first
		const cached = this.#cache.get(coinType);
		if (cached) {
			// Check if expired
			if (Date.now() - cached.timestamp > COIN_METADATA_CACHE_TTL) {
				this.remove(coinType);
				return null;
			}
			return cached.data;
		}

		// Check local storage
		const stored = this.loadFromLocalStorage(coinType);
		if (stored) {
			// Add to memory cache
			this.#cache.set(coinType, stored);
			return stored.data;
		}

		return null;
	}

	/**
	 * Sets metadata in cache
	 */
	set(coinType: string, metadata: CoinMetadata): void {
		const entry: CacheEntry = {
			data: metadata,
			timestamp: Date.now()
		};

		this.#cache.set(coinType, entry);
		this.#errors.delete(coinType);

		// Save to local storage
		this.saveToLocalStorage(coinType, entry);
	}

	/**
	 * Removes metadata from cache
	 */
	remove(coinType: string): void {
		this.#cache.delete(coinType);
		this.#errors.delete(coinType);
		this.removeFromLocalStorage(coinType);
	}

	/**
	 * Sets loading state
	 */
	setLoading(coinType: string, isLoading: boolean): void {
		if (isLoading) {
			this.#loading.add(coinType);
		} else {
			this.#loading.delete(coinType);
		}
	}

	/**
	 * Checks if loading
	 */
	isLoading(coinType: string): boolean {
		return this.#loading.has(coinType);
	}

	/**
	 * Sets error
	 */
	setError(coinType: string, error: string): void {
		this.#errors.set(coinType, error);
		this.#loading.delete(coinType);
	}

	/**
	 * Gets error
	 */
	getError(coinType: string): string | null {
		return this.#errors.get(coinType) || null;
	}

	/**
	 * Clears error
	 */
	clearError(coinType: string): void {
		this.#errors.delete(coinType);
	}

	/**
	 * Clears all cached metadata
	 */
	clear(): void {
		this.#cache.clear();
		this.#loading.clear();
		this.#errors.clear();
		this.clearLocalStorage();
	}

	/**
	 * Invalidates cache for a coin type
	 */
	invalidate(coinType: string): void {
		this.remove(coinType);
	}

	/**
	 * Clears expired entries
	 */
	clearExpired(): void {
		const now = Date.now();
		const toRemove: string[] = [];

		this.#cache.forEach((entry, coinType) => {
			if (now - entry.timestamp > COIN_METADATA_CACHE_TTL) {
				toRemove.push(coinType);
			}
		});

		toRemove.forEach((coinType) => {
			this.#cache.delete(coinType);
			this.removeFromLocalStorage(coinType);
		});
	}

	/**
	 * Gets all cached coin types
	 */
	getCachedCoinTypes(): string[] {
		return Array.from(this.#cache.keys());
	}

	/**
	 * Gets cache statistics
	 */
	getStats() {
		return {
			cacheSize: this.cacheSize,
			loadingCount: this.loadingCount,
			errorCount: this.errorCount
		};
	}

	/**
	 * Fetches metadata with caching (stale-while-revalidate)
	 */
	async fetchWithCache(
		coinType: string,
		fetchFn: (coinType: string) => Promise<CoinMetadata>
	): Promise<CoinMetadata> {
		// Check cache first
		const cached = this.get(coinType);

		// If cached and not expired, return immediately
		if (cached) {
			const entry = this.#cache.get(coinType);
			// Optionally revalidate in background if stale
			if (entry && Date.now() - entry.timestamp > COIN_METADATA_CACHE_TTL / 2) {
				// Stale, revalidate in background
				fetchFn(coinType)
					.then((metadata) => {
						this.set(coinType, metadata);
					})
					.catch((error) => {
						console.error('Background revalidation failed:', error);
					});
			}
			return cached;
		}

		// Not in cache, fetch from blockchain
		this.setLoading(coinType, true);
		this.clearError(coinType);

		try {
			const metadata = await fetchFn(coinType);
			this.set(coinType, metadata);
			this.setLoading(coinType, false);
			return metadata;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.setError(coinType, errorMessage);
			this.setLoading(coinType, false);
			throw error;
		}
	}

	// Local storage helpers
	private loadFromLocalStorage(coinType: string): CacheEntry | null {
		if (!browser) return null;

		try {
			const key = `${STORAGE_KEY_PREFIX}${coinType}`;
			const stored = localStorage.getItem(key);

			if (!stored) return null;

			const entry: CacheEntry = JSON.parse(stored);

			// Check if expired
			if (Date.now() - entry.timestamp > COIN_METADATA_CACHE_TTL) {
				localStorage.removeItem(key);
				return null;
			}

			return entry;
		} catch (error) {
			console.error('Error loading from local storage:', error);
			return null;
		}
	}

	private saveToLocalStorage(coinType: string, entry: CacheEntry): void {
		if (!browser) return;

		try {
			const key = `${STORAGE_KEY_PREFIX}${coinType}`;
			localStorage.setItem(key, JSON.stringify(entry));
		} catch (error) {
			console.error('Error saving to local storage:', error);
		}
	}

	private removeFromLocalStorage(coinType: string): void {
		if (!browser) return;

		try {
			const key = `${STORAGE_KEY_PREFIX}${coinType}`;
			localStorage.removeItem(key);
		} catch (error) {
			console.error('Error removing from local storage:', error);
		}
	}

	private clearLocalStorage(): void {
		if (!browser) return;

		try {
			const keys = Object.keys(localStorage);
			keys.forEach((key) => {
				if (key.startsWith(STORAGE_KEY_PREFIX)) {
					localStorage.removeItem(key);
				}
			});
		} catch (error) {
			console.error('Error clearing local storage:', error);
		}
	}
}

// Global singleton instance
export const coinMetadataCache = new CoinMetadataCache();
