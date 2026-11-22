// makefun-site's Markdown block lexer and renderer, byte-identical to vendor/makefun-site/lib/markdown.js.
//
// lex() dispatches on a line's first character instead of running up to five regular expressions on every line: '#'
// can only start a heading, '`' only open a fence, '-' and '*' only start a rule, a bullet or a list item, '>' only a
// quote, a digit only an ordered list. Each branch is the reference's own regular expression written out by hand,
// matched character by character, and the trim is a char-code loop instead of a two-pass /^[ \t]+|[ \t]+$/ replace.

import { escapeHtml, inline } from './inline.js';
import { isWhite } from './chars.js';
import { slugify, uniqueSlug } from '../vendor/makefun-site/lib/text.js';

const CC = (s, i) => (i < s.length ? s.charCodeAt(i) : -1);

/** `line` is spaces and tabs only (BLANK). */
function isBlank(line) {
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (c !== 32 && c !== 9) return false;
  }
  return true;
}

/** `line` with spaces and tabs at either end dropped (trimLine). */
function trimLine(line) {
  let a = 0;
  let b = line.length;
  while (a < b) {
    const c = line.charCodeAt(a);
    if (c !== 32 && c !== 9) break;
    a++;
  }
  while (b > a) {
    const c = line.charCodeAt(b - 1);
    if (c !== 32 && c !== 9) break;
    b--;
  }
  return a === 0 && b === line.length ? line : line.slice(a, b);
}

/** The fence's info string when `line` opens a fence (FENCE_OPEN), else null. */
function fenceLang(line) {
  if (CC(line, 0) !== 96 || CC(line, 1) !== 96 || CC(line, 2) !== 96) return null;
  let i = 3;
  const n = line.length;
  while (i < n) {
    const c = line.charCodeAt(i);
    if (
      !((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95 || c === 43 || c === 45)
    )
      break;
    i++;
  }
  const lang = line.slice(3, i);
  for (; i < n; i++) {
    const c = line.charCodeAt(i);
    if (c !== 32 && c !== 9) return null;
  }
  return lang;
}

/** Whether `line` closes a fence (FENCE_CLOSE). */
function isFenceClose(line) {
  if (CC(line, 0) !== 96 || CC(line, 1) !== 96 || CC(line, 2) !== 96) return false;
  for (let i = 3; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (c !== 32 && c !== 9) return false;
  }
  return true;
}

/** A heading line's level and text, or null (a heading's text is never empty). */
function headingOf(line) {
  const n = line.length;
  if (n === 0 || line.charCodeAt(0) !== 35) return null;
  let d = 0;
  while (d < n && line.charCodeAt(d) === 35) d++;
  if (d > 6) return null;
  let i = d;
  const c = CC(line, i);
  if (c !== 32 && c !== 9) return null;
  while (i < n) {
    const c2 = line.charCodeAt(i);
    if (c2 !== 32 && c2 !== 9) break;
    i++;
  }
  let e = n;
  while (e > i) {
    const c3 = line.charCodeAt(e - 1);
    if (c3 !== 32 && c3 !== 9) break;
    e--;
  }
  if (e <= i) return null;
  return { depth: d, text: line.slice(i, e) };
}

/** Whether `line` is a thematic break (HR). */
function isHr(line) {
  const c0 = CC(line, 0);
  const mark = c0 === 45 ? 45 : c0 === 42 ? 42 : -1;
  if (mark === -1) return false;
  if (CC(line, 1) !== mark || CC(line, 2) !== mark) return false;
  for (let i = 3; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (c !== 32 && c !== 9) return false;
  }
  return true;
}

/** A bullet item's text (BULLET), or null. A list's marker takes either '-' or '*'. */
function bulletAt(line) {
  const c0 = CC(line, 0);
  if ((c0 === 45 || c0 === 42) && CC(line, 1) === 32) return line.slice(2);
  return null;
}

/** The index just past an ordered marker's digits (ORDERED), or -1 when the line is no item. */
function orderedDigits(line) {
  const n = line.length;
  let i = 0;
  while (i < n) {
    const c = line.charCodeAt(i);
    if (c < 48 || c > 57) break;
    i++;
  }
  if (i === 0 || i > 9) return -1;
  if (CC(line, i) !== 46 || CC(line, i + 1) !== 32) return -1;
  return i;
}

/** Whether `line` continues a list item: two or more spaces then a non-space (CONTINUED). */
function isContinued(line) {
  if (CC(line, 0) !== 32 || CC(line, 1) !== 32) return false;
  let i = 2;
  const n = line.length;
  while (i < n && line.charCodeAt(i) === 32) i++;
  if (i >= n) return false;
  return !isWhite(line.charCodeAt(i));
}

/** Whether `line` ends a paragraph: a blank line, a fence, a heading or a thematic break. */
function endsParagraph(line) {
  if (isBlank(line)) return true;
  const c0 = CC(line, 0);
  if (c0 === 96) return fenceLang(line) !== null;
  if (c0 === 35) return headingOf(line) !== null;
  if (c0 === 45 || c0 === 42) return isHr(line);
  return false;
}

/** `src`'s block tokens, in order. */
export function lex(src) {
  const lines = src.split('\n');
  const tokens = [];
  const n = lines.length;
  let i = 0;
  while (i < n) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }
    const c0 = line.charCodeAt(0);
    if (c0 === 96) {
      const lang = fenceLang(line);
      if (lang !== null) {
        const body = [];
        i++;
        while (i < n && !isFenceClose(lines[i])) body.push(lines[i++]);
        i++;
        tokens.push({ type: 'code', lang, lines: body });
        continue;
      }
    }
    if (c0 === 35) {
      const heading = headingOf(line);
      if (heading !== null) {
        tokens.push({ type: 'heading', depth: heading.depth, text: heading.text });
        i++;
        continue;
      }
    }
    if ((c0 === 45 || c0 === 42) && isHr(line)) {
      tokens.push({ type: 'hr' });
      i++;
      continue;
    }
    if (c0 === 62) {
      const body = [];
      while (i < n && lines[i].charCodeAt(0) === 62) {
        const l = lines[i];
        body.push(trimLine(l.charCodeAt(1) === 32 ? l.slice(2) : l.slice(1)));
        i++;
      }
      tokens.push({ type: 'blockquote', lines: body.filter((l) => l !== '') });
      continue;
    }
    const bullet = c0 === 45 || c0 === 42 ? bulletAt(line) : null;
    const digits = bullet === null && c0 >= 48 && c0 <= 57 ? orderedDigits(line) : -1;
    if (bullet !== null || digits !== -1) {
      const isOrdered = digits !== -1;
      const startNum = isOrdered ? Number(line.slice(0, digits)) : 1;
      const items = [];
      while (i < n) {
        const l = lines[i];
        const m = isOrdered ? orderedDigits(l) : -1;
        const t = isOrdered ? (m !== -1 ? l.slice(m + 2) : null) : bulletAt(l);
        if (t !== null) {
          items.push([trimLine(t)]);
          i++;
        } else if (isContinued(l)) {
          items[items.length - 1].push(trimLine(l));
          i++;
        } else break;
      }
      tokens.push({
        type: 'list',
        ordered: isOrdered,
        start: startNum,
        items: items.map((parts) => parts.join('\n')),
      });
      continue;
    }
    const body = [trimLine(line)];
    i++;
    while (i < n && !endsParagraph(lines[i])) body.push(trimLine(lines[i++]));
    tokens.push({ type: 'paragraph', text: body.join('\n') });
  }
  return tokens;
}

