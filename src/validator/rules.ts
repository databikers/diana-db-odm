/**
 * Dependency-free validation rules covering what DianaDB used joi for.
 *
 * The rules follow joi 18 semantics with { convert: true, allowUnknown: false, abortEarly: true }, so the same
 * input is accepted or rejected as before. Each schema is compiled once into a closure; validating a value walks
 * plain functions without allocating anything on success (a copy is made only when a nested value is converted).
 *
 * Conversions (convert: true):
 *  - number:  numeric strings ("12", " 1.5 ", "1e3") become numbers; strings that lose precision are rejected;
 *  - boolean: "true" / "false" (any case, trimmed) become booleans;
 *  - binary:  strings and { type: 'Buffer', data } become Buffers.
 */

export const INVALID: unique symbol = Symbol('invalid');

type Presence = 'optional' | 'required' | 'forbidden';

type Check = (value: any, ctx: Context, parent: any) => any;

export type ValidationResult<T = any> = {
  value: T;
  error?: ValidationError;
};

export class ValidationError extends Error {
  public readonly path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = 'ValidationError';
    this.path = path;
  }
}

export class Context {
  public path: (string | number)[] = [];
  public message: string = '';
  public errorPath: string = '';
  // joi code of the first failure ("number.base", "any.only", ...), the path depth it happened at and,
  // for "any.only", the allowed values: used to word the error of alternatives the way joi does
  public code: string = '';
  public depth: number = 0;
  public valids: any[] = [];

  public label(): string {
    if (!this.path.length) {
      return 'value';
    }
    let label: string = '';
    for (const part of this.path) {
      label = typeof part === 'number' ? `${label}[${part}]` : label ? `${label}.${part}` : part;
    }
    return label;
  }

  public fail(template: string, code: string, valids?: any[]): typeof INVALID {
    if (!this.message) {
      this.errorPath = this.label();
      this.message = `"${this.errorPath}" ${template}`;
      this.code = code;
      this.depth = this.path.length;
      this.valids = valids || [];
    }
    return INVALID;
  }

  /** Takes over the error of a nested attempt. */
  public adopt(other: Context): typeof INVALID {
    if (!this.message) {
      this.message = other.message;
      this.errorPath = other.errorPath;
      this.code = other.code;
      this.depth = other.depth;
      this.valids = other.valids;
    }
    return INVALID;
  }
}

export type WhenOptions = {
  is?: any;
  not?: any;
  then?: Rule;
  otherwise?: Rule;
};

type When = {
  ref: string;
  is: any;
  negate: boolean;
  then?: Rule;
  otherwise?: Rule;
};

const numberRx: RegExp = /^\s*[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:e([+-]?\d+))?\s*$/i;

function extractSignificantDigits(value: string): string {
  return value
    .replace(/[eE][+-]?\d+$/, '')
    .replace(/\./, '')
    .replace(/0+$/, '')
    .replace(/^[+-]?(0*)?/, '');
}

function normalizeDecimal(str: string): string {
  str = str
    .replace(/^\+/, '')
    .replace(/\.0*$/, '')
    .replace(/^(-?)\.([^.]*)$/, '$10.$2')
    .replace(/^(-?)0+([0-9])/, '$1$2');
  if (str.includes('.') && str.endsWith('0')) {
    str = str.replace(/0+$/, '');
  }
  return str === '-0' ? '0' : str;
}

/** joi's numeric string conversion: undefined when the string is not a number, INVALID when it is unsafe. */
function numberFromString(value: string): number | undefined | typeof INVALID {
  if (!numberRx.test(value)) {
    return undefined;
  }
  const trimmed: string = value.trim();
  let result: number = parseFloat(trimmed);
  if (result === 0) {
    result = 0;
  }
  if (/e/i.test(trimmed)) {
    if (extractSignificantDigits(trimmed) !== extractSignificantDigits(String(result))) {
      return INVALID;
    }
  } else {
    const string: string = result.toString();
    if (!/e/i.test(string) && string !== normalizeDecimal(trimmed)) {
      return INVALID;
    }
  }
  return result;
}

