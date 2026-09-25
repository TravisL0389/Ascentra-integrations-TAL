const forbiddenSegments = new Set(['__proto__', 'prototype', 'constructor']);
const forbiddenExpressionTokens = [';', '`', '=>', 'new ', 'window.', 'document.', 'globalThis', 'process.', 'fetch(', 'eval(', 'Function('];
const helperNames = new Set(['now', 'uppercase', 'lowercase', 'length', 'formatDate', 'coalesce', 'jsonparse', 'jsonstringify', 'default']);

function isForbiddenSegment(segment) {
  return forbiddenSegments.has(String(segment));
}

function unescapeQuoted(value) {
  return value.replace(/\\([\\'"nrt])/g, (_, character) => ({ '\\': '\\', "'": "'", '"': '"', n: '\n', r: '\r', t: '\t' }[character] || character));
}

export function parsePath(path) {
  if (typeof path !== 'string' || !path.trim()) return null;
  const source = path.trim().replace(/^\$\.?/, '').replace(/^this\./, '');
  const tokens = [];
  let index = 0;
  const readIdentifier = () => {
    const start = index;
    while (index < source.length && /[A-Za-z_$]/.test(source[index])) index += 1;
    if (start === index) throw new Error('Invalid path segment');
    return source.slice(start, index);
  };
  try {
    tokens.push(readIdentifier());
    while (index < source.length) {
      if (source[index] === '.') {
        index += 1;
        tokens.push(readIdentifier());
        continue;
      }
      if (source[index] !== '[') throw new Error('Invalid path');
      index += 1;
      while (source[index] === ' ' || source[index] === '\t') index += 1;
      const quote = source[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        const start = index;
        while (index < source.length && source[index] !== quote) {
          if (source[index] === '\\') index += 1;
          index += 1;
        }
        if (index >= source.length) throw new Error('Unterminated path key');
        const key = source.slice(start, index).replace(/\\([\\'"nrt])/g, (_, character) => ({ '\\': '\\', "'": "'", '"': '"', n: '\n', r: '\r', t: '\t' }[character] || character));
        index += 1;
        if (source[index] !== ']') throw new Error('Unterminated path');
        index += 1;
        tokens.push(key);
        continue;
      }
      const start = index;
      while (index < source.length && /\d/.test(source[index])) index += 1;
      if (start === index) throw new Error('Invalid path index');
      const numericKey = source.slice(start, index);
      while (source[index] === ' ' || source[index] === '\t') index += 1;
      if (source[index] !== ']') throw new Error('Unterminated path index');
      index += 1;
      tokens.push(numericKey);
    }
  } catch {
    return null;
  }
  if (tokens.some(isForbiddenSegment)) return null;
  return tokens;
}

export function isSafePath(path) {
  return Array.isArray(parsePath(path));
}

export function getValueAtPath(source, path) {
  const tokens = parsePath(path);
  if (!tokens) return undefined;
  let current = source;
  for (const token of tokens) {
    if (current == null || isForbiddenSegment(token)) return undefined;
    if (Object.prototype.hasOwnProperty.call(Object(current), token)) current = current[token];
    else return undefined;
  }
  return current;
}

export function hasPath(source, path) {
  const tokens = parsePath(path);
  if (!tokens) return false;
  let current = source;
  for (const token of tokens) {
    if (current == null || isForbiddenSegment(token) || !Object.prototype.hasOwnProperty.call(Object(current), token)) return false;
    current = current[token];
  }
  return true;
}

export function setValueAtPath(target, path, value) {
  const tokens = parsePath(path);
  if (!tokens) throw new Error('Unsafe mapping path');
  const root = target && typeof target === 'object' && !Array.isArray(target) ? target : {};
  let current = root;
  tokens.forEach((token, index) => {
    if (isForbiddenSegment(token)) throw new Error('Unsafe mapping path');
    if (index === tokens.length - 1) {
      current[token] = value;
      return;
    }
    const nextToken = tokens[index + 1];
    if (!current[token] || typeof current[token] !== 'object') current[token] = /^\d+$/.test(nextToken) ? [] : {};
    current = current[token];
  });
  return root;
}

export function inferType(value) {
  if (value === null || value === undefined) return 'any';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') return 'string';
  return 'object';
}

function pathAt(root, token) {
  return root ? `${root}.${token}` : token;
}

function pathIndex(root, token) {
  return `${root}[${JSON.stringify(String(token))}]`;
}

export function flattenDataPaths(value, options = {}) {
  const root = options.root || '';
  const maxDepth = options.maxDepth ?? 8;
  const maxKeys = options.maxKeys ?? 1000;
  const paths = [];
  const seen = new WeakSet();
  const visit = (current, currentPath, depth) => {
    if (depth > maxDepth || paths.length >= maxKeys || current == null || typeof current !== 'object') return;
    if (seen.has(current)) return;
    seen.add(current);
    if (Array.isArray(current)) {
      current.forEach((entry, index) => {
        const childPath = pathIndex(currentPath, index);
        paths.push({ path: childPath, type: inferType(entry), label: childPath });
        visit(entry, childPath, depth + 1);
      });
      return;
    }
    Object.keys(current).slice(0, maxKeys).forEach((key) => {
      if (isForbiddenSegment(key)) return;
      const childPath = pathAt(currentPath, key);
      paths.push({ path: childPath, type: inferType(current[key]), label: childPath });
      visit(current[key], childPath, depth + 1);
    });
  };
  visit(value, root, 0);
  return paths;
}

function tokenizeExpression(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }
    const character = source[index];
    if (character === '\'' || character === '"') {
      let value = '';
      index += 1;
      let closed = false;
      while (index < source.length) {
        if (source[index] === '\\') {
          value += unescapeQuoted(`\\${source[index + 1] || ''}`);
          index += 2;
          continue;
        }
        if (source[index] === character) {
          index += 1;
          closed = true;
          break;
        }
        value += source[index];
        index += 1;
      }
      if (!closed) throw new Error('Unterminated string literal');
      tokens.push({ type: 'literal', value });
      continue;
    }
    if (/\d/.test(character) || (character === '-' && /\d/.test(source[index + 1] || '')) || (character === '.' && /\d/.test(source[index + 1] || ''))) {
      const start = index;
      index += character === '-' || character === '.' ? 1 : 0;
      while (index < source.length && /[\d.eE+-]/.test(source[index])) {
        if ((source[index] === '+' || source[index] === '-') && !/[eE]/.test(source[index - 1])) break;
        index += 1;
      }
      const raw = source.slice(start, index);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error('Invalid number literal');
      tokens.push({ type: 'literal', value });
      continue;
    }
    if (/[A-Za-z_$]/.test(character)) {
      const start = index;
      while (index < source.length && /[A-Za-z0-9_$]/.test(source[index])) index += 1;
      const value = source.slice(start, index);
      if (value === 'true' || value === 'false' || value === 'null') {
        tokens.push({ type: 'literal', value: value === 'true' ? true : value === 'false' ? false : null });
      } else {
        tokens.push({ type: 'identifier', value });
      }
      continue;
    }
    if ('.[](),'.includes(character)) {
      tokens.push({ type: 'punctuation', value: character });
      index += 1;
      continue;
    }
    throw new Error(`Unexpected token: ${character}`);
  }
  return tokens;
}

function expressionHelpers() {
  return {
    now: () => new Date().toISOString(),
    uppercase: (value) => String(value ?? '').toUpperCase(),
    lowercase: (value) => String(value ?? '').toLowerCase(),
    length: (value) => {
      if (Array.isArray(value) || typeof value === 'string') return value.length;
      if (value && typeof value === 'object') return Object.keys(value).length;
      return String(value ?? '').length;
    },
    formatDate: (value) => {
      if (value == null || value === '') return '';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString();
    },
    coalesce: (...values) => values.find((value) => value !== undefined && value !== null && value !== ''),
    jsonparse: (value) => {
      try {
        return JSON.parse(String(value));
      } catch {
        return null;
      }
    },
    jsonstringify: (value) => {
      try {
        return JSON.stringify(value);
      } catch {
        return null;
      }
    },
    default: (value, fallback) => value === undefined || value === null || value === '' ? fallback : value,
  };
}

function parseExpressionTokens(tokens) {
  let index = 0;
  const peek = () => tokens[index];
  const consume = () => tokens[index++];
  const expect = (value) => {
    const token = consume();
    if (!token || token.type !== 'punctuation' || token.value !== value) throw new Error(`Expected ${value}`);
  };
  const parsePathTokens = (first) => {
    const path = [first.value];
    while (peek()?.value === '.') {
      consume();
      const next = consume();
      if (!next || next.type !== 'identifier') throw new Error('Invalid path');
      path.push(next.value);
    }
    while (peek()?.value === '[') {
      consume();
      const next = consume();
      if (!next || next.type !== 'literal' || (typeof next.value !== 'string' && typeof next.value !== 'number')) throw new Error('Invalid path index');
      path.push(String(next.value));
      expect(']');
    }
    return path.join('.');
  };
  const parsePrimary = () => {
    const token = consume();
    if (!token) throw new Error('Expression ended unexpectedly');
    if (token.type === 'literal') return token.value;
    if (token.type !== 'identifier') throw new Error('Invalid expression');
    const first = token;
    const path = parsePathTokens(first);
    if (peek()?.value === '(') {
      consume();
      const args = [];
      if (peek()?.value !== ')') {
        while (true) {
          args.push(parseValue());
          if (peek()?.value !== ',') break;
          consume();
        }
      }
      expect(')');
      if (!helperNames.has(path)) throw new Error(`Unknown helper: ${path}`);
      return { helper: path, args };
    }
    return { path };
  };
  const parseArray = () => {
    const values = [];
    if (peek()?.value === ']') {
      consume();
      return values;
    }
    while (index < tokens.length) {
      values.push(parseValue());
      if (peek()?.value === ']') {
        consume();
        return values;
      }
      if (peek()?.value !== ',') throw new Error('Expected comma');
      consume();
    }
    throw new Error('Unterminated array');
  };
  const parseValue = () => {
    if (peek()?.value === '[') {
      consume();
      return parseArray();
    }
    return parsePrimary();
  };
  if (peek()?.value === '[') {
    consume();
    return parseArray();
  }
  const value = parsePrimary();
  if (index !== tokens.length) throw new Error('Unexpected expression content');
  return value;
}

function resolveExpressionValue(value, scope) {
  if (value && typeof value === 'object' && value.helper) {
    const helper = expressionHelpers()[value.helper];
    return helper(...value.args.map((argument) => resolveExpressionValue(argument, scope)));
  }
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'path')) return getValueAtPath(scope, value.path);
  return value;
}

export function evaluateSafeExpression(expression, scope = {}) {
  if (typeof expression !== 'string' || !expression.trim()) return undefined;
  const source = expression.trim();
  if (forbiddenExpressionTokens.some((token) => source.includes(token))) throw new Error('Expression contains an unsafe token');
  const parsed = parseExpressionTokens(tokenizeExpression(source));
  return resolveExpressionValue(parsed, scope);
}

export function extractTemplateReferences(template) {
  if (typeof template !== 'string') return [];
  const references = [];
  const pattern = /\{\{([\s\S]*?)\}\}/g;
  let match;
  while ((match = pattern.exec(template))) {
    try {
      const parsed = parseExpressionTokens(tokenizeExpression(match[1].trim()));
      const collect = (value) => {
        if (value && typeof value === 'object' && value.path) references.push(value.path);
        if (value && typeof value === 'object' && value.args) value.args.forEach(collect);
        if (Array.isArray(value)) value.forEach(collect);
      };
      collect(parsed);
    } catch {
      references.push(match[1].trim());
    }
  }
  return references;
}

export function interpolateSafe(template, scope = {}) {
  if (typeof template !== 'string') return template;
  const stripped = template.replace(/\{\{[\s\S]*?\}\}/g, '');
  if (/\{\{|\}\}/.test(stripped)) throw new Error('Unclosed expression');
  const pattern = /\{\{([\s\S]*?)\}\}/g;
  let result = '';
  let cursor = 0;
  let match;
  while ((match = pattern.exec(template))) {
    result += template.slice(cursor, match.index);
    const value = evaluateSafeExpression(match[1], scope);
    result += value === undefined || value === null ? '' : String(value);
    cursor = match.index + match[0].length;
  }
  result += template.slice(cursor);
  return result;
}

export function deepInterpolate(value, scope = {}) {
  if (typeof value === 'string') return interpolateSafe(value, scope);
  if (Array.isArray(value)) return value.map((entry) => deepInterpolate(entry, scope));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !forbiddenSegments.has(key)).map(([key, entry]) => [key, deepInterpolate(entry, scope)]));
  return value;
}

