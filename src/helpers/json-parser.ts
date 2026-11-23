/** Deepest nesting of arrays/objects accepted in a response. */
export const MAX_JSON_DEPTH: number = 256;

/** Keys that change an object's prototype or reach it: removed from every parsed response. */
export const FORBIDDEN_KEYS: ReadonlySet<string> = new Set<string>([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

// The text can contain a forbidden key only if it contains one of these words or a \u escape (which can spell them).
const forbiddenKeyHintRegExp: RegExp = /__proto__|constructor|prototype|__(?:define|lookup)[GS]etter__|\\u/;

export class JsonDepthError extends Error {
  constructor() {
    super(`JSON nested deeper than ${MAX_JSON_DEPTH} levels`);
    this.name = 'JsonDepthError';
  }
}

/**
 * Nesting depth of a JSON text, counted on the raw text so a too deep document is refused before it is built.
 * Brackets inside strings don't count.
 */
function exceedsDepth(text: string, limit: number): boolean {
  let depth: number = 0;
  let inString: boolean = false;
  for (let i = 0; i < text.length; i = i + 1) {
    const code: number = text.charCodeAt(i);
    if (inString) {
      if (code === 92) {
        // backslash: skip the escaped character
        i = i + 1;
      } else if (code === 34) {
        inString = false;
      }
    } else if (code === 34) {
      inString = true;
    } else if (code === 123 || code === 91) {
      depth = depth + 1;
      if (depth > limit) {
        return true;
      }
    } else if (code === 125 || code === 93) {
      depth = depth - 1;
    }
  }
  return false;
}

/** Deletes forbidden keys at any depth with an explicit stack (no recursion, so no stack overflow). */
export function removeForbiddenKeys(value: unknown): void {
  if (value === null || typeof value !== 'object') {
    return;
  }
  const stack: object[] = [value as object];
  while (stack.length) {
    const current: any = stack.pop();
    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i = i + 1) {
        const item: unknown = current[i];
        if (item !== null && typeof item === 'object') {
          stack.push(item as object);
        }
      }
      continue;
    }
    for (const key of Object.keys(current)) {
      if (FORBIDDEN_KEYS.has(key)) {
        delete current[key];
        continue;
      }
      const item: unknown = current[key];
      if (item !== null && typeof item === 'object') {
        stack.push(item as object);
      }
    }
  }
}

/**
 * JSON.parse for untrusted input: refuses nesting deeper than MAX_JSON_DEPTH and drops keys that could reach
 * Object.prototype. A reviver would take V8 off its fast JSON path for every value, so the text is parsed plainly
 * and walked afterwards, and only when it can contain such a key.
 */
export function parseJson<T = unknown>(text: string): T {
  // a text this short can't be nested deeper than the limit
  if (text.length > MAX_JSON_DEPTH * 2 && exceedsDepth(text, MAX_JSON_DEPTH)) {
    throw new JsonDepthError();
  }
  const value: T = JSON.parse(text);
  if (forbiddenKeyHintRegExp.test(text)) {
    removeForbiddenKeys(value);
  }
  return value;
}
