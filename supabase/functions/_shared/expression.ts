// Expression + template engine for nodes.
//
// Goals:
//   - `{{ trigger.body.email }}` interpolation anywhere in config strings
//   - `{{ previous.output.id }}`, `{{ nodes.<id>.output.x }}`, `{{ variables.region }}`
//   - a bare single `{{ expr }}` field returns the raw typed value (not a string)
//   - helpers: now(), uppercase(), lowercase(), length(), formatDate(), coalesce(),
//     jsonparse(), jsonstringify(), default()
//   - NO eval(), NO Function constructor. Fully self-contained and testable.

import { TALError } from './errors.ts';

export type Helpers = Record<string, (...args: unknown[]) => unknown>;

export const DEFAULT_HELPERS: Helpers = {
  now(): string {
    return new Date().toISOString();
  },
  uppercase(v: unknown): unknown {
    return typeof v === 'string' ? v.toUpperCase() : v;
  },
  lowercase(v: unknown): unknown {
    return typeof v === 'string' ? v.toLowerCase() : v;
  },
  length(v: unknown): number {
    if (typeof v === 'string') return v.length;
    if (Array.isArray(v)) return v.length;
    if (v && typeof v === 'object') return Object.keys(v).length;
    return 0;
  },
  formatDate(v: unknown, fmt?: unknown): string {
    if (v == null) return '';
    if (typeof v === 'number') return new Date(v).toISOString();
    const d = typeof v === 'string' ? new Date(v) : (v as Date);
    if (Number.isNaN(d.getTime())) return String(v);
    const t = d.toISOString();
    switch (fmt) {
      case 'date':
        return t.slice(0, 10);
      case 'datetime':
        return t.slice(0, 19);
      case 'time':
        return t.slice(11, 19);
      case 'utc':
        return t;
      default:
        return t;
    }
  },
  coalesce(...args: unknown[]): unknown {
    return args.find((a) => a !== null && a !== undefined && a !== '');
  },
  jsonparse(v: unknown): unknown {
    try {
      return typeof v === 'string' ? JSON.parse(v) : v;
    } catch {
      return v;
    }
  },
  jsonstringify(v: unknown): string {
    try {
      return JSON.stringify(v ?? null);
    } catch {
      return String(v);
    }
  },
  default(v: unknown, fallback: unknown): unknown {
    return v === null || v === undefined || v === '' ? fallback : v;
  },
};

export const INSERTION_RE = /\{\{\s*([\s\S]*?)\s*\}\}/g;

// ---------------------------------------------------------------------------
// Tokenizer + parser for bare expressions
// ---------------------------------------------------------------------------

type Token =
  | { t: 'ident'; v: string }
  | { t: 'number'; v: number }
  | { t: 'string'; v: string }
  | { t: 'punct'; v: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const start = i;
      while (i < src.length && /[A-Za-z0-9_$]/.test(src[i])) i += 1;
      tokens.push({ t: 'ident', v: src.slice(start, i) });
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const start = i;
      if (ch === '-') i += 1;
      while (i < src.length && /[0-9.eE+_-]/.test(src[i])) i += 1;
      const num = Number(src.slice(start, i));
      tokens.push({ t: 'number', v: Number.isNaN(num) ? 0 : num });
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let value = '';
      i += 1;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < src.length) {
          const next = src[i + 1];
          if (next === 'n') value += '\n';
          else if (next === 't') value += '\t';
          else value += next;
          i += 2;
        } else {
          value += src[i];
          i += 1;
        }
      }
      i += 1; // closing quote
      tokens.push({ t: 'string', v: value });
      continue;
    }
    if ('().,[]'.includes(ch)) {
      tokens.push({ t: 'punct', v: ch });
      i += 1;
      continue;
    }
    throw new TALError({
      code: 'invalid_expression',
      message: `Unexpected character "${ch}" in expression "${src}"`,
    });
  }
  return tokens;
}

