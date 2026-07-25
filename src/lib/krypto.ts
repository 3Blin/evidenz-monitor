/**
 * Verschlüsselung der BYOK-KI-Schlüssel (AES-256-GCM).
 * Zweck: Der API-Schlüssel des Nutzers liegt nie im Klartext in der
 * Datenbank und wird nie an den Browser zurückgegeben.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function schluesselAusKonfig(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error("BYOK_ENCRYPTION_KEY muss 32 Bytes (base64) lang sein");
  }
  return key;
}

export function verschluessle(klartext: string, base64Key: string): string {
  const key = schluesselAusKonfig(base64Key);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const daten = Buffer.concat([cipher.update(klartext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), daten.toString("base64")].join(".");
}

export function entschluessle(gespeichert: string, base64Key: string): string {
  const teile = gespeichert.split(".");
  if (teile.length !== 3) {
    throw new Error("Gespeicherter Schlüssel hat ein ungültiges Format");
  }
  const [ivB64, tagB64, datenB64] = teile as [string, string, string];
  const key = schluesselAusKonfig(base64Key);
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(datenB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
