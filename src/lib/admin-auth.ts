import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

function secureEqual(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}

export const ADMIN_COOKIE = "lune_admin";

function expectedToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHash("sha256").update(`lune:${password}`).digest("hex");
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const token = expectedToken();
  if (!token) return false;
  const store = await cookies();
  return secureEqual(store.get(ADMIN_COOKIE)?.value ?? "", token);
}

export function tokenForPassword(password: string): {
  valid: boolean;
  token: string | null;
} {
  const expected = expectedToken();
  if (!expected || !secureEqual(password, process.env.ADMIN_PASSWORD ?? "")) {
    return { valid: false, token: null };
  }
  return { valid: true, token: expected };
}
