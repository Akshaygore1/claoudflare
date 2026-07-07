import { createDb } from "@dubbed-i/db";
import { user as userTable } from "@dubbed-i/db/schema/auth";
import { uploadedFile as uploadedFileTable } from "@dubbed-i/db/schema/uploaded-files";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import z from "zod";

import { DUBBING_LANGUAGES } from "../dubbing-languages";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
  sessionProcedure,
} from "../index";

const userIdInput = z.object({
  userId: z.string().min(1),
});

function getLanguageName(languageCode: string) {
  return DUBBING_LANGUAGES.find((language) => language.code === languageCode)?.name ?? languageCode;
}

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  getMyAccountStatus: sessionProcedure.query(({ ctx }) => {
    return {
      user: ctx.session.user,
      role: ctx.session.user.role,
      approvalStatus: ctx.session.user.approvalStatus,
      isAdmin: ctx.session.user.role === "admin",
      isApproved: ctx.session.user.approvalStatus === "approved",
    };
  }),
  getDashboardSummary: protectedProcedure.query(({ ctx }) => {
    return {
      message: "Welcome to your protected AI Dubbing dashboard! Your session is verified.",
      user: ctx.session.user,
    };
  }),
  listUploadedVideos: protectedProcedure.query(async ({ ctx }) => {
    const uploads = await createDb()
      .select({
        key: uploadedFileTable.r2Key,
        fileName: uploadedFileTable.originalFileName,
        languageCode: uploadedFileTable.languageCode,
        size: uploadedFileTable.sizeBytes,
        status: uploadedFileTable.status,
        uploadedAt: uploadedFileTable.createdAt,
      })
      .from(uploadedFileTable)
      .where(eq(uploadedFileTable.userId, ctx.session.user.id))
      .orderBy(desc(uploadedFileTable.createdAt));

    return uploads.map((upload) => ({
      key: upload.key,
      fileName: upload.fileName,
      languageCode: upload.languageCode,
      languageName: getLanguageName(upload.languageCode),
      size: upload.size,
      status: upload.status,
      uploadedAt: upload.uploadedAt.toISOString(),
    }));
  }),
  listUsersForApproval: adminProcedure.query(async () => {
    return createDb()
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        role: userTable.role,
        approvalStatus: userTable.approvalStatus,
        approvedAt: userTable.approvedAt,
        createdAt: userTable.createdAt,
      })
      .from(userTable)
      .orderBy(desc(userTable.createdAt));
  }),
  approveUser: adminProcedure.input(userIdInput).mutation(async ({ input }) => {
    const [updatedUser] = await createDb()
      .update(userTable)
      .set({
        approvalStatus: "approved",
        approvedAt: new Date(),
      })
      .where(eq(userTable.id, input.userId))
      .returning({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        role: userTable.role,
        approvalStatus: userTable.approvalStatus,
        approvedAt: userTable.approvedAt,
      });

    if (!updatedUser) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return updatedUser;
  }),
  deleteUser: adminProcedure.input(userIdInput).mutation(async ({ ctx, input }) => {
    if (ctx.session.user.id === input.userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You cannot delete your own account",
      });
    }

    const [targetUser] = await createDb()
      .select({
        email: userTable.email,
        role: userTable.role,
      })
      .from(userTable)
      .where(eq(userTable.id, input.userId));

    if (!targetUser) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    if (targetUser.role === "admin") {
      const admins = await createDb()
        .select({
          id: userTable.id,
        })
        .from(userTable)
        .where(eq(userTable.role, "admin"));

      if (admins.length <= 1) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot delete the last admin account",
        });
      }
    }

    const [deletedUser] = await createDb()
      .delete(userTable)
      .where(eq(userTable.id, input.userId))
      .returning({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        role: userTable.role,
        approvalStatus: userTable.approvalStatus,
        approvedAt: userTable.approvedAt,
      });

    return deletedUser;
  }),
});
export type AppRouter = typeof appRouter;
