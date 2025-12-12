import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function hasDatabaseUrl(): boolean {
	const url = process.env.DATABASE_URL;
	return typeof url === 'string' && url.trim().length > 0;
}

export function getPrisma(): PrismaClient | null {
	if (!hasDatabaseUrl()) return null;

	const client = globalForPrisma.prisma ?? new PrismaClient();
	if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client;
	return client;
}

export const prisma = getPrisma();
