/**
 * An error that is safe to show to the client. Anything thrown that is *not*
 * an HttpError is treated as an unexpected 500 and its details are hidden.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new HttpError(400, 'BAD_REQUEST', message, fields)
export const unauthorized = (message = 'Authentication required') =>
  new HttpError(401, 'UNAUTHORIZED', message)
export const forbidden = (message = 'You do not have permission to do that') =>
  new HttpError(403, 'FORBIDDEN', message)
export const notFound = (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message)
export const conflict = (message: string, code = 'CONFLICT') => new HttpError(409, code, message)
