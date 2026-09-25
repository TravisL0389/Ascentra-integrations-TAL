#!/usr/bin/env node
(async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const root = process.cwd();
  const sourceDirs = ['src', 'app', 'components', 'features', 'pages'].filter((dir) => fs.existsSync(path.join(root, dir)));
  const rootFiles = fs.readdirSync(root)
    .filter((name) => /\.(jsx|tsx|js|ts)$/.test(name))
    .map((name) => path.join(root, name));
  const skipDirs = new Set(['node_modules', 'dist', 'build', '.next', 'coverage', '.git', 'server-dist']);
  const files = [...rootFiles];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skipDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(jsx|tsx|js|ts)$/.test(entry.name)) {
        files.push(full);
      }
    }
  }

  for (const dir of sourceDirs) walk(path.join(root, dir));

  const findings = [];
  const routeDefs = new Set(['/']);
  const navTargets = [];

  function lineOf(text, index) {
    return text.slice(0, index).split(/\r?\n/).length;
  }

  function add(file, line, message) {
    findings.push(path.relative(root, file) + ':' + line + ' ' + message);
  }

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');

    const routePatterns = [
      /<Route\s+[^>]*path=[{]?['"]([^'"]+)['"]/g,
      /\{\s*path:\s*['"]([^'"]+)['"]/g,
    ];
    for (const pattern of routePatterns) {
      let match;
      while ((match = pattern.exec(text))) {
        const value = match[1];
        if (!value || value === '*') continue;
        routeDefs.add(value.startsWith('/') ? value : '/' + value);
      }
    }

    const relative = path.relative(root, file);
    const nextAppMatch = relative.match(/^app\/(.+)\/page\.(tsx|jsx|ts|js)$/);
    if (nextAppMatch) routeDefs.add('/' + nextAppMatch[1]);
    if (/^app\/page\.(tsx|jsx|ts|js)$/.test(relative)) routeDefs.add('/');

    const invalidLinkPatterns = [
      { re: /href=\{?['"](#|javascript:void\(0\)|)['"]\}?/g, label: 'Invalid href target' },
      { re: /to=\{?['"](#|)['"]\}?/g, label: 'Invalid router target' },
      { re: /onClick=\{?['"]return false['"]\}?/g, label: 'Invalid return-false click handler' },
      { re: /javascript:void\(0\)/g, label: 'Invalid javascript:void(0)' },
    ];
    for (const { re, label } of invalidLinkPatterns) {
      let match;
      while ((match = re.exec(text))) add(file, lineOf(text, match.index), label);
    }

    const targetRe = /(?:href|to)=\{?['"](\/[^'"#?]*)['"]\}?/g;
    let target;
    while ((target = targetRe.exec(text))) navTargets.push({ file, line: lineOf(text, target.index), target: target[1] });

    const buttonRe = /<button\b([^>]*)>/g;
    let button;
    while ((button = buttonRe.exec(text))) {
      const attrs = button[1];
      const hasAction = /(onClick\s*=|type\s*=|aria-haspopup\s*=|disabled\s*=|form\s*=|onMouseDown\s*=|onPointerDown\s*=|onSubmit\s*=)/.test(attrs);
      if (!hasAction) add(file, lineOf(text, button.index), 'Button is missing an explicit action or type');
    }
  }

  const routeList = [...routeDefs];
  for (const { file, line, target } of navTargets) {
    if (/^\/\//.test(target)) continue;
    const normalized = target.replace(/\/$/, '') || '/';
    const exists = routeList.some((route) => {
      const normalizedRoute = route.replace(/\/$/, '') || '/';
      if (normalizedRoute === normalized) return true;
      if (normalizedRoute.includes(':')) {
        const pattern = new RegExp('^' + normalizedRoute.replace(/:[^/]+/g, '[^/]+') + '$');
        return pattern.test(normalized);
      }
      return false;
    });
    if (routeList.length > 1 && !exists && !/\.(pdf|png|jpg|jpeg|webp|svg|mp3|wav|zip)$/i.test(normalized)) {
      add(file, line, 'Navigation target has no obvious route: ' + target);
    }
  }

  if (findings.length) {
    console.error('Navigation validation failed:');
    for (const finding of findings) console.error('- ' + finding);
    process.exit(1);
  }

  process.stdout.write('Navigation validation passed (' + files.length + ' files scanned).\n');
})();
