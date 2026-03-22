export type {
  KeyPair,
  PreKeyBundle,
  SignedPreKey,
  X3DHResult,
  RatchetState,
  MessageHeader,
  EncryptedMessage,
  SessionState,
} from './types.js';

export {
  generateKeyPair,
  generateIdentityKeyPair,
  generateSignedPreKey,
  generateSignedPreKeyWithKeyPair,
  generateOneTimePreKeys,
  generateRegistrationId,
  calculateFingerprint,
} from './keys.js';

export { hkdf, hkdfExtract, hkdfExpand } from './hkdf.js';

export { performX3DH, processX3DH } from './x3dh.js';

export {
  initSenderRatchet,
  initReceiverRatchet,
  ratchetEncrypt,
  ratchetDecrypt,
} from './ratchet.js';

export {
  createSession,
  receiveSession,
  encrypt,
  decrypt,
  serializeSession,
  deserializeSession,
} from './session.js';
export type { CreateSessionResult } from './session.js';

export {
  concatBytes,
  bytesToHex,
  hexToBytes,
  bytesToBase64,
  base64ToBytes,
  generateRandomBytes,
  constantTimeEqual,
} from './utils.js';
