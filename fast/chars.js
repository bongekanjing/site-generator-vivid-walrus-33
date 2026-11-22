// The whitespace test JavaScript's \s makes: exactly the code points below, and nothing else.

/** Whether code point `c` is one of \s's whitespace characters. */
export function isWhite(c) {
  return (
    c === 32 ||
    c === 9 ||
    c === 10 ||
    c === 13 ||
    c === 12 ||
    c === 11 ||
    c === 0x00a0 ||
    c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200a) ||
    c === 0x2028 ||
    c === 0x2029 ||
    c === 0x202f ||
    c === 0x205f ||
    c === 0x3000 ||
    c === 0xfeff
  );
}
