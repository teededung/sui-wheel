// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			prisma: any;
			authedUser: any | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	
	interface Account {
		value: {
			address: string;
			chains: string[];
		};
	}
}

export {};