export function validateExpression(expression, options = {}) {
  const source = typeof expression === 'string' ? expression.trim() : '';
  const issues = [];
  if (!source) {
    if (options.required) issues.push({ code: 'expression_required', message: 'Expression is required.' });
    return { valid: issues.length === 0, issues };
  }
  if (forbiddenExpressionTokens.some((token) => source.includes(token))) issues.push({ code: 'expression_unsafe', message: 'Expression contains an unsafe token.' });
  if (/\{\{|\}\}/.test(source)) issues.push({ code: 'expression_placeholder', message: 'Remove expression delimiters when validating the inner expression.' });
  try {
    parseExpressionTokens(tokenizeExpression(source));
  } catch (error) {
    issues.push({ code: 'expression_invalid', message: error instanceof Error ? error.message : 'Expression is invalid.' });
  }
  return { valid: issues.length === 0, issues };
}

function numericValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function compareCondition(value, operator, expected) {
  const normalizedOperator = String(operator || 'equals').toLowerCase();
  if (normalizedOperator === 'exists') return value !== undefined && value !== null;
  if (normalizedOperator === 'not_exists') return value === undefined || value === null;
  if (normalizedOperator === 'is_empty') return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
  if (normalizedOperator === 'not_empty') return !(value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0));
  if (normalizedOperator === 'contains') return Array.isArray(value) ? value.some((entry) => String(entry) === String(expected)) : String(value ?? '').includes(String(expected ?? ''));
  if (normalizedOperator === 'not_contains') return !(Array.isArray(value) ? value.some((entry) => String(entry) === String(expected)) : String(value ?? '').includes(String(expected ?? '')));
  if (normalizedOperator === 'starts_with') return String(value ?? '').startsWith(String(expected ?? ''));
  if (normalizedOperator === 'ends_with') return String(value ?? '').endsWith(String(expected ?? ''));
  if (normalizedOperator === 'not_equals') return String(value ?? '') !== String(expected ?? '');
  if (normalizedOperator === 'equals') return String(value ?? '') === String(expected ?? '');
  const left = numericValue(value);
  const right = numericValue(expected);
  if (left === null || right === null) return false;
  if (normalizedOperator === 'greater_than') return left > right;
  if (normalizedOperator === 'greater_than_or_equal') return left >= right;
  if (normalizedOperator === 'less_than') return left < right;
  if (normalizedOperator === 'less_than_or_equal') return left <= right;
  return false;
}

