import crypto from "node:crypto";

export function hmacSha256Hex(secret: string, value: string | Buffer) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function timingSafeEqualText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function sha256Hex(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomPublicSuffix(length = 6) {
  return crypto.randomBytes(8).toString("base64url").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, length);
}
