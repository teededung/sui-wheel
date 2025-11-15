import { getLanguageContext } from '$lib/context/language';
import { t, type TranslationParams } from '$lib/services/translation';

export type TranslateFunction = (key: string, params?: TranslationParams) => any;

/**
 * Translation hook for Svelte components.
 * Returns a function bound to the current language.
 */
export function useTranslation(): TranslateFunction {
	const { language } = getLanguageContext();

	return (key: string, params: TranslationParams = {}): any => {
		return t(key, language.code, params);
	};
}