/**
 * `src` rendered: its HTML (each block on its own lines, a "\n" after the last), its table of contents (every level 2
 * and 3 heading: level, id and its inline HTML) and its excerpt (the first paragraph's inline HTML, or "").
 */
export function renderMarkdown(src, env) {
  const ids = new Set();
  const blocks = [];
  const toc = [];
  let excerpt = null;
  for (const t of lex(src)) {
    switch (t.type) {
      case 'heading': {
        const id = uniqueSlug(slugify(t.text), ids);
        const html = inline(t.text, env);
        blocks.push(`<h${t.depth} id="${id}">${html}</h${t.depth}>`);
        if (t.depth === 2 || t.depth === 3) toc.push({ level: t.depth, id, html });
        break;
      }
      case 'code': {
        const cls = t.lang === '' ? '' : ` class="language-${escapeHtml(t.lang)}"`;
        let inner = '';
        for (const l of t.lines) inner += `${escapeHtml(l)}\n`;
        blocks.push(`<pre><code${cls}>${inner}</code></pre>`);
        break;
      }
      case 'hr':
        blocks.push('<hr>');
        break;
      case 'blockquote':
        blocks.push(
          t.lines.length === 0
            ? '<blockquote>\n</blockquote>'
            : `<blockquote>\n<p>${inline(t.lines.join('\n'), env)}</p>\n</blockquote>`,
        );
        break;
      case 'list': {
        const tag = t.ordered ? 'ol' : 'ul';
        const open = t.ordered && t.start !== 1 ? `<ol start="${t.start}">` : `<${tag}>`;
        let inner = '';
        for (const item of t.items) inner += `<li>${inline(item, env)}</li>\n`;
        blocks.push(`${open}\n${inner}</${tag}>`);
        break;
      }
      case 'paragraph': {
        const html = inline(t.text, env);
        if (excerpt === null) excerpt = html;
        blocks.push(`<p>${html}</p>`);
        break;
      }
    }
  }
  let html = '';
  for (const b of blocks) html += `${b}\n`;
  return { html, toc, excerpt: excerpt ?? '' };
}
