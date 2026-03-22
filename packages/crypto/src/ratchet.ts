import nacl from 'tweetnacl';
import type {
  EncryptedMessage,
  KeyPair,
  MessageHeader,
  RatchetState,
} from './types.js';
import { generateRandomBytes } from './utils.js';
import { hkdf } from './hkdf.js';
import { generateKeyPair } from './keys.js';

const CHAIN_KEY_SEED = new Uint8Array([0x01]);
const MESSAGE_KEY_SEED = new Uint8Array([0x02]);
const RATCHET_INFO = new TextEncoder().encode('AlufRatchet');
const MAX_SKIP = 256;

function kdfChainKey(chainKey: Uint8Array): Uint8Array {
  return hkdf(chainKey, CHAIN_KEY_SEED, RATCHET_INFO, 32);
}

function kdfMessageKey(chainKey: Uint8Array): Uint8Array {
  return hkdf(chainKey, MESSAGE_KEY_SEED, RATCHET_INFO, 32);
}

function dhRatchetStep(
  state: RatchetState,
  remoteRatchetPublicKey: Uint8Array,
): RatchetState {
  const newState = { ...state };
  newState.receiveRatchetPublicKey = remoteRatchetPublicKey;

  const dhRecv = nacl.scalarMult(
    state.sendRatchetKey.privateKey,
    remoteRatchetPublicKey,
  );
  const recvKdf = hkdf(
    dhRecv,
    state.rootKey,
    RATCHET_INFO,
    64,
  );
  newState.rootKey = recvKdf.slice(0, 32);
  newState.receivingChainKey = recvKdf.slice(32, 64);

  const newRatchetKey = generateKeyPair();
  const dhSend = nacl.scalarMult(
    newRatchetKey.privateKey,
    remoteRatchetPublicKey,
  );
  const sendKdf = hkdf(
    dhSend,
    newState.rootKey,
    RATCHET_INFO,
    64,
  );
  newState.rootKey = sendKdf.slice(0, 32);
  newState.sendingChainKey = sendKdf.slice(32, 64);
  newState.sendRatchetKey = newRatchetKey;

  return newState;
}

