#!/usr/bin/env node
/**
 * Preflight DA HTML in da-content/ for EDS section/block shape.
 * Blocks (including metadata) must not be direct children of <main>.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CONTENT_DIR = join(ROOT, 'da-content');

function extractMainContent(html) {
  const open = /<main\b[^>]*>/i.exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const close = /<\/main>/i.exec(html.slice(start));
  return close ? html.slice(start, start + close.index) : null;
}

function firstClassName(openTag) {
  const match = /\bclass=(["'])([^"']+)\1/i.exec(openTag);
  if (!match) return null;
  return match[2].trim().split(/\s+/)[0] || null;
}

function directDivChildren(mainHtml) {
  const children = [];
  const tagRe = /<\/?div\b[^>]*>/gi;
  let depth = 0;
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = tagRe.exec(mainHtml)) !== null) {
    const tag = m[0];
    if (/^<div\b/i.test(tag)) {
      if (depth === 0) {
        children.push({ openTag: tag, offset: m.index });
      }
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
    }
  }
  return children;
}

function detectTopLevelBlockClasses(html) {
  const main = extractMainContent(html);
  if (main === null) return { error: 'missing <main>' };
  const blocks = [];
  for (const child of directDivChildren(main)) {
    const className = firstClassName(child.openTag);
    if (className) {
      blocks.push(className);
    }
  }
  return { blocks };
}

function validateFile(path) {
  const html = readFileSync(path, 'utf8');
  const result = detectTopLevelBlockClasses(html);
  if (result.error) {
    return [{ file: path, severity: 'error', detail: result.error }];
  }
  if (!result.blocks.length) {
    return [{ file: path, severity: 'pass', detail: 'content-only sections' }];
  }
  return result.blocks.map((name) => ({
    file: path,
    severity: 'error',
    detail: `Block "${name}" is a direct <main> child — wrap in a section <div>`,
  }));
}

const files = readdirSync(CONTENT_DIR)
  .filter((name) => name.endsWith('.html'))
  .map((name) => join(CONTENT_DIR, name));

const findings = files.flatMap(validateFile);
const errors = findings.filter((f) => f.severity === 'error');

for (const finding of findings) {
  const prefix = finding.severity === 'error' ? 'ERROR' : 'OK';
  console.log(`${prefix} ${finding.file}: ${finding.detail}`);
}

if (errors.length) {
  console.error(`\n${errors.length} DA content shape error(s). See da preview explain after upload.`);
  process.exit(1);
}

console.log(`\nAll ${files.length} da-content file(s) passed section preflight.`);