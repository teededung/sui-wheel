import enTranslations from '../translations/en.json';
import viTranslations from '../translations/vi.json';

const translations = {
	en: enTranslations,
	vi: viTranslations
};

/**
 * Get translation by key path
 * @param {string} key - Dot notation key (e.g., 'common.loading')
 * @param {string} language - Language code ('en' | 'vi')
 * @param {object} params - Parameters for interpolation
 * @returns {string} Translated text
 */
export function t(key, language = 'en', params = {}) {
	const keys = key.split('.');
	let translation = translations[language];

	// Navigate through nested keys
	for (const k of keys) {
		if (translation && typeof translation === 'object') {
			translation = translation[k];
		} else {
			console.warn(`Translation key not found: ${key} for language: ${language}`);
			return key; // Return key as fallback
		}
	}

	if (typeof translation !== 'string' && !Array.isArray(translation)) {
		console.warn(`Translation value is not a string or array: ${key} for language: ${language}`);
		return key;
	}

	// Simple parameter interpolation (only for strings)
	if (typeof translation === 'string') {
		return translation.replace(/\{(\w+)\}/g, (match, paramKey) => {
			return params[paramKey] || match;
		});
	}

	// Return arrays as-is
	return translation;
}

/**
 * Get all translations for a language
 * @param {string} language - Language code
 * @returns {object} All translations for the language
 */
export function getTranslations(language = 'en') {
	return translations[language] || translations.en;
}
