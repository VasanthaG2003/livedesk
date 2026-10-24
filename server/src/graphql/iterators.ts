/** Small async-iterator helpers for subscriptions. */

type Iter<T> = AsyncIterator<T> & Partial<AsyncIterable<T>>

/** Yields `first`, then everything from `inner`. */
export function startWith<T>(first: T, inner: Iter<T>): AsyncIterableIterator<T> {
  let sent = false
  return {
    next() {
      if (!sent) {
        sent = true
        return Promise.resolve({ value: first, done: false })
      }
      return inner.next()
    },
    return(value?: unknown) {
      return inner.return ? inner.return(value) : Promise.resolve({ value: undefined, done: true })
    },
    throw(error?: unknown) {
      return inner.throw ? inner.throw(error) : Promise.reject(error)
    },
    [Symbol.asyncIterator]() {
      return this
    },
  }
}

/**
 * Runs `cleanup` once when the subscription ends — the client unsubscribes or
 * the socket closes (graphql-ws calls return() in both cases).
 */
export function onEnd<T>(inner: Iter<T>, cleanup: () => void): AsyncIterableIterator<T> {
  let done = false
  const finish = () => {
    if (!done) {
      done = true
      cleanup()
    }
  }
  return {
    next: () => inner.next(),
    return(value?: unknown) {
      finish()
      return inner.return ? inner.return(value) : Promise.resolve({ value: undefined, done: true })
    },
    throw(error?: unknown) {
      finish()
      return inner.throw ? inner.throw(error) : Promise.reject(error)
    },
    [Symbol.asyncIterator]() {
      return this
    },
  }
}
