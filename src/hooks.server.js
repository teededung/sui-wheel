// Prisma handle hooks
// The PrismaClient instance is initialized in `src/lib/server/prisma.js`,
// generated from the data model declared in `prisma/schema.prisma`.
// It is attached to `event.locals` so that it can be accessed in server
// load functions, actions, and API routes during the lifetime of a request.

export async function handle({ event, resolve }) {
	const response = await resolve(event);
	return response;
}

export async function handleClose() {}
