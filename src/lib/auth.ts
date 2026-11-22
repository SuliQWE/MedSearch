import { cookies } from "next/headers";
import { DEMO_USERS } from "./seed";
import type { DemoUser, Role } from "./types";

const COOKIE = "mf_demo_user";

export function currentUser(): DemoUser | null {
  const id = cookies().get(COOKIE)?.value;
  return DEMO_USERS.find((u) => u.id === id) ?? null;
}

export function requireRole(...roles: Role[]): DemoUser {
  const u = currentUser();
  if (!u || !roles.includes(u.role)) throw new Error("Нет доступа");
  return u;
}

export const AUTH_COOKIE = COOKIE;

export const ROLE_HOME: Record<Role, string> = {
  buyer: "/account",
  pharmacy: "/pharmacy",
  supplier: "/supplier",
  importer: "/importer",
  admin: "/admin",
};
