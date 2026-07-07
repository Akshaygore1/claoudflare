import { env } from "@dubbed-i/env/server";

export function getNewUserDefaults(email?: string) {
  if (email && email === env.ADMIN_EMAIL) {
    return {
      role: "admin" as const,
      approvalStatus: "approved" as const,
      approvedAt: new Date(),
    };
  }

  return {
    role: "user" as const,
    approvalStatus: "pending" as const,
    approvedAt: null,
  };
}
