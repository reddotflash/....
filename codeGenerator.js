import crypto from 'crypto';

// Excludes visually ambiguous characters (0/O, 1/I/L) so staff and users
// can read codes off a screen or type them without mixing them up.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomSegment(length) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function generateRedemptionCode(prefix = 'SHDW') {
  return `${prefix}-${randomSegment(4)}-${randomSegment(4)}`;
}
