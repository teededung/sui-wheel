// App hooks
// Attach Prisma client to event.locals for server routes.
import { prisma } from '$lib/server/prisma';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.prisma = prisma;

	const response = await resolve(event);
	return response;
};

export async function handleClose() {
	await prisma.$disconnect();
}
