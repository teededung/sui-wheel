import { getLanguageContext } from '$lib/context/language.js';
import { t } from '$lib/services/translation.js';

/**
 * Translation hook for Svelte components
 * @returns {function} Translation function bound to current language
 */
export function useTranslation() {
	const { language } = getLanguageContext();

	return (key, params = {}) => {
		return t(key, language.code, params);
	};
}
