// Pushbullet end-to-end encryption: AES-256-GCM, key = PBKDF2-SHA256(password,
// salt = user iden, 30 000 rounds). Wire format, base64 of:
//   '1' (version byte) | tag (16) | iv (12) | ciphertext

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Derives the raw key and returns it base64-encoded for storage. */
export async function deriveKey(password: string, userIden: string): Promise<string> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(userIden), iterations: 30000, hash: 'SHA-256' },
    base,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function importKey(rawB64: string): Promise<CryptoKey> {
  let key = keyCache.get(rawB64);
  if (!key) {
    key = crypto.subtle.importKey('raw', fromBase64(rawB64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    keyCache.set(rawB64, key);
  }
  return key;
}

export async function encrypt(rawKey: string, plaintext: string): Promise<string> {
  const key = await importKey(rawKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext)));
  const tag = sealed.slice(-16);
  const body = sealed.slice(0, -16);
  const out = new Uint8Array(1 + 16 + 12 + body.length);
  out[0] = 0x31;
  out.set(tag, 1);
  out.set(iv, 17);
  out.set(body, 29);
  return toBase64(out);
}

export async function decrypt(rawKey: string, ciphertext: string): Promise<string> {
  const key = await importKey(rawKey);
  const data = fromBase64(ciphertext);
  if (data[0] !== 0x31) throw new Error('Unsupported encryption version');
  const tag = data.slice(1, 17);
  const iv = data.slice(17, 29);
  const body = data.slice(29);
  const sealed = new Uint8Array(body.length + 16);
  sealed.set(body, 0);
  sealed.set(tag, body.length);
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, sealed));
}

export async function decryptJson<T>(rawKey: string, ciphertext: string): Promise<T> {
  return JSON.parse(await decrypt(rawKey, ciphertext)) as T;
}
