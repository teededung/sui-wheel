import { getContext, setContext } from 'svelte';

// Unique key to avoid collisions in Svelte context
const LANGUAGE_CONTEXT_KEY = Symbol('language');

export type LanguageCode = 'en' | 'vi';

// We only rely on `language.code` and an optional setter today
export interface LanguageContext {
	language: { code: LanguageCode };
	setLanguage?: (code: LanguageCode) => void;
}

/**
 * Provide the language context to descendants.
 */
export function setLanguageContext(context: LanguageContext): void {
	setContext<LanguageContext>(LANGUAGE_CONTEXT_KEY, context);
}

/**
 * Retrieve the language context provided by an ancestor.
 */
export function getLanguageContext(): LanguageContext {
	const context = getContext<LanguageContext>(LANGUAGE_CONTEXT_KEY);
	if (!context) {
		throw new Error('Language context has not been set');
	}
	return context;
}
