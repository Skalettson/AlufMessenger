import { createHmac } from 'node:crypto';

function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  const hmac = createHmac('sha256', Buffer.from(key));
  hmac.update(Buffer.from(data));
  const digest = hmac.digest();
  const result = new Uint8Array(digest.length);
  for (let i = 0; i < digest.length; i++) result[i] = digest[i]!;
  return result;
}

export function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Uint8Array {
  if (salt.length === 0) {
    salt = new Uint8Array(32);
  }
  return hmacSha256(salt, ikm);
}

export function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number,
): Uint8Array {
  const hashLen = 32;
  const n = Math.ceil(length / hashLen);
  const okm = new Uint8Array(n * hashLen);
  let prev: Uint8Array = new Uint8Array(0);

  for (let i = 1; i <= n; i++) {
    const input = new Uint8Array(prev.length + info.length + 1);
    input.set(prev as unknown as ArrayLike<number>, 0);
    input.set(info, prev.length);
    input[prev.length + info.length] = i;
    prev = hmacSha256(prk, input);
    okm.set(prev as unknown as ArrayLike<number>, (i - 1) * hashLen);
  }

  return okm.slice(0, length);
}

export function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Uint8Array {
  const prk = hkdfExtract(salt, ikm);
  return hkdfExpand(prk, info, length);
}
