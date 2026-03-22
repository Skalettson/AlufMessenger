import { describe, it, expect } from 'vitest';
import {
  generateKeyPair,
  generateIdentityKeyPair,
  generateSignedPreKeyWithKeyPair,
  generateOneTimePreKeys,
  generateRegistrationId,
  calculateFingerprint,
  createSession,
  receiveSession,
  encrypt,
  decrypt,
  serializeSession,
  deserializeSession,
} from '../index.js';
import type { PreKeyBundle, SessionState, EncryptedMessage } from '../types';

describe('E2EE Flow', () => {
  it('full flow: key pairs, X3DH, Double Ratchet, encrypt/decrypt', () => {
    // 1. Generate key pairs for Alice and Bob
    const aliceIdentity = generateIdentityKeyPair();
    const bobIdentity = generateIdentityKeyPair();

    // 2. Alice creates pre-key bundle (with signed pre-key, no one-time for simplicity)
    const { signedPreKey, keyPair: aliceSignedPreKeyPair } = generateSignedPreKeyWithKeyPair(
      aliceIdentity.privateKey,
      1,
    );

    const aliceBundle: PreKeyBundle = {
      identityKey: aliceIdentity.publicKey,
      signedPreKey,
      registrationId: generateRegistrationId(),
    };

    // 3. Bob performs X3DH with Alice's bundle and creates session
    const { session: bobSession, ephemeralPublicKey: bobEphemeralKey } = createSession(
      bobIdentity,
      aliceBundle,
    );

    // 4. Bob encrypts first message
    const { session: bobSessionAfterEncrypt, encrypted: bobMessage1 } = encrypt(
      bobSession,
      'Hello Alice!',
    );

    // 5. Alice receives session (needs Bob's identity + ephemeral from key exchange message)
    const { session: aliceSession, plaintext } = receiveSession(
      aliceIdentity,
      aliceSignedPreKeyPair,
      null,
      bobIdentity.publicKey,
      bobEphemeralKey,
      bobMessage1,
    );

    expect(new TextDecoder().decode(plaintext)).toBe('Hello Alice!');

    // 6. Alice encrypts reply, Bob decrypts
    const { session: aliceSession2, encrypted: aliceReply } = encrypt(
      aliceSession,
      'Hi Bob!',
    );

    const { session: bobSession2, plaintext: bobDecrypted } = decrypt(
      bobSessionAfterEncrypt,
      aliceReply,
    );

    expect(bobDecrypted).toBe('Hi Bob!');

    // 7. Multiple messages back and forth
    let aliceState: SessionState = aliceSession2;
    let bobState: SessionState = bobSession2;
    const sentByBob: EncryptedMessage[] = [];
    const sentByAlice: EncryptedMessage[] = [];

    // Bob sends Msg1, Msg2
    for (const msg of ['Msg1', 'Msg2']) {
      const r = encrypt(bobState, msg);
      bobState = r.session;
      sentByBob.push(r.encrypted);
    }

    // Alice decrypts, sends Msg3
    for (const enc of sentByBob) {
      const r = decrypt(aliceState, enc);
      aliceState = r.session;
    }
    const r3 = encrypt(aliceState, 'Msg3');
    aliceState = r3.session;
    sentByAlice.push(r3.encrypted);

    // Bob decrypts Msg3, sends Message from Bob
    const r4 = decrypt(bobState, sentByAlice[0]!);
    bobState = r4.session;
    expect(r4.plaintext).toBe('Msg3');

    const r5 = encrypt(bobState, 'Message from Bob');
    bobState = r5.session;
    sentByBob.push(r5.encrypted);

    // Alice decrypts, sends Reply from Alice
    const r6 = decrypt(aliceState, sentByBob[2]!);
    aliceState = r6.session;
    expect(r6.plaintext).toBe('Message from Bob');

    const r7 = encrypt(aliceState, 'Reply from Alice');
    aliceState = r7.session;
    sentByAlice.push(r7.encrypted);

    const r8 = decrypt(bobState, sentByAlice[1]!);
    bobState = r8.session;
    expect(r8.plaintext).toBe('Reply from Alice');
  });

  it('out-of-order message delivery with skipped keys', () => {
    const aliceIdentity = generateIdentityKeyPair();
    const bobIdentity = generateIdentityKeyPair();

    const { signedPreKey, keyPair: aliceSignedPreKeyPair } = generateSignedPreKeyWithKeyPair(
      aliceIdentity.privateKey,
      1,
    );

    const aliceBundle: PreKeyBundle = {
      identityKey: aliceIdentity.publicKey,
      signedPreKey,
      registrationId: generateRegistrationId(),
    };

    const { session: bobSession, ephemeralPublicKey: bobEphemeralKey } = createSession(
      bobIdentity,
      aliceBundle,
    );

    // Bob sends 3 messages
    const r1 = encrypt(bobSession, 'First');
    const r2 = encrypt(r1.session, 'Second');
    const r3 = encrypt(r2.session, 'Third');

    const msg1 = r1.encrypted;
    const msg2 = r2.encrypted;
    const msg3 = r3.encrypted;

    // Alice must receive msg1 first to establish session, then can receive out of order: 3, 2
    const { session: aliceSession } = receiveSession(
      aliceIdentity,
      aliceSignedPreKeyPair,
      null,
      bobIdentity.publicKey,
      bobEphemeralKey,
      msg1,
    );

    const d3 = decrypt(aliceSession, msg3);
    expect(d3.plaintext).toBe('Third');
    const d2 = decrypt(d3.session, msg2);
    expect(d2.plaintext).toBe('Second');
  });

  it('session serialization and deserialization', () => {
    const aliceIdentity = generateIdentityKeyPair();
    const bobIdentity = generateIdentityKeyPair();

    const { signedPreKey, keyPair: aliceSignedPreKeyPair } = generateSignedPreKeyWithKeyPair(
      aliceIdentity.privateKey,
      1,
    );

    const aliceBundle: PreKeyBundle = {
      identityKey: aliceIdentity.publicKey,
      signedPreKey,
      registrationId: generateRegistrationId(),
    };

    const { session: bobSession, ephemeralPublicKey: bobEphemeralKey } = createSession(
      bobIdentity,
      aliceBundle,
    );

    const { session: bobSessionAfterEncrypt, encrypted } = encrypt(bobSession, 'Persist me');

    const serialized = serializeSession(bobSessionAfterEncrypt);
    expect(typeof serialized).toBe('string');
    expect(serialized.length).toBeGreaterThan(0);

    const restored = deserializeSession(serialized);

    const { session: aliceSession } = receiveSession(
      aliceIdentity,
      aliceSignedPreKeyPair,
      null,
      bobIdentity.publicKey,
      bobEphemeralKey,
      encrypted,
    );

    const { encrypted: aliceEncrypted } = encrypt(aliceSession, 'Reply');

    const { plaintext } = decrypt(restored, aliceEncrypted);
    expect(plaintext).toBe('Reply');
  });

  it('key fingerprint generation', () => {
    const kp = generateKeyPair();
    const fp = calculateFingerprint(kp.publicKey);
    expect(typeof fp).toBe('string');
    expect(fp).toMatch(/^[0-9a-f]+$/);
    expect(fp.length).toBe(kp.publicKey.length * 2);
  });

  it('flow with one-time pre-keys', () => {
    const aliceIdentity = generateIdentityKeyPair();
    const bobIdentity = generateIdentityKeyPair();

    const { signedPreKey, keyPair: aliceSignedPreKeyPair } = generateSignedPreKeyWithKeyPair(
      aliceIdentity.privateKey,
      1,
    );

    const oneTimePreKeys = generateOneTimePreKeys(3);
    const usedOtpk = oneTimePreKeys[1]!; // use the second one

    const aliceBundle: PreKeyBundle = {
      identityKey: aliceIdentity.publicKey,
      signedPreKey,
      oneTimePreKey: usedOtpk.keyPair.publicKey,
      registrationId: generateRegistrationId(),
    };

    const { session: bobSession, ephemeralPublicKey: bobEphemeralKey } = createSession(
      bobIdentity,
      aliceBundle,
    );

    const { session: bobSessionAfterEncrypt, encrypted } = encrypt(bobSession, 'With OTPK');

    const { session: aliceSession, plaintext } = receiveSession(
      aliceIdentity,
      aliceSignedPreKeyPair,
      usedOtpk.keyPair,
      bobIdentity.publicKey,
      bobEphemeralKey,
      encrypted,
    );

    expect(new TextDecoder().decode(plaintext)).toBe('With OTPK');

    const { encrypted: reply } = encrypt(aliceSession, 'OTPK reply');
    const { plaintext: replyText } = decrypt(bobSessionAfterEncrypt, reply);
    expect(replyText).toBe('OTPK reply');
  });
});
