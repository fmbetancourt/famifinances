/**
 * Escapes all regex metacharacters in a user-supplied term so it can be used
 * literally in a MongoDB `$regex` query — preventing regex injection and ReDoS
 * (constitution Principle II).
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
