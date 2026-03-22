import type {
  EncryptedMessage,
  KeyPair,
  PreKeyBundle,
  SessionState,
} from './types.js';
import { performX3DH, processX3DH } from './x3dh.js';
import {
  initSenderRatchet,
  initReceiverRatchet,
  ratchetEncrypt,
  ratchetDecrypt,
} from './ratchet.js';
import { bytesToBase64, base64ToBytes } from './utils.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface CreateSessionResult {
  session: SessionState;
  ephemeralPublicKey: Uint8Array;
}

export function createSession(
  localIdentity: KeyPair,
  remoteBundle: PreKeyBundle,
): CreateSessionResult {
  const x3dhResult = performX3DH(localIdentity, remoteBundle);
  const ratchetState = initSenderRatchet(
    x3dhResult.sharedSecret,
    remoteBundle.signedPreKey.publicKey,
  );

  return {
    session: {
      ratchetState,
      remoteIdentityKey: remoteBundle.identityKey,
      localIdentityKey: localIdentity,
    },
    ephemeralPublicKey: x3dhResult.ephemeralPublicKey,
  };
}

export function receiveSession(
  localIdentity: KeyPair,
  localSignedPreKey: KeyPair,
  localOneTimePreKey: KeyPair | null,
  remoteIdentityKey: Uint8Array,
  remoteEphemeralKey: Uint8Array,
  initialMessage: EncryptedMessage,
): { session: SessionState; plaintext: Uint8Array } {
  const sharedSecret = processX3DH(
    localIdentity,
    localSignedPreKey,
    localOneTimePreKey,
    remoteIdentityKey,
    remoteEphemeralKey,
  );

  // Use signed pre-key pair so DH matches sender's initSenderRatchet(sharedSecret, signedPreKey.publicKey)
  const ratchetState = initReceiverRatchet(sharedSecret, localSignedPreKey);
  const { state: updatedRatchet, plaintext } = ratchetDecrypt(
    ratchetState,
    initialMessage,
  );

  return {
    session: {
      ratchetState: updatedRatchet,
      remoteIdentityKey,
      localIdentityKey: localIdentity,
    },
    plaintext,
  };
}

export function encrypt(
  session: SessionState,
  plaintext: string,
): { session: SessionState; encrypted: EncryptedMessage } {
  const plaintextBytes = encoder.encode(plaintext);
  const { state, encrypted } = ratchetEncrypt(
    session.ratchetState,
    plaintextBytes,
  );

  return {
    session: { ...session, ratchetState: state },
    encrypted,
  };
}

export function decrypt(
  session: SessionState,
  encrypted: EncryptedMessage,
): { session: SessionState; plaintext: string } {
  const { state, plaintext: plaintextBytes } = ratchetDecrypt(
    session.ratchetState,
    encrypted,
  );

  return {
    session: { ...session, ratchetState: state },
    plaintext: decoder.decode(plaintextBytes),
  };
}

interface SerializedKeyPair {
  publicKey: string;
  privateKey: string;
}

interface SerializedRatchetState {
  rootKey: string;
  sendingChainKey: string | null;
  receivingChainKey: string | null;
  sendRatchetKey: SerializedKeyPair;
  receiveRatchetPublicKey: string | null;
  sendMessageNumber: number;
  receiveMessageNumber: number;
  previousSendCount: number;
  skippedKeys: [string, string][];
}

interface SerializedSessionState {
  ratchetState: SerializedRatchetState;
  remoteIdentityKey: string;
  localIdentityKey: SerializedKeyPair;
}

function serializeKeyPair(kp: KeyPair): SerializedKeyPair {
  return {
    publicKey: bytesToBase64(kp.publicKey),
    privateKey: bytesToBase64(kp.privateKey),
  };
}

function deserializeKeyPair(skp: SerializedKeyPair): KeyPair {
  return {
    publicKey: base64ToBytes(skp.publicKey),
    privateKey: base64ToBytes(skp.privateKey),
  };
}

export function serializeSession(session: SessionState): string {
  const rs = session.ratchetState;
  const serialized: SerializedSessionState = {
    ratchetState: {
      rootKey: bytesToBase64(rs.rootKey),
      sendingChainKey: rs.sendingChainKey
        ? bytesToBase64(rs.sendingChainKey)
        : null,
      receivingChainKey: rs.receivingChainKey
        ? bytesToBase64(rs.receivingChainKey)
        : null,
      sendRatchetKey: serializeKeyPair(rs.sendRatchetKey),
      receiveRatchetPublicKey: rs.receiveRatchetPublicKey
        ? bytesToBase64(rs.receiveRatchetPublicKey)
        : null,
      sendMessageNumber: rs.sendMessageNumber,
      receiveMessageNumber: rs.receiveMessageNumber,
      previousSendCount: rs.previousSendCount,
      skippedKeys: Array.from(rs.skippedKeys.entries()).map(([k, v]) => [
        k,
        bytesToBase64(v),
      ]),
    },
    remoteIdentityKey: bytesToBase64(session.remoteIdentityKey),
    localIdentityKey: serializeKeyPair(session.localIdentityKey),
  };
  return JSON.stringify(serialized);
}

export function deserializeSession(data: string): SessionState {
  const s: SerializedSessionState = JSON.parse(data);
  const rs = s.ratchetState;
  return {
    ratchetState: {
      rootKey: base64ToBytes(rs.rootKey),
      sendingChainKey: rs.sendingChainKey
        ? base64ToBytes(rs.sendingChainKey)
        : null,
      receivingChainKey: rs.receivingChainKey
        ? base64ToBytes(rs.receivingChainKey)
        : null,
      sendRatchetKey: deserializeKeyPair(rs.sendRatchetKey),
      receiveRatchetPublicKey: rs.receiveRatchetPublicKey
        ? base64ToBytes(rs.receiveRatchetPublicKey)
        : null,
      sendMessageNumber: rs.sendMessageNumber,
      receiveMessageNumber: rs.receiveMessageNumber,
      previousSendCount: rs.previousSendCount,
      skippedKeys: new Map(
        rs.skippedKeys.map(([k, v]) => [k, base64ToBytes(v)]),
      ),
    },
    remoteIdentityKey: base64ToBytes(s.remoteIdentityKey),
    localIdentityKey: deserializeKeyPair(s.localIdentityKey),
  };
}
