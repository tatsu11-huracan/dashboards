const SESSION_SECRET = process.env.AUTH_SECRET ?? "dev-only-change-auth-secret";

export const SESSION_COOKIE_NAME = "esp3_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  sub: number;
  email: string;
  name: string;
  exp: number;
};

function getCrypto(): Crypto {
  if (!globalThis.crypto) {
    throw new Error("crypto is not available in this runtime");
  }

  return globalThis.crypto;
}

function toBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64url"));
  }

  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function getSigningKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(SESSION_SECRET);

  return getCrypto().subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const signature = await getCrypto().subtle.sign(
    "HMAC",
    await getSigningKey(),
    encoder.encode(data)
  );

  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(user: {
  id: number;
  email: string;
  name: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const encodedPayload = toBase64Url(payloadBytes);
  const signature = await signData(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const encoder = new TextEncoder();
  const valid = await getCrypto().subtle.verify(
    "HMAC",
    await getSigningKey(),
    fromBase64Url(signature),
    encoder.encode(encodedPayload)
  );

  if (!valid) {
    return null;
  }

  try {
    const payloadString = new TextDecoder().decode(fromBase64Url(encodedPayload));
    const payload = JSON.parse(payloadString) as SessionPayload;

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
