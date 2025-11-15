import { z } from 'zod';

// Schema for URL search params
export const searchParamsSchema = z.object({
	wheelId: z.string().default('')
});