const isoDateRx: RegExp =
  /^(?:[-+]\d{2})?(?:\d{4}(?!\d{2}\b))(?:(-?)(?:(?:0[1-9]|1[0-2])(?:\1(?:[12]\d|0[1-9]|3[01]))?|W(?:[0-4]\d|5[0-2])(?:-?[1-7])?|(?:00[1-9]|0[1-9]\d|[12]\d{2}|3(?:[0-5]\d|6[1-6])))(?![T]$|[T][\d]+Z$)(?:[T\s](?:(?:(?:[01]\d|2[0-3])(?:(:?)[0-5]\d)?|24:?00)(?:[.,]\d+(?!:))?)(?:\2[0-5]\d(?:[.,]\d+)?)?(?:[Z]|(?:[+-])(?:[01]\d|2[0-3])(?::?[0-5]\d)?)?)?)?$/;

function isIsoDate(value: string): boolean {
  if (!isoDateRx.test(value)) {
    return false;
  }
  if (/T.*[+-]\d\d$/.test(value)) {
    value += ':00';
  }
  return !isNaN(new Date(value).getTime());
}

function display(value: any): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function failOnly(ctx: Context, only: any[]): typeof INVALID {
  return ctx.fail(
    only.length === 1 ? `must be ${display(only[0])}` : `must be one of [${only.map(display).join(', ')}]`,
    'any.only',
    only,
  );
}

function isObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export abstract class Rule {
  protected presence: Presence = 'optional';
  protected allowed: any[] = [];
  protected invalids: any[] = [];
  protected only: any[] | null = null;
  protected whens: When[] = [];
  private compiled: Check | null = null;

  /** Type check and conversion; returns the (converted) value or INVALID. */
  protected abstract base(value: any, ctx: Context): any;

  /** Type-specific rules, run after base(). */
  protected rules(value: any, ctx: Context, parent: any): any {
    return value;
  }

  protected clone(): this {
    const copy: this = Object.create(Object.getPrototypeOf(this));
    Object.assign(copy, this);
    copy.allowed = this.allowed.slice();
    copy.invalids = this.invalids.slice();
    copy.only = this.only ? this.only.slice() : null;
    copy.whens = this.whens.slice();
    copy.compiled = null;
    return copy;
  }

  public required(): this {
    const copy: this = this.clone();
    copy.presence = 'required';
    return copy;
  }

  public optional(): this {
    const copy: this = this.clone();
    copy.presence = 'optional';
    return copy;
  }

  public forbidden(): this {
    const copy: this = this.clone();
    copy.presence = 'forbidden';
    return copy;
  }

  /** Values accepted as they are, before type checks and rules. */
  public allow(...values: any[]): this {
    const copy: this = this.clone();
    copy.allowed.push(...values);
    return copy;
  }

  /** The only accepted values. */
  public valid(...values: any[]): this {
    const copy: this = this.clone();
    copy.only = [
      ...(copy.only || []),
      ...values,
    ];
    return copy;
  }

  public disallow(...values: any[]): this {
    const copy: this = this.clone();
    copy.invalids.push(...values);
    return copy;
  }

  /** Applies `then` / `otherwise` depending on the value of the sibling key `ref`. */
  public when(ref: string, options: WhenOptions): this {
    const copy: this = this.clone();
    const negate: boolean = options.not !== undefined;
    copy.whens.push({
      ref,
      is: negate ? options.not : options.is,
      negate,
      then: options.then,
      otherwise: options.otherwise,
    });
    return copy;
  }

  public validate(value: any, _options?: any): ValidationResult {
    const ctx: Context = new Context();
    const result: any = this.run(value, ctx, undefined);
    if (result === INVALID) {
      return { value, error: new ValidationError(ctx.message, ctx.errorPath) };
    }
    return { value: result };
  }

  /** Validates and returns the converted value; throws ValidationError. */
  public attempt(value: any): any {
    const result: ValidationResult = this.validate(value);
    if (result.error) {
      throw result.error;
    }
    return result.value;
  }

  /** @internal */
  public run(value: any, ctx: Context, parent: any): any {
    if (!this.compiled) {
      this.compiled = this.compile();
    }
    return this.compiled(value, ctx, parent);
  }

  private compile(): Check {
    const presence: Presence = this.presence;
    const allowed: any[] = this.allowed;
    const invalids: any[] = this.invalids;
    const only: any[] | null = this.only;
    const whens: When[] = this.whens;
    const hasLists: boolean = !!(allowed.length || invalids.length || only);

    const own: Check = (value: any, ctx: Context, parent: any): any => {
      if (value === undefined) {
        return presence === 'required' ? ctx.fail('is required', 'any.required') : value;
      }
      if (presence === 'forbidden') {
        return ctx.fail('is not allowed', 'any.unknown');
      }
      if (hasLists) {
        // joi converts before comparing against allow/valid/invalid lists
        const converted: any = this.convert(value);
        if (converted !== INVALID) {
          if (invalids.includes(converted)) {
            return ctx.fail('contains an invalid value', 'any.invalid');
          }
          if (allowed.includes(converted)) {
            return converted;
          }
          if (only) {
            if (only.includes(converted)) {
              return converted;
            }
            return failOnly(ctx, only);
          }
        } else if (only) {
          return failOnly(ctx, only);
        }
      }
      const checked: any = this.base(value, ctx);
      if (checked === INVALID) {
        return INVALID;
      }
      return this.rules(checked, ctx, parent);
    };

    if (!whens.length) {
      return own;
    }
    return (value: any, ctx: Context, parent: any): any => {
      let result: any = own(value, ctx, parent);
      if (result === INVALID) {
        return INVALID;
      }
      for (const when of whens) {
        const refValue: any = parent && typeof parent === 'object' ? parent[when.ref] : undefined;
        // a literal "is" only matches a present, equal value (joi adds required() to literals)
        const matches: boolean =
          when.is instanceof Rule ? when.is.matches(refValue, parent) : refValue !== undefined && refValue === when.is;
        const branch: Rule | undefined = matches !== when.negate ? when.then : when.otherwise;
        if (branch) {
          result = branch.run(result, ctx, parent);
          if (result === INVALID) {
            return INVALID;
          }
        }
      }
      return result;
    };
  }

  /** True when the value passes, without reporting an error. */
  public matches(value: any, parent?: any): boolean {
    return this.run(value, new Context(), parent) !== INVALID;
  }

  /** Conversion used before comparing against allow/valid/invalid lists. */
  protected convert(value: any): any {
    return value;
  }
}