export function evaluateCondition(condition, scope = {}) {
  if (!condition) return false;
  const actual = getValueAtPath(scope, condition.path) ?? condition.value;
  const expected = condition.expected !== undefined ? deepInterpolate(condition.expected, scope) : condition.value;
  return compareCondition(actual, condition.operator, expected);
}

export function evaluateGroups(groups, scope = {}) {
  const list = Array.isArray(groups) ? groups : [groups];
  if (!list.length || list.some((group) => !group)) return false;
  return list.every((group) => {
    const conditions = Array.isArray(group.conditions) ? group.conditions : [];
    if (!conditions.length) return false;
    const results = conditions.map((condition) => evaluateCondition(condition, scope));
    return String(group.groupOperator || group.operator || 'and').toLowerCase() === 'or' ? results.some(Boolean) : results.every(Boolean);
  });
}

export function applyMapping(mapping, source, scope = source) {
  if (!mapping) return {};
  const entries = Array.isArray(mapping) ? mapping : Object.entries(mapping).map(([target, value]) => ({ target, path: value }));
  let output = {};
  entries.forEach((entry, index) => {
    const target = entry.target || entry.to || entry.outputPath || `field_${index + 1}`;
    let value;
    if (typeof entry.path === 'string' && entry.path.includes('{{')) value = deepInterpolate(entry.path, scope);
    else if (typeof entry.path === 'string' && hasPath(source, entry.path)) value = getValueAtPath(source, entry.path);
    else value = deepInterpolate(entry.path, scope);
    if (entry.transform) value = deepInterpolate(entry.transform, scope);
    output = setValueAtPath(output, target, value);
  });
  return output;
}

export function applyTransformConfig(config = {}, scope = {}) {
  return applyMapping(config.mapping, scope, scope);
}

export function getPathSuggestions(value, prefix = '') {
  return flattenDataPaths(value, { root: prefix }).map((entry) => entry.path).filter(Boolean);
}
