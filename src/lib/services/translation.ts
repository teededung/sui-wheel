import enTranslations from '../translations/en.json';
import viTranslations from '../translations/vi.json';

export type LanguageCode = 'en' | 'vi';

// Use the JSON shape of the English file as the canonical translation tree type.
// This matches the real data structure (nested objects, arrays, etc.)
export type TranslationTree = typeof enTranslations;

// Relax the leaf type – translations can be strings, arrays, or structured objects
// and we don't want this to over-constrain consumers.
export type TranslationLeaf = any;

const translations: Record<LanguageCode, TranslationTree> = {
	en: enTranslations,
	vi: viTranslations
};

export type TranslationParams = Record<string, string | number>;

/**
 * Get translation by key path, e.g. 'common.loading'.
 */
export function t(
	key: string,
	language: LanguageCode = 'en',
	params: TranslationParams = {}
): TranslationLeaf {
	const keys = key.split('.');
	let translation: unknown = translations[language];

	for (const k of keys) {
		if (translation && typeof translation === 'object' && !Array.isArray(translation)) {
			translation = (translation as Record<string, unknown>)[k];
		} else {
			console.warn(`Translation key not found: ${key} for language: ${language}`);
			return key;
		}
	}

	if (typeof translation === 'string') {
		return translation.replace(/\{(\w+)\}/g, (match, paramKey) => {
			const value = params[paramKey];
			return value !== undefined ? String(value) : match;
		});
	}

	// Arrays are returned as-is
	return translation;
}

/**
 * Get all translations for a language.
 */
export function getTranslations(language: LanguageCode = 'en'): TranslationTree {
	return translations[language] ?? translations.en;
}
