export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface PreKeyBundle {
  identityKey: Uint8Array;
  signedPreKey: SignedPreKey;
  oneTimePreKey?: Uint8Array;
  registrationId: number;
}

export interface SignedPreKey {
  keyId: number;
  publicKey: Uint8Array;
  signature: Uint8Array;
}

export interface X3DHResult {
  sharedSecret: Uint8Array;
  ephemeralPublicKey: Uint8Array;
  usedOneTimePreKeyId?: number;
}

export interface RatchetState {
  rootKey: Uint8Array;
  sendingChainKey: Uint8Array | null;
  receivingChainKey: Uint8Array | null;
  sendRatchetKey: KeyPair;
  receiveRatchetPublicKey: Uint8Array | null;
  sendMessageNumber: number;
  receiveMessageNumber: number;
  previousSendCount: number;
  skippedKeys: Map<string, Uint8Array>;
}

export interface MessageHeader {
  ratchetPublicKey: Uint8Array;
  previousChainLength: number;
  messageNumber: number;
}

export interface EncryptedMessage {
  header: MessageHeader;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

export interface SessionState {
  ratchetState: RatchetState;
  remoteIdentityKey: Uint8Array;
  localIdentityKey: KeyPair;
}
