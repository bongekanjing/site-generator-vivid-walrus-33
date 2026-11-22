// Fast inline rendering for makefun-site 1.0.0, byte-identical to lib/markdown.js's inline and lib/text.js's escapeHtml.
//
// The reference walks inline text one character at a time and, for each ordinary character, calls escapeHtml(c): a
// fresh /[&<>"']/g replace per single character. This version keeps a run of ordinary characters and escapes it in one
// call. escapeHtml itself returns the string untouched when none of the five characters occur in it, which is the
// usual case, so a run costs one scan and no allocation.

/** The HTML escape table, in this order: & < > " ' (README.md, "Text"). */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** `text` with & < > " and ' escaped. */
export function escapeHtml(text) {
  if (
    text.indexOf('&') === -1 &&
    text.indexOf('<') === -1 &&
    text.indexOf('>') === -1 &&
    text.indexOf('"') === -1 &&
    text.indexOf("'") === -1
  )
    return text;
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** The characters a backslash escapes. */
const ESCAPABLE = new Set(['\\', '`', '*', '_', '[', ']', '(', ')', '#', '+', '-', '.', '!', '>']);

/** The first index from `from` where `s` holds `what` outside a backslash escape, or -1. */
function findUnescaped(s, what, from) {
  for (let j = from; j <= s.length - what.length; j++) {
    if (s[j] === '\\' && j + 1 < s.length && ESCAPABLE.has(s[j + 1])) {
      j++;
      continue;
    }
    if (s.startsWith(what, j)) return j;
  }
  return -1;
}

/** The first single * from `from` (one whose run is not **), outside an escape, or -1. */
function findSingleStar(s, from) {
  for (let j = from; j < s.length; j++) {
    const c = s[j];
    if (c === '\\' && j + 1 < s.length && ESCAPABLE.has(s[j + 1])) {
      j++;
      continue;
    }
    if (c !== '*') continue;
    if (s[j + 1] === '*') {
      j++;
      continue;
    }
    return j;
  }
  return -1;
}

/** `s` rendered inline; `env.link(target)` is a link's href. */
export function inline(s, env) {
  const n = s.length;
  let out = '';
  let runStart = 0;
  let i = 0;
  // Escape and emit the pending run of ordinary characters, up to (not including) `upto`.
  const flush = (upto) => {
    if (upto > runStart) out += escapeHtml(s.slice(runStart, upto));
  };
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 92) {
      // '\'
      if (i + 1 < n && ESCAPABLE.has(s[i + 1])) {
        flush(i);
        out += escapeHtml(s[i + 1]);
        i += 2;
        runStart = i;
        continue;
      }
      i++;
      continue;
    }
    if (c === 96) {
      // '`'
      const j = s.indexOf('`', i + 1);
      flush(i);
      if (j > i + 1) {
        out += `<code>${escapeHtml(s.slice(i + 1, j))}</code>`;
        i = j + 1;
      } else {
        out += '`';
        i++;
      }
      runStart = i;
      continue;
    }
    if (c === 42) {
      // '*'
      if (s.charCodeAt(i + 1) === 42) {
        const j = findUnescaped(s, '**', i + 2);
        flush(i);
        if (j > i + 2) {
          out += `<strong>${inline(s.slice(i + 2, j), env)}</strong>`;
          i = j + 2;
        } else {
          out += '**';
          i += 2;
        }
        runStart = i;
        continue;
      }
      const j = findSingleStar(s, i + 1);
      flush(i);
      if (j > i + 1) {
        out += `<em>${inline(s.slice(i + 1, j), env)}</em>`;
        i = j + 1;
      } else {
        out += '*';
        i++;
      }
      runStart = i;
      continue;
    }
    if (c === 91) {
      // '['
      const k = findUnescaped(s, ']', i + 1);
      const m = k !== -1 && s.charCodeAt(k + 1) === 40 ? s.indexOf(')', k + 2) : -1;
      const target = m === -1 ? '' : s.slice(k + 2, m);
      if (target !== '' && !/\s/.test(target)) {
        flush(i);
        out += `<a href="${escapeHtml(env.link(target))}">${inline(s.slice(i + 1, k), env)}</a>`;
        i = m + 1;
        runStart = i;
        continue;
      }
      flush(i);
      out += '[';
      i++;
      runStart = i;
      continue;
    }
    i++;
  }
  flush(n);
  return out;
}
