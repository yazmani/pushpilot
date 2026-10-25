/// <reference types="node" />
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, deriveKey, encrypt } from '@/core/pushbullet/crypto';

// Pushbullet's end-to-end format, implemented independently with Node's crypto
// so the extension is checked against the spec rather than against itself.
const PASSWORD = 'correct horse battery staple';
const USER_IDEN = 'ujpah72o0';

function nodeKey() {
  return pbkdf2Sync(PASSWORD, USER_IDEN, 30000, 32, 'sha256');
}

function nodeEncrypt(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', nodeKey(), iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from('1'), cipher.getAuthTag(), iv, body]).toString('base64');
}

function nodeDecrypt(b64: string) {
  const data = Buffer.from(b64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', nodeKey(), data.subarray(17, 29));
  decipher.setAuthTag(data.subarray(1, 17));
  return Buffer.concat([decipher.update(data.subarray(29)), decipher.final()]).toString('utf8');
}

describe('end-to-end encryption', () => {
  it('derives the same key as PBKDF2-SHA256 with 30 000 rounds', async () => {
    expect(await deriveKey(PASSWORD, USER_IDEN)).toBe(nodeKey().toString('base64'));
  });

  it('decrypts what another Pushbullet client encrypted', async () => {
    const key = await deriveKey(PASSWORD, USER_IDEN);
    const message = JSON.stringify({ type: 'mirror', title: 'Café ☕', body: 'Code 482913' });
    expect(await decrypt(key, nodeEncrypt(message))).toBe(message);
  });

  it('encrypts so another client can decrypt', async () => {
    const key = await deriveKey(PASSWORD, USER_IDEN);
    const message = JSON.stringify({ type: 'clip', body: 'hello' });
    expect(nodeDecrypt(await encrypt(key, message))).toBe(message);
  });

  it('rejects a wrong password', async () => {
    const wrong = await deriveKey('nope', USER_IDEN);
    await expect(decrypt(wrong, nodeEncrypt('secret'))).rejects.toThrow();
  });
});
