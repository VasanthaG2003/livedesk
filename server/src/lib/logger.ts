import { pino } from 'pino'

export function createLogger(level: string, pretty: boolean) {
  return pino({
    level,
    // Never let credentials or tokens end up in logs.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.currentPassword',
        '*.newPassword',
        '*.passwordHash',
      ],
      censor: '[redacted]',
    },
    ...(pretty ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
  })
}

export type Logger = ReturnType<typeof createLogger>
