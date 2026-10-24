import { GraphQLError, type GraphQLFormattedError } from 'graphql'
import { unwrapResolverError } from '@apollo/server/errors'
import { ZodError } from 'zod'
import { HttpError } from '../lib/http-error'
import type { Logger } from '../lib/logger'

function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_'
    fields[key] ??= issue.message
  }
  return fields
}

/**
 * Turns thrown errors into a consistent shape:
 *   { message, extensions: { code, status, fields? } }
 * `status` is the HTTP-style status the error would have had (404, 409, …);
 * the response itself is HTTP 200, as usual for GraphQL.
 * Service errors (HttpError) keep their code and message, Zod validation
 * becomes BAD_USER_INPUT with per-field messages, and anything unexpected is
 * logged and hidden behind a generic message — never a stack trace.
 */
export function createFormatError(logger: Logger) {
  return (formatted: GraphQLFormattedError, error: unknown): GraphQLFormattedError => {
    const original = unwrapResolverError(error)

    if (original instanceof HttpError) {
      return {
        message: original.message,
        path: formatted.path,
        extensions: {
          code: original.code,
          status: original.status,
          ...(original.fields && { fields: original.fields }),
        },
      }
    }
    if (original instanceof ZodError) {
      return {
        message: 'Some fields are invalid',
        path: formatted.path,
        extensions: { code: 'BAD_USER_INPUT', status: 400, fields: zodFields(original) },
      }
    }
    // Errors we threw on purpose (auth checks) or GraphQL's own validation errors.
    const code = formatted.extensions?.code
    if (original instanceof GraphQLError || (code && code !== 'INTERNAL_SERVER_ERROR')) {
      const status =
        formatted.extensions?.status ??
        (code === 'GRAPHQL_VALIDATION_FAILED' || code === 'BAD_USER_INPUT' ? 400 : undefined)
      return {
        message: formatted.message,
        locations: formatted.locations,
        path: formatted.path,
        extensions: { code, ...(status !== undefined && { status }) },
      }
    }
    logger.error({ err: original }, 'Unhandled GraphQL error')
    return {
      message: 'Something went wrong. Please try again.',
      path: formatted.path,
      extensions: { code: 'INTERNAL_SERVER_ERROR', status: 500 },
    }
  }
}
