// version: 0.1

const saved_theme = localStorage.getItem('theme');
if (saved_theme) {
	document.documentElement.setAttribute('data-theme', saved_theme);
} else {
	const prefers_dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	const theme = prefers_dark ? 'dark' : 'light';
	document.documentElement.setAttribute('data-theme', theme);
	localStorage.setItem('theme', theme);
}
