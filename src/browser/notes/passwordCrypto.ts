const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ITERATIONS = 150_000;

export interface SecretCipher {
  cipher: string;
  iv: string;
  salt: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

async function deriveKey(
  pin: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt a secret so only the matching PIN can recover it. */
export async function encryptSecret(
  plain: string,
  pin: string
): Promise<SecretCipher> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    encoder.encode(plain) as BufferSource
  );

  return {
    cipher: toBase64(new Uint8Array(ciphertext)),
    iv: toBase64(iv),
    salt: toBase64(salt),
  };
}

/** Throws if the PIN is wrong (AES-GCM authentication fails). */
export async function decryptSecret(
  secret: SecretCipher,
  pin: string
): Promise<string> {
  const key = await deriveKey(pin, fromBase64(secret.salt));

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(secret.iv) as BufferSource },
    key,
    fromBase64(secret.cipher) as BufferSource
  );

  return decoder.decode(plaintext);
}
