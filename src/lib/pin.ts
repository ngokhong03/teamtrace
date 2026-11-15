import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { HttpError } from "./http";

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 10;

/** PIN gồm 4–6 chữ số. */
export function parsePin(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
  if (!/^\d{4,6}$/.test(s)) throw new HttpError(400, "Mã PIN phải gồm 4–6 chữ số");
  return s;
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(scryptSync(pin, salt, 32).toString("hex"));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}
