/**
 * Activity logging helper for Prima Nota.
 *
 * Provides a simple wrapper around the Prisma `logAttivita` table to record
 * auditable user actions (INSERT, UPDATE, DELETE) with optional before/after
 * value snapshots.
 */

import { prisma } from "@/lib/prisma";
import { AzioneLog } from "@prisma/client";

export interface LogAttivitaParams {
  /** ID of the user performing the action. */
  userId: number;
  /** The type of action being logged. */
  azione: AzioneLog;
  /** The database table affected. */
  tabella: string;
  /** The primary-key ID of the affected record. */
  recordId: number;
  /** Snapshot of the record values *before* the change (for UPDATE / DELETE). */
  valoriPrima?: Record<string, unknown>;
  /** Snapshot of the record values *after* the change (for INSERT / UPDATE). */
  valoriDopo?: Record<string, unknown>;
  /** IP address of the request originator. */
  ipAddress?: string;
}

/**
 * Insert an activity-log record into the `log_attivita` table.
 *
 * @param params - The logging parameters.
 */
export async function logAttivita(params: LogAttivitaParams): Promise<void> {
  const {
    userId,
    azione,
    tabella,
    recordId,
    valoriPrima,
    valoriDopo,
    ipAddress,
  } = params;

  await prisma.logAttivita.create({
    data: {
      userId,
      azione,
      tabella,
      recordId,
      valoriPrima: valoriPrima ? JSON.parse(JSON.stringify(valoriPrima)) : undefined,
      valoriDopo: valoriDopo ? JSON.parse(JSON.stringify(valoriDopo)) : undefined,
      ipAddress: ipAddress ?? null,
    },
  });
}
