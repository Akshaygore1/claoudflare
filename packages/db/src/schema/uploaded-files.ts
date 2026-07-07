import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const uploadedFile = sqliteTable(
  "uploaded_file",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull().unique(),
    originalFileName: text("original_file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    languageCode: text("language_code").notNull(),
    status: text("status").default("uploaded").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("uploaded_file_user_id_idx").on(table.userId),
    index("uploaded_file_created_at_idx").on(table.createdAt),
  ],
);

export const uploadedFileRelations = relations(uploadedFile, ({ one }) => ({
  user: one(user, {
    fields: [uploadedFile.userId],
    references: [user.id],
  }),
}));
