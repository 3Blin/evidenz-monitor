/**
 * Strukturierter JSON-Logger (pino) mit Correlation-ID.
 * Zweck: Einheitliche, maschinell auswertbare Logs; direktes console.log
 * ist per Linter-Regel verboten. Secrets werden automatisch entfernt.
 */
import pino from "pino";
import { randomUUID } from "node:crypto";

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  redact: {
    paths: ["*.schluessel", "*.token", "*.password", "schluessel_verschluesselt", "api_key", "authorization"],
    censor: "[entfernt]",
  },
});

/** Logger für einen Vorgang; alle Einträge tragen dieselbe Correlation-ID. */
export function vorgangsLogger(correlationId: string) {
  return logger.child({ correlationId });
}

export function neueCorrelationId(): string {
  return randomUUID();
}