export class AnyRule extends Rule {
  protected base(value: any): any {
    return value;
  }
}

type Comparison = { kind: 'min' | 'max' | 'positive' | 'integer'; limit?: number };

export class NumberRule extends Rule {
  private comparisons: Comparison[] = [];

  protected clone(): this {
    const copy: this = super.clone();
    (copy as NumberRule).comparisons = this.comparisons.slice();
    return copy;
  }

  private add(comparison: Comparison): this {
    const copy: this = this.clone();
    (copy as NumberRule).comparisons.push(comparison);
    return copy;
  }

  public positive(): this {
    return this.add({ kind: 'positive' });
  }

  public integer(): this {
    return this.add({ kind: 'integer' });
  }

  public min(limit: number): this {
    return this.add({ kind: 'min', limit });
  }

  public max(limit: number): this {
    return this.add({ kind: 'max', limit });
  }

  protected convert(value: any): any {
    if (typeof value === 'string') {
      const converted = numberFromString(value);
      return converted === undefined ? value : converted;
    }
    return value;
  }

  protected base(value: any, ctx: Context): any {
    if (typeof value === 'string') {
      const converted = numberFromString(value);
      if (converted === INVALID) {
        return ctx.fail('must be a safe number', 'number.unsafe');
      }
      if (converted !== undefined) {
        value = converted;
      }
    }
    if (value === Infinity || value === -Infinity) {
      return ctx.fail('cannot be infinity', 'number.infinity');
    }
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return ctx.fail('must be a number', 'number.base');
    }
    if (value === 0) {
      value = 0;
    }
    if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
      return ctx.fail('must be a safe number', 'number.unsafe');
    }
    return value;
  }

  protected rules(value: number, ctx: Context): any {
    const comparisons: Comparison[] = this.comparisons;
    for (let i = 0; i < comparisons.length; i = i + 1) {
      const comparison: Comparison = comparisons[i];
      switch (comparison.kind) {
        case 'positive':
          if (!(value > 0)) {
            return ctx.fail('must be a positive number', 'number.positive');
          }
          break;
        case 'integer':
          if (Math.trunc(value) - value !== 0) {
            return ctx.fail('must be an integer', 'number.integer');
          }
          break;
        case 'min':
          if (!(value >= comparison.limit)) {
            return ctx.fail(`must be greater than or equal to ${comparison.limit}`, 'number.min');
          }
          break;
        case 'max':
          if (!(value <= comparison.limit)) {
            return ctx.fail(`must be less than or equal to ${comparison.limit}`, 'number.max');
          }
          break;
      }
    }
    return value;
  }
}

