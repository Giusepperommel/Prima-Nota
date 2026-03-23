import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { SessionUser } from "@/types";

export async function getSessionUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user as unknown as SessionUser;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user.ruolo !== "ADMIN" && user.ruolo !== "SUPER_ADMIN" && !user.isSuperAdmin) {
    redirect("/dashboard");
  }
  return user;
}