function isIdent(t: Token | undefined): t is { t: 'ident'; v: string } {
  return !!t && t.t === 'ident';
}

type ExprNode =
  | { k: 'path'; segments: (string | number)[] }
  | { k: 'literal'; value: unknown }
  | { k: 'array'; items: ExprNode[] }
  | { k: 'call'; name: string; args: ExprNode[] };

function parseSingleToken(t: Token | undefined): ExprNode {
  if (!t) throw new TALError({ code: 'invalid_expression', message: 'Unexpected end of expression' });
  if (t.t === 'number') return { k: 'literal', value: t.v };
  if (t.t === 'string') return { k: 'literal', value: t.v };
  throw new TALError({ code: 'invalid_expression', message: `Unexpected token in expression` });
}

function parsePath(tokens: Token[], i: number): { node: ExprNode; next: number } {
  if (!isIdent(tokens[i])) {
    throw new TALError({ code: 'invalid_expression', message: 'Expected path expression' });
  }
  const segments: (string | number)[] = [tokens[i].v];
  let pos = i + 1;
  let isCall = false;

  while (pos < tokens.length) {
    const t = tokens[pos];
    if (t.t === 'punct' && t.v === '(') {
      isCall = true;
      break;
    }
    if (t.t === 'punct' && t.v === '.') {
      const next = tokens[pos + 1];
      if (!isIdent(next)) throw new TALError({ code: 'invalid_expression', message: 'Expected property after "."' });
      segments.push(next.v);
      pos += 2;
      continue;
    }
    if (t.t === 'punct' && t.v === '[') {
      const inner = parseSingleToken(tokens[pos + 1]);
      const close = tokens[pos + 2];
      if (!close || close.t !== 'punct' || close.v !== ']') {
        throw new TALError({ code: 'invalid_expression', message: 'Unclosed "[" in expression' });
      }
      segments.push(inner.k === 'literal' ? (inner.value as string | number) : String(inner));
      pos += 3;
      continue;
    }
    break;
  }

  if (isCall) return { node: { k: 'call', name: segments[0] as string, args: [] }, next: pos };
  return { node: { k: 'path', segments }, next: pos };
}

function parseExpression(src: string): ExprNode {
  const tokens = tokenize(src);
  let pos = 0;

  const parse = (): { node: ExprNode; next: number } => {
    const t = tokens[pos];
    if (!t) throw new TALError({ code: 'invalid_expression', message: `Empty expression "${src}"` });
    if (t.t === 'number' || t.t === 'string') {
      const next = pos + 1;
      pos = next;
      return { node: { k: 'literal', value: t.v }, next };
    }
    if (t.t === 'ident') {
      const { node, next } = parsePath(tokens, pos);
      pos = next;
      if (node.k === 'call') {
        // consume "(" args ")"
        const args: ExprNode[] = [];
        pos += 1; // skip "("
        while (pos < tokens.length && !(tokens[pos].t === 'punct' && tokens[pos].v === ')')) {
          const arg = parse();
          args.push(arg.node);
          if (tokens[pos] && tokens[pos].t === 'punct' && tokens[pos].v === ',') {
            pos += 1;
          } else {
            break;
          }
        }
        pos += 1; // skip ")"
        return { node: { k: 'call', name: node.name, args }, next: pos };
      }
      return { node, next: pos };
    }
    if (t.t === 'punct' && t.v === '[') {
      const items: ExprNode[] = [];
      pos += 1; // skip "["
      while (pos < tokens.length && !(tokens[pos].t === 'punct' && tokens[pos].v === ']')) {
        const item = parse();
        items.push(item.node);
        if (tokens[pos] && tokens[pos].t === 'punct' && tokens[pos].v === ',') {
          pos += 1;
        } else {
          break;
        }
      }
      pos += 1; // skip "]"
      return { node: { k: 'array', items }, next: pos };
    }
    throw new TALError({ code: 'invalid_expression', message: `Unexpected token in expression "${src}"` });
  };

  const { node, next } = parse();
  if (next < tokens.length) {
    throw new TALError({ code: 'invalid_expression', message: `Unexpected trailing tokens in expression "${src}"` });
  }
  return node;
}