export class StringRule extends Rule {
  private patterns: RegExp[] = [];
  private iso: boolean = false;

  protected clone(): this {
    const copy: this = super.clone();
    (copy as StringRule).patterns = this.patterns.slice();
    return copy;
  }

  public regex(pattern: RegExp): this {
    const copy: this = this.clone();
    // a global or sticky regex keeps lastIndex between test() calls
    (copy as StringRule).patterns.push(
      pattern.global || pattern.sticky ? new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, '')) : pattern,
    );
    return copy;
  }

  public pattern(pattern: RegExp): this {
    return this.regex(pattern);
  }

  public isoDate(): this {
    const copy: this = this.clone();
    (copy as StringRule).iso = true;
    return copy;
  }

  protected base(value: any, ctx: Context): any {
    if (typeof value !== 'string') {
      return ctx.fail('must be a string', 'string.base');
    }
    if (value === '') {
      return ctx.fail('is not allowed to be empty', 'string.empty');
    }
    return value;
  }

  protected rules(value: string, ctx: Context): any {
    for (const pattern of this.patterns) {
      if (!pattern.test(value)) {
        return ctx.fail(`with value "${value}" fails to match the required pattern: ${pattern}`, 'string.pattern.base');
      }
    }
    if (this.iso && !isIsoDate(value)) {
      return ctx.fail('must be in iso format', 'string.isoDate');
    }
    return value;
  }
}

export class BooleanRule extends Rule {
  protected convert(value: any): any {
    if (typeof value === 'string') {
      const normalized: string = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }
    return value;
  }

  protected base(value: any, ctx: Context): any {
    value = this.convert(value);
    if (typeof value !== 'boolean') {
      return ctx.fail('must be a boolean', 'boolean.base');
    }
    return value;
  }
}

export class BinaryRule extends Rule {
  protected base(value: any, ctx: Context): any {
    if (typeof value === 'string' || (value !== null && typeof value === 'object' && value.type === 'Buffer')) {
      try {
        value = Buffer.from(value.type === 'Buffer' ? value.data : value);
      } catch {
        // reported below
      }
    }
    if (!Buffer.isBuffer(value)) {
      return ctx.fail('must be a buffer or a string', 'binary.base');
    }
    return value;
  }
}

export class ArrayRule extends Rule {
  private itemRules: Rule[] = [];
  private minItems: number = -1;
  private maxItems: number = -1;

  protected clone(): this {
    const copy: this = super.clone();
    (copy as ArrayRule).itemRules = this.itemRules.slice();
    return copy;
  }

  public items(...rules: Rule[]): this {
    const copy: this = this.clone();
    (copy as ArrayRule).itemRules.push(...rules);
    return copy;
  }

  public min(limit: number): this {
    const copy: this = this.clone();
    (copy as ArrayRule).minItems = limit;
    return copy;
  }

  public max(limit: number): this {
    const copy: this = this.clone();
    (copy as ArrayRule).maxItems = limit;
    return copy;
  }

