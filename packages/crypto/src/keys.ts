import nacl from 'tweetnacl';
import { createHash } from 'node:crypto';
import type { KeyPair, SignedPreKey } from './types.js';
import { bytesToHex, generateRandomBytes } from './utils.js';

export function generateKeyPair(): KeyPair {
  const kp = nacl.box.keyPair();
  return { publicKey: kp.publicKey, privateKey: kp.secretKey };
}

export function generateIdentityKeyPair(): KeyPair {
  return generateKeyPair();
}

/**
 * Derive an Ed25519 signing key pair from a Curve25519 private key.
 * We hash the private key with SHA-512 to produce a seed for nacl.sign.keyPair.fromSeed,
 * since Curve25519 and Ed25519 keys live on related but different curves.
 */
function signingKeyPairFromCurve25519(privateKey: Uint8Array): nacl.SignKeyPair {
  const hash = createHash('sha512').update(privateKey).digest();
  const seed = new Uint8Array(hash.subarray(0, 32));
  return nacl.sign.keyPair.fromSeed(seed);
}

export function generateSignedPreKey(
  identityPrivateKey: Uint8Array,
  keyId: number,
): SignedPreKey {
  const keyPair = generateKeyPair();
  const signingKp = signingKeyPairFromCurve25519(identityPrivateKey);
  const signature = nacl.sign.detached(keyPair.publicKey, signingKp.secretKey);
  return {
    keyId,
    publicKey: keyPair.publicKey,
    signature,
  };
}

/** Returns both SignedPreKey (for bundle) and KeyPair (for receiveSession). */
export function generateSignedPreKeyWithKeyPair(
  identityPrivateKey: Uint8Array,
  keyId: number,
): { signedPreKey: SignedPreKey; keyPair: KeyPair } {
  const keyPair = generateKeyPair();
  const signingKp = signingKeyPairFromCurve25519(identityPrivateKey);
  const signature = nacl.sign.detached(keyPair.publicKey, signingKp.secretKey);
  return {
    signedPreKey: {
      keyId,
      publicKey: keyPair.publicKey,
      signature,
    },
    keyPair,
  };
}

export function generateOneTimePreKeys(
  count: number,
): { keyId: number; keyPair: KeyPair }[] {
  const keys: { keyId: number; keyPair: KeyPair }[] = [];
  for (let i = 0; i < count; i++) {
    keys.push({ keyId: i, keyPair: generateKeyPair() });
  }
  return keys;
}

export function generateRegistrationId(): number {
  const bytes = generateRandomBytes(2);
  return (bytes[0]! << 8) | bytes[1]!;
}

export function calculateFingerprint(publicKey: Uint8Array): string {
  return bytesToHex(publicKey);
}