export function resolvePath(root: unknown, segments: (string | number)[]): unknown {
  let cur: unknown = root;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof seg === 'number') {
      cur = Array.isArray(cur) ? cur[seg] : undefined;
    } else if (Array.isArray(cur) && /^\d+$/.test(seg)) {
      cur = cur[Number(seg)];
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

function evalNode(node: ExprNode, scope: Record<string, unknown>, helpers: Helpers, src: string): unknown {
  if (node.k === 'literal') return node.value;
  if (node.k === 'array') return node.items.map((i) => evalNode(i, scope, helpers, src));
  if (node.k === 'path') return resolvePath(scope, node.segments);
  if (node.k === 'call') {
    const fn = helpers[node.name];
    if (typeof fn !== 'function') {
      // If unknown helper, fall back to a path (allows scope keys that collide).
      const asPath = resolvePath(scope, [node.name]);
      if (asPath !== undefined) return asPath;
      throw new TALError({
        code: 'invalid_expression',
        message: `Unknown helper "${node.name}" in expression "${src}"`,
      });
    }
    return fn(...node.args.map((a) => evalNode(a, scope, helpers, src)));
  }
  return undefined;
}

export function evaluateExpression(
  raw: string,
  scope: Record<string, unknown> = {},
  helpers: Helpers = DEFAULT_HELPERS,
): unknown {
  const src = String(raw ?? '').trim();
  if (src === '') return undefined;
  const node = parseExpression(src);
  return evalNode(node, scope, helpers, src);
}

// Build a scope root object from a flat-ish dictionary + symbol roots.
function buildScope(roots: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(roots)) {
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

function toTemplateString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export interface TemplateOptions {
  scope?: Record<string, unknown>;
  roots?: Record<string, unknown>;
  helpers?: Helpers;
}

/**
 * Interpolate a template string:
 *   - exactly one `{{ expr }}` -> returns the raw typed value
 *   - otherwise text with substitutions -> string
 * Returns the string value for non-strings.
 */
export function interpolate(template: unknown, opts: TemplateOptions = {}): unknown {
  if (template === null || template === undefined) return template;
  if (typeof template !== 'string') return template;

  const scope = buildScope({ ...(opts.scope ?? {}), ...(opts.roots ?? {}) });
  const helpers = opts.helpers ?? DEFAULT_HELPERS;

  INSERTION_RE.lastIndex = 0;
  if (!INSERTION_RE.test(template)) return template;

  const matches = [...template.matchAll(/\{\{\s*([\s\S]*?)\s*\}\}/g)];

  // Whole-field expression: preserve the raw type.
  if (matches.length === 1) {
    const start = template.indexOf(matches[0][0]);
    const end = start + matches[0][0].length;
    const before = template.slice(0, start).trim();
    const after = template.slice(end).trim();
    if (before === '' && after === '') {
      return evaluateExpression(matches[0][1], scope, helpers);
    }
  }

  let result = template;
  for (const m of matches) {
    const value = evaluateExpression(m[1], scope, helpers);
    result = result.split(m[0]).join(toTemplateString(value));
  }
  return result;
}

export interface InterpolateAllOptions extends TemplateOptions {
  keyMap?: Record<string, string>; // map raw keys to their scope path, e.g. { url: 'config.url' }
}

/**
 * Deep-interpolate a config object. Every string field (leaf) is run through
 * `interpolate`. Non-string leaves pass through unchanged. Objects/arrays recurse.
 */
export function deepInterpolate(input: unknown, opts: TemplateOptions = {}): unknown {
  const interpolateOne = (value: unknown): unknown => {
    if (typeof value === 'string') return interpolate(value, opts);
    if (Array.isArray(value)) return value.map(interpolateOne);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = interpolateOne(v);
      }
      return out;
    }
    return value;
  };
  return interpolateOne(input);
}