  protected base(value: any, ctx: Context): any {
    if (!Array.isArray(value)) {
      return ctx.fail('must be an array', 'array.base');
    }
    const rules: Rule[] = this.itemRules;
    let result: any[] = value;
    for (let i = 0; i < value.length; i = i + 1) {
      const item: any = value[i];
      ctx.path.push(i);
      if (item === undefined) {
        ctx.fail('must not be a sparse array item', 'array.sparse');
        ctx.path.pop();
        return INVALID;
      }
      let converted: any = item;
      if (rules.length === 1) {
        converted = rules[0].run(item, ctx, value);
      } else if (rules.length > 1) {
        converted = INVALID;
        for (const rule of rules) {
          const attempt: Context = new Context();
          const candidate: any = rule.run(item, attempt, value);
          if (candidate !== INVALID) {
            converted = candidate;
            break;
          }
        }
        if (converted === INVALID) {
          ctx.fail('does not match any of the allowed types', 'array.includes');
        }
      }
      ctx.path.pop();
      if (converted === INVALID) {
        return INVALID;
      }
      if (converted !== item) {
        if (result === value) {
          result = value.slice();
        }
        result[i] = converted;
      }
    }
    return result;
  }

  protected rules(value: any[], ctx: Context): any {
    if (this.minItems >= 0 && value.length < this.minItems) {
      return ctx.fail(`must contain at least ${this.minItems} items`, 'array.min');
    }
    if (this.maxItems >= 0 && value.length > this.maxItems) {
      return ctx.fail(`must contain less than or equal to ${this.maxItems} items`, 'array.max');
    }
    return value;
  }
}

export class ObjectRule extends Rule {
  private keys: Record<string, Rule> | null = null;
  private keyNames: string[] = [];
  private patterns: [
    RegExp,
    Rule,
  ][] = [];
  private allowUnknown: boolean = false;
  private exclusive: string[][] = [];
  private minKeys: number = -1;
  private maxKeys: number = -1;

  constructor(keys?: Record<string, Rule>) {
    super();
    if (keys) {
      this.keys = keys;
      this.keyNames = Object.keys(keys);
    }
  }

  protected clone(): this {
    const copy: this = super.clone();
    (copy as ObjectRule).patterns = this.patterns.slice();
    (copy as ObjectRule).exclusive = this.exclusive.slice();
    return copy;
  }

  public pattern(pattern: RegExp, rule: Rule): this {
    const copy: this = this.clone();
    (copy as ObjectRule).patterns.push([
      pattern,
      rule,
    ]);
    return copy;
  }

  public unknown(allow: boolean = true): this {
    const copy: this = this.clone();
    (copy as ObjectRule).allowUnknown = allow;
    return copy;
  }

  /** At most one of the keys may be present. */
  public oxor(...peers: string[]): this {
    const copy: this = this.clone();
    (copy as ObjectRule).exclusive.push(peers);
    return copy;
  }

  public min(limit: number): this {
    const copy: this = this.clone();
    (copy as ObjectRule).minKeys = limit;
    return copy;
  }

  public max(limit: number): this {
    const copy: this = this.clone();
    (copy as ObjectRule).maxKeys = limit;
    return copy;
  }

  protected base(value: any, ctx: Context): any {
    if (!isObject(value)) {
      return ctx.fail('must be of type object', 'object.base');
    }
    const keys: Record<string, Rule> | null = this.keys;
    let result: any = value;
    const setKey = (key: string, converted: any) => {
      if (result === value) {
        result = Object.assign({}, value);
      }
      result[key] = converted;
    };
    if (keys) {
      for (const key of this.keyNames) {
        const item: any = Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
        ctx.path.push(key);
        const converted: any = keys[key].run(item, ctx, value);
        ctx.path.pop();
        if (converted === INVALID) {
          return INVALID;
        }
        if (converted !== item) {
          setKey(key, converted);
        }
      }
    }
    if (keys || this.patterns.length) {
      for (const key of Object.keys(value)) {
        if (keys && Object.prototype.hasOwnProperty.call(keys, key)) {
          continue;
        }
        let matched: boolean = false;
        for (const [
          pattern,
          rule,
        ] of this.patterns) {
          if (pattern.test(key)) {
            matched = true;
            ctx.path.push(key);
            const converted: any = rule.run(value[key], ctx, value);
            ctx.path.pop();
            if (converted === INVALID) {
              return INVALID;
            }
            if (converted !== value[key]) {
              setKey(key, converted);
            }
          }
        }
        if (!matched && keys && !this.allowUnknown) {
          ctx.path.push(key);
          ctx.fail('is not allowed', 'object.unknown');
          ctx.path.pop();
          return INVALID;
        }
      }
    }
    for (const peers of this.exclusive) {
      const present: string[] = peers.filter((peer: string) => value[peer] !== undefined);
      if (present.length > 1) {
        return ctx.fail(`contains a conflict between optional exclusive peers [${peers.join(', ')}]`, 'object.oxor');
      }
    }
    return result;
  }

