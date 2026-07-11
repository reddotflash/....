import crypto from 'crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'shadow_staff_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

function getSecret() {
  const secret = process.env.STAFF_SESSION_SECRET;
  if (!secret) {
    throw new Error('STAFF_SESSION_SECRET is not set in the environment.');
  }
  return secret;
}

function hmac(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

// Compares two strings in constant time by comparing fixed-length hashes
// of them, so differing lengths don't leak information either.
function safeEqual(a, b) {
  const bufA = crypto.createHash('sha256').update(String(a)).digest();
  const bufB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(bufA, bufB);
}

export function createSessionToken() {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  const signature = hmac(payload);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  if (!safeEqual(signature, hmac(payload))) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return true;
}

export function checkStaffCredentials(username, password) {
  const expectedUser = process.env.STAFF_USERNAME || '';
  const expectedPass = process.env.STAFF_PASSWORD || '';

  if (!expectedUser || !expectedPass) {
    throw new Error('Staff credentials are not configured on the server.');
  }

  return safeEqual(username || '', expectedUser) && safeEqual(password || '', expectedPass);
}

// Call from any API route to check whether the current request is coming
// from a logged-in staff member. Reads the httpOnly cookie set by /api/staff/login.
export async function requireStaffSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
