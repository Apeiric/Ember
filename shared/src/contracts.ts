/**
 * EMBER — runtime validation at the API boundary.
 * OWNER: ALL THREE (add a field here whenever you add one to types.ts)
 *
 * Zod schemas guard POST /api/assess so a malformed request produces a clean
 * 400 with a readable message instead of a stack trace mid-demo.
 */

import { z } from 'zod';
import type { AssessRequest, UserProfile } from './types';

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const userProfileSchema = z.object({
  mobility: z.enum(['standard', 'vulnerable']).default('standard'),
  hasCar: z.boolean().default(true),
  householdSize: z.number().int().min(1).max(20).optional(),
  hasPets: z.boolean().optional(),
});

export const assessRequestSchema = z.object({
  address: z.string().trim().min(3, 'Enter a street address').max(300),
  profile: userProfileSchema.default({ mobility: 'standard', hasCar: true }),
  scenarioId: z.string().trim().min(1).max(80).optional(),
  forceOffline: z.boolean().optional(),
});

/** Parsed + defaulted request. Structurally identical to `AssessRequest`. */
export type ParsedAssessRequest = z.infer<typeof assessRequestSchema>;

// Compile-time proof that the schema and the hand-written type agree.
// If these ever diverge, TypeScript fails the build here rather than at runtime.
const _reqCheck: AssessRequest = {} as ParsedAssessRequest;
const _profCheck: UserProfile = {} as z.infer<typeof userProfileSchema>;
void _reqCheck;
void _profCheck;

export const DEFAULT_PROFILE: UserProfile = { mobility: 'standard', hasCar: true };