  protected rules(value: any, ctx: Context): any {
    if (this.minKeys >= 0 || this.maxKeys >= 0) {
      const count: number = Object.keys(value).length;
      if (this.minKeys >= 0 && count < this.minKeys) {
        return ctx.fail(`must have at least ${this.minKeys} key${this.minKeys === 1 ? '' : 's'}`, 'object.min');
      }
      if (this.maxKeys >= 0 && count > this.maxKeys) {
        return ctx.fail(
          `must have less than or equal to ${this.maxKeys} key${this.maxKeys === 1 ? '' : 's'}`,
          'object.max',
        );
      }
    }
    return value;
  }
}

export class AlternativesRule extends Rule {
  private options: Rule[] = [];
  private readonly scratch: Context = new Context();

  constructor(options: Rule[]) {
    super();
    this.options = options;
  }

  protected clone(): this {
    const copy: this = super.clone();
    (copy as AlternativesRule).options = this.options.slice();
    (copy as any).scratch = new Context();
    return copy;
  }

  public try(...options: Rule[]): this {
    const copy: this = this.clone();
    (copy as AlternativesRule).options.push(...options);
    return copy;
  }

  /**
   * When every option fails, the error is worded like joi's: options that failed on their base type only add
   * their type to "must be one of [...]"; if exactly one option got past its type check, its own error is
   * reported; otherwise "does not match any of the allowed types".
   */
  protected base(value: any, ctx: Context): any {
    // fast path: one scratch context, reset between options; errors are collected only when all options fail
    const scratch: Context = this.scratch;
    scratch.path = ctx.path;
    for (const option of this.options) {
      scratch.message = '';
      const result: any = option.run(value, scratch, undefined);
      if (result !== INVALID) {
        return result;
      }
    }
    const failures: Context[] = this.options.map((option: Rule) => {
      const attempt: Context = new Context();
      attempt.path = ctx.path;
      option.run(value, attempt, undefined);
      return attempt;
    });
    if (failures.length === 1) {
      return ctx.adopt(failures[0]);
    }
    const types: any[] = [];
    const complex: Context[] = [];
    for (const failure of failures) {
      if (failure.depth !== ctx.path.length) {
        complex.push(failure);
      } else if (failure.code === 'any.only') {
        for (const valid of failure.valids) {
          if (!types.includes(valid)) {
            types.push(valid);
          }
        }
      } else {
        const parts: string[] = failure.code.split('.');
        if (parts.length === 2 && parts[1] === 'base') {
          if (!types.includes(parts[0])) {
            types.push(parts[0]);
          }
        } else {
          complex.push(failure);
        }
      }
    }
    if (!complex.length) {
      return ctx.fail(`must be one of [${types.map(display).join(', ')}]`, 'alternatives.types');
    }
    if (complex.length === 1) {
      return ctx.adopt(complex[0]);
    }
    return ctx.fail('does not match any of the allowed types', 'alternatives.match');
  }
}

export const v = {
  any: (): Rule => new AnyRule(),
  number: (): NumberRule => new NumberRule(),
  string: (): StringRule => new StringRule(),
  boolean: (): BooleanRule => new BooleanRule(),
  binary: (): BinaryRule => new BinaryRule(),
  array: (): ArrayRule => new ArrayRule(),
  object: (keys?: Record<string, Rule>): ObjectRule => new ObjectRule(keys),
  alternatives: (...options: Rule[]): AlternativesRule => new AlternativesRule(options),
  required: (): Rule => new AnyRule().required(),
  optional: (): Rule => new AnyRule().optional(),
  forbidden: (): Rule => new AnyRule().forbidden(),
  when: (ref: string, options: WhenOptions): Rule => new AnyRule().when(ref, options),
};
