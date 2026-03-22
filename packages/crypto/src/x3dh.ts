import nacl from 'tweetnacl';
import type { KeyPair, PreKeyBundle, X3DHResult } from './types.js';
import { concatBytes } from './utils.js';
import { hkdf } from './hkdf.js';
import { generateKeyPair } from './keys.js';

const X3DH_INFO = new TextEncoder().encode('AlufX3DH');
const X3DH_SALT = new Uint8Array(32);

/**
 * Perform Diffie-Hellman on Curve25519 using scalar multiplication.
 * nacl.scalarMult(ourPrivate, theirPublic) produces the shared point.
 */
function dh(ourPrivate: Uint8Array, theirPublic: Uint8Array): Uint8Array {
  return nacl.scalarMult(ourPrivate, theirPublic);
}

function deriveSharedSecret(dhResults: Uint8Array[]): Uint8Array {
  const combined = concatBytes(...dhResults);
  return hkdf(combined, X3DH_SALT, X3DH_INFO, 32);
}

export function performX3DH(
  localIdentity: KeyPair,
  remoteBundle: PreKeyBundle,
): X3DHResult {
  const ephemeral = generateKeyPair();

  const dh1 = dh(localIdentity.privateKey, remoteBundle.signedPreKey.publicKey);
  const dh2 = dh(ephemeral.privateKey, remoteBundle.identityKey);
  const dh3 = dh(ephemeral.privateKey, remoteBundle.signedPreKey.publicKey);

  const dhResults = [dh1, dh2, dh3];
  let usedOneTimePreKeyId: number | undefined;

  if (remoteBundle.oneTimePreKey) {
    const dh4 = dh(ephemeral.privateKey, remoteBundle.oneTimePreKey);
    dhResults.push(dh4);
    usedOneTimePreKeyId = remoteBundle.signedPreKey.keyId;
  }

  const sharedSecret = deriveSharedSecret(dhResults);

  return {
    sharedSecret,
    ephemeralPublicKey: ephemeral.publicKey,
    usedOneTimePreKeyId,
  };
}

export function processX3DH(
  localIdentity: KeyPair,
  localSignedPreKey: KeyPair,
  localOneTimePreKey: KeyPair | null,
  remoteIdentityKey: Uint8Array,
  remoteEphemeralKey: Uint8Array,
): Uint8Array {
  const dh1 = dh(localSignedPreKey.privateKey, remoteIdentityKey);
  const dh2 = dh(localIdentity.privateKey, remoteEphemeralKey);
  const dh3 = dh(localSignedPreKey.privateKey, remoteEphemeralKey);

  const dhResults = [dh1, dh2, dh3];

  if (localOneTimePreKey) {
    const dh4 = dh(localOneTimePreKey.privateKey, remoteEphemeralKey);
    dhResults.push(dh4);
  }

  return deriveSharedSecret(dhResults);
}
