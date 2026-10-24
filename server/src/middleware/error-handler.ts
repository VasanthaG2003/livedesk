import type { ErrorRequestHandler, RequestHandler } from 'express'
import type { ApiErrorBody } from '@livedesk/shared'
import { ZodError } from 'zod'
import { HttpError } from '../lib/http-error'

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiErrorBody = {
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  }
  res.status(404).json(body)
}

function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_'
    fields[key] ??= issue.message
  }
  return fields
}

/** Body-parser errors carry an HTTP status and a `type` string. */
function isBodyParserError(err: unknown): err is { status: number; type: string } {
  return typeof err === 'object' && err !== null && 'type' in err && 'status' in err
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500
  let body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  }

  if (err instanceof HttpError) {
    status = err.status
    body = { error: { code: err.code, message: err.message, fields: err.fields } }
  } else if (err instanceof ZodError) {
    status = 400
    body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some fields are invalid',
        fields: zodFields(err),
      },
    }
  } else if (isBodyParserError(err) && err.type === 'entity.parse.failed') {
    status = 400
    body = { error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } }
  } else if (isBodyParserError(err) && err.type === 'entity.too.large') {
    status = 413
    body = { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } }
  }

  if (status >= 500) {
    req.log.error({ err }, 'Unhandled error')
  }
  res.status(status).json(body)
}
