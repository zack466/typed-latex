// taken from https://deno.land/std@0.192.0/testing/asserts.ts
// <snippet>
export class AssertionError extends Error {
  override name = "AssertionError";
  constructor(message: string) {
    super(message);
  }
}

export function assert(expr: unknown, msg = ""): asserts expr {
  if (!expr) {
    throw new AssertionError(msg);
  }
}
// </snippet>

export type Maybe<T> = T | null

export function alphabetic(c: string) {
  assert(c.length == 1)
  return "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".includes(c[0])
}

export function whitespace(c: string) {
  return /^[^\S\r\n]+$/.test(c)
}

export type Enum = symbol | number | string

// returns the number of elements in a zero-indexed enum
export function enumSize<E extends Enum>(e: E) {
  return Object.values(e).length / 2
}