function skippedKeyId(
  ratchetPublicKey: Uint8Array,
  messageNumber: number,
): string {
  const keyHex = Array.from(ratchetPublicKey)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${keyHex}:${messageNumber}`;
}

function skipMessageKeys(
  state: RatchetState,
  until: number,
): RatchetState {
  if (!state.receivingChainKey) {
    return state;
  }
  if (until - state.receiveMessageNumber > MAX_SKIP) {
    throw new Error('Too many skipped messages');
  }

  const newState = { ...state, skippedKeys: new Map(state.skippedKeys) };
  let chainKey = state.receivingChainKey;

  while (newState.receiveMessageNumber < until) {
    const messageKey = kdfMessageKey(chainKey);
    const id = skippedKeyId(
      state.receiveRatchetPublicKey!,
      newState.receiveMessageNumber,
    );
    newState.skippedKeys.set(id, messageKey);
    chainKey = kdfChainKey(chainKey);
    newState.receiveMessageNumber++;
  }

  newState.receivingChainKey = chainKey;
  return newState;
}

export function initSenderRatchet(
  sharedSecret: Uint8Array,
  remoteRatchetKey: Uint8Array,
): RatchetState {
  const sendRatchetKey = generateKeyPair();
  const dhResult = nacl.scalarMult(sendRatchetKey.privateKey, remoteRatchetKey);
  const kdfResult = hkdf(dhResult, sharedSecret, RATCHET_INFO, 64);

  return {
    rootKey: kdfResult.slice(0, 32),
    sendingChainKey: kdfResult.slice(32, 64),
    receivingChainKey: null,
    sendRatchetKey,
    receiveRatchetPublicKey: remoteRatchetKey,
    sendMessageNumber: 0,
    receiveMessageNumber: 0,
    previousSendCount: 0,
    skippedKeys: new Map(),
  };
}

export function initReceiverRatchet(
  sharedSecret: Uint8Array,
  localRatchetKey: KeyPair,
): RatchetState {
  return {
    rootKey: sharedSecret,
    sendingChainKey: null,
    receivingChainKey: null,
    sendRatchetKey: localRatchetKey,
    receiveRatchetPublicKey: null,
    sendMessageNumber: 0,
    receiveMessageNumber: 0,
    previousSendCount: 0,
    skippedKeys: new Map(),
  };
}

export function ratchetEncrypt(
  state: RatchetState,
  plaintext: Uint8Array,
): { state: RatchetState; encrypted: EncryptedMessage } {
  if (!state.sendingChainKey) {
    throw new Error('Sending chain not initialized');
  }

  const messageKey = kdfMessageKey(state.sendingChainKey);
  const nextChainKey = kdfChainKey(state.sendingChainKey);

  const nonce = generateRandomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(plaintext, nonce, messageKey);

  const header: MessageHeader = {
    ratchetPublicKey: state.sendRatchetKey.publicKey,
    previousChainLength: state.previousSendCount,
    messageNumber: state.sendMessageNumber,
  };

  const newState: RatchetState = {
    ...state,
    sendingChainKey: nextChainKey,
    sendMessageNumber: state.sendMessageNumber + 1,
  };

  return {
    state: newState,
    encrypted: { header, ciphertext, nonce },
  };
}

export function ratchetDecrypt(
  state: RatchetState,
  message: EncryptedMessage,
): { state: RatchetState; plaintext: Uint8Array } {
  const trySkippedKey = trySkippedMessage(state, message);
  if (trySkippedKey) {
    return trySkippedKey;
  }

  let currentState = state;

  const needsRatchet =
    !state.receiveRatchetPublicKey ||
    !constantTimeEqualPublicKeys(
      message.header.ratchetPublicKey,
      state.receiveRatchetPublicKey,
    );

  if (needsRatchet) {
    currentState = skipMessageKeys(
      currentState,
      message.header.previousChainLength,
    );
    currentState = {
      ...currentState,
      previousSendCount: currentState.sendMessageNumber,
      sendMessageNumber: 0,
      receiveMessageNumber: 0,
    };
    currentState = dhRatchetStep(
      currentState,
      message.header.ratchetPublicKey,
    );
  }

  currentState = skipMessageKeys(currentState, message.header.messageNumber);

  if (!currentState.receivingChainKey) {
    throw new Error('Receiving chain not initialized');
  }

  const messageKey = kdfMessageKey(currentState.receivingChainKey);
  const nextChainKey = kdfChainKey(currentState.receivingChainKey);

  const plaintext = nacl.secretbox.open(
    message.ciphertext,
    message.nonce,
    messageKey,
  );

  if (!plaintext) {
    throw new Error('Decryption failed: invalid ciphertext or key');
  }

  const newState: RatchetState = {
    ...currentState,
    receivingChainKey: nextChainKey,
    receiveMessageNumber: currentState.receiveMessageNumber + 1,
  };

  return { state: newState, plaintext };
}

function trySkippedMessage(
  state: RatchetState,
  message: EncryptedMessage,
): { state: RatchetState; plaintext: Uint8Array } | null {
  const id = skippedKeyId(
    message.header.ratchetPublicKey,
    message.header.messageNumber,
  );
  const messageKey = state.skippedKeys.get(id);
  if (!messageKey) return null;

  const plaintext = nacl.secretbox.open(
    message.ciphertext,
    message.nonce,
    messageKey,
  );

  if (!plaintext) {
    throw new Error('Decryption failed with skipped key');
  }

  const newSkippedKeys = new Map(state.skippedKeys);
  newSkippedKeys.delete(id);

  return {
    state: { ...state, skippedKeys: newSkippedKeys },
    plaintext,
  };
}

function constantTimeEqualPublicKeys(
  a: Uint8Array,
  b: Uint8Array,
): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}
