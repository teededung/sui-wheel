import prismaPkg from '@prisma/client';

// Netlify Functions runtime may load `@prisma/client` as CommonJS; named ESM imports can crash.
// Use the default export and destructure to keep compatibility across runtimes.
const { PrismaClient } = prismaPkg;
type PrismaClientInstance = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientInstance | undefined };

function hasDatabaseUrl(): boolean {
	const url = process.env.DATABASE_URL;
	return typeof url === 'string' && url.trim().length > 0;
}

export function getPrisma(): PrismaClientInstance | null {
	if (!hasDatabaseUrl()) return null;

	const client = globalForPrisma.prisma ?? new PrismaClient();
	if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client;
	return client;
}

export const prisma = getPrisma();
