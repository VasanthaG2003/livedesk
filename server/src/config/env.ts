import { z } from 'zod'

const secret = z.string().min(32, 'must be at least 32 characters')

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    MONGODB_URI: z.string().min(1),
    CLIENT_ORIGINS: z
      .string()
      .min(1)
      .transform((v) =>
        v
          .split(',')
          .map((o) => o.trim().replace(/\/$/, ''))
          .filter(Boolean),
      ),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    JWT_ACCESS_SECRET: secret,
    JWT_SOCKET_SECRET: secret,
    // Optional. Without a key the AI assist features are switched off.
    // Hosting dashboards often send an unset variable as "", so treat that as absent.
    ANTHROPIC_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
    AI_MODEL: z.string().min(1).default('claude-opus-5-5'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .refine((e) => e.NODE_ENV === 'development' || e.MONGODB_URI !== 'memory', {
    path: ['MONGODB_URI'],
    error: '"memory" is only allowed in development',
  })
  .refine((e) => e.JWT_ACCESS_SECRET !== e.JWT_SOCKET_SECRET, {
    path: ['JWT_SOCKET_SECRET'],
    error: 'must differ from JWT_ACCESS_SECRET',
  })

export type Env = z.infer<typeof envSchema>

/** Parses process.env and exits with a readable message if anything is missing or invalid. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    // The logger isn't configured yet, so write straight to stderr.
    console.error(`Invalid environment configuration:\n${problems.join('\n')}`)
    console.error('See server/.env.example for the expected variables.')
    process.exit(1)
  }
  return result.data
}
