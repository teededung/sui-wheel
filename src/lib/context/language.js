import { setContext, getContext } from 'svelte';

// Unique key to avoid collisions
const LANGUAGE_CONTEXT_KEY = Symbol('language');

/**
 * Provide the language context to descendants.
 * Expected shape: { language: $state({ code: 'en' | 'vi' }), setLanguage?: (code: 'en'|'vi') => void }
 */
export function setLanguageContext(context) {
	setContext(LANGUAGE_CONTEXT_KEY, context);
}

/**
 * Retrieve the language context provided by an ancestor.
 */
export function getLanguageContext() {
	return getContext(LANGUAGE_CONTEXT_KEY);
}
