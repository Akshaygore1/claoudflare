import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export type UserRole = "admin" | "user";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const sessionProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

export const approvedProcedure = sessionProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.approvalStatus !== "approved") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account is not approved yet",
      cause: ctx.session.user.approvalStatus,
    });
  }

  return next({ ctx });
});

export const adminProcedure = approvedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
      cause: "Not an admin",
    });
  }

  return next({ ctx });
});

export const protectedProcedure = approvedProcedure;
