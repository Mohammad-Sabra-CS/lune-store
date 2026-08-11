"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, isAdminAuthenticated, tokenForPassword } from "@/lib/admin-auth";
import { updateOrderStatus } from "@/lib/orders";

export async function adminLogin(
  _prev: { error: boolean },
  formData: FormData,
): Promise<{ error: boolean }> {
  const password = String(formData.get("password") ?? "");
  const { valid, token } = tokenForPassword(password);
  if (!valid || !token) {
    return { error: true };
  }
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/admin",
  });
  revalidatePath("/admin");
  return { error: false };
}

export async function adminLogout(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  revalidatePath("/admin");
}

export async function setOrderStatus(
  id: string,
  status: "new" | "delivered",
): Promise<void> {
  if (!(await isAdminAuthenticated())) return;
  await updateOrderStatus(id, status);
  revalidatePath("/admin");
}
