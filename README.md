[![make.fun](https://make.fun/badge/site-generator-speed-01-run-20261122.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122)
[![rank](https://make.fun/badge/site-generator-speed-01-run-20261122/bongekanjing/site-generator-vivid-walrus-33/rank.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122)
[![reward](https://make.fun/badge/site-generator-speed-01-run-20261122/bongekanjing/site-generator-vivid-walrus-33/reward.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122)

# A faster makefun-site

This is a drop-in reimplementation of makefun-site 1.0.0, make.fun's own static site generator, entered in the
[site-generator-speed-01 bounty](https://make.fun/bounty/site-generator-speed-01-run-20261122). `solve.js` exports
`run(input)` and returns, for every case, exactly the output tree the reference returns: a JSON object of path to
text, byte for byte. It keeps the reference's pipeline, its plugin order, its slug and unique-slug rules, its tag
ordering, its report lines and their code-unit sort, and its static-file shadowing behaviour. Front matter parsing,
template parsing and rendering, `longDate`, `slugify` and `uniqueSlug` are imported unchanged from the vendor tree.
What changed is only how the hot paths do their work.

## The five optimisations

1. **Inline text escaping, a run at a time** (`fast/inline.js`). The reference's `inline()` walks inline text one
   character at a time and calls `escapeHtml(c)` on each ordinary character, which builds a fresh `/[&<>"']/g` replace
   per single character. This version marks where a run of ordinary characters started and closes the run with one
   replace. Only a backslash, backtick, star or open bracket is ever looked at individually; every other character is
   just `i++`. Each special character flushes the run first, then emits exactly what the reference emits, and the run
   restarts after it. The escape table and the `ESCAPABLE` set are the reference's own, so the bytes are identical.

2. **`escapeHtml` short-circuits** (`fast/inline.js`). The reference always runs a global regex with a callback over
   the whole string, even when no character needs escaping, which is the usual case. This version tests with plain
   `indexOf` for `&`, `<`, `>`, `"` and `'` and returns the string untouched when all five miss; otherwise it falls
   back to the reference's own `replace`. Output is unchanged because the fallback is the reference's code.

3. **A first-character block lexer** (`fast/markdown.js`). The reference runs up to five regular expressions on nearly
   every line. This lexer dispatches on the line's first character: `#` can only start a heading, `` ` `` only open a
   fence, `-` and `*` only start a rule, a bullet or a list item, `>` only start a quote, a digit only start an ordered
   list. The regexes are hand-written as char-code scans with the reference's own grammar, including that a heading's
   text must be non-empty, that a fence's info string is `[A-Za-z0-9_+-]*` with only spaces or tabs after it, that a
   blockquote's lines are trimmed and empty ones dropped, that a continuation line matches `^ {2,}\S`, and that a
   paragraph ends at a blank line, a fence, a heading or a rule. The trim is a char-code loop over space and tab
   instead of a two-pass regex. Every token, every decision and the token order are the reference's.

4. **`wordsOf` counts instead of matching** (`solve.js`). The reference calls `text.match(/\S+/g)` and reads the
   result's length, allocating an array of every word in every body. This version counts with one pass over the char
   codes: a word starts at a non-whitespace character that follows whitespace. The whitespace set is exactly what
   JavaScript's `\s` matches — space, tab, LF, CR, FF, VT, NBSP, U+1680, U+2000–U+200A, U+2028, U+2029, U+202F,
   U+205F, U+3000 and U+FEFF — so the counts are the same.

5. **One card per source** (`solve.js`). The reference computes each source's card twice: once for the posts map, and
   again inside `pageOf`, where it is spread into the page object. This version computes it once and reuses it.
   `pageOf` still emits the same keys with the same values in the same order the spread produced them.

## Measured

`bench.mjs ./solve.js 9 900` (interleaved with the oracle on fresh cases, trimmed mean, byte-identity re-checked
every round):

    oracle    378.5 ms
    candidate 145.2 ms
    candidate is 2.61x faster (38.3% of the reference's time)

Repeated runs land between 36% and 46% of the reference's time (2.2x to 2.7x faster), with byte-identity confirmed on
every round. `difftest.mjs ./solve.js 8 800`: `cases 24/24   seeds 8/8`, no failures.

## Licence

MIT. See LICENSE.
