import { desc } from "drizzle-orm";
import { db, hasDatabase } from "@/lib/db";
import { feedback, type FeedbackRow } from "@/lib/db/schema";
import type { Locale } from "@/i18n/routing";

export interface FeedbackInput {
  name: string | null;
  email: string | null;
  message: string;
  locale: Locale;
}

export type Feedback = FeedbackRow;

/**
 * Feedback storage. Uses Neon Postgres when DATABASE_URL is set;
 * falls back to a local JSON file for development without a database.
 */

const DEV_STORE = ".feedback.dev.json";

async function devRead(): Promise<Feedback[]> {
  const { readFile } = await import("fs/promises");
  try {
    return JSON.parse(await readFile(DEV_STORE, "utf8")) as Feedback[];
  } catch {
    return [];
  }
}

async function devWrite(all: Feedback[]): Promise<void> {
  const { writeFile } = await import("fs/promises");
  await writeFile(DEV_STORE, JSON.stringify(all, null, 2), "utf8");
}

export async function createFeedback(input: FeedbackInput): Promise<Feedback> {
  if (hasDatabase()) {
    const [row] = await db().insert(feedback).values(input).returning();
    return row;
  }
  const all = await devRead();
  const row: Feedback = {
    id: crypto.randomUUID(),
    createdAt: new Date(),
    ...input,
  };
  all.unshift(row);
  await devWrite(all);
  return row;
}

export async function listFeedback(): Promise<Feedback[]> {
  if (hasDatabase()) {
    return db().select().from(feedback).orderBy(desc(feedback.createdAt));
  }
  return devRead();
}
