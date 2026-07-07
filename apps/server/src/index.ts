import { createContext } from "@dubbed-i/api/context";
import { DUBBING_LANGUAGES, type DubbingLanguageCode } from "@dubbed-i/api/dubbing-languages";
import { appRouter } from "@dubbed-i/api/routers/index";
import { createAuth } from "@dubbed-i/auth";
import { createDb } from "@dubbed-i/db";
import { uploadedFile as uploadedFileTable } from "@dubbed-i/db/schema/uploaded-files";
import { env } from "@dubbed-i/env/server";
import { trpcServer } from "@hono/trpc-server";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

function isDubbingLanguageCode(value: string): value is DubbingLanguageCode {
  return DUBBING_LANGUAGES.some((language) => language.code === value);
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function getUploadObjectKey(userId: string, languageCode: DubbingLanguageCode, fileName: string) {
  return `users/${userId}/${languageCode}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}

async function getRequestContext(context: Parameters<typeof createContext>[0]["context"]) {
  return createContext({ context });
}

function createUploadId() {
  return crypto.randomUUID();
}

function createDownloadFileName(fileName: string) {
  return sanitizeFileName(fileName) || "video";
}

function isAllowedRequestOrigin(request: Request) {
  const allowedOrigin = env.CORS_ORIGIN;
  const origin = request.headers.get("Origin");

  if (origin) {
    return origin === allowedOrigin;
  }

  const referer = request.headers.get("Referer");
  if (!referer) {
    return false;
  }

  try {
    return new URL(referer).origin === allowedOrigin;
  } catch {
    return false;
  }
}

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => createAuth().handler(c.req.raw));

app.post("/api/videos/upload", async (c) => {
  if (!isAllowedRequestOrigin(c.req.raw)) {
    return c.json({ message: "Invalid request origin" }, 403);
  }

  const requestContext = await getRequestContext(c);

  if (!requestContext.session) {
    return c.json({ message: "Authentication required" }, 401);
  }

  if (requestContext.session.user.approvalStatus !== "approved") {
    return c.json({ message: "Your account is not approved yet" }, 403);
  }

  const formData = await c.req.formData();
  const languageCode = formData.get("languageCode");
  const videoEntry = formData.get("video");

  if (typeof languageCode !== "string" || !isDubbingLanguageCode(languageCode)) {
    return c.json({ message: "Select a supported dubbing language" }, 400);
  }

  if (!videoEntry || typeof videoEntry === "string") {
    return c.json({ message: "Select a video file to upload" }, 400);
  }

  const video = videoEntry as File;

  if (!video.type.startsWith("video/")) {
    return c.json({ message: "Only video uploads are supported" }, 400);
  }

  const objectKey = getUploadObjectKey(requestContext.session.user.id, languageCode, video.name);

  await requestContext.videosBucket.put(objectKey, video, {
    httpMetadata: {
      contentType: video.type,
    },
    customMetadata: {
      languageCode,
      originalFileName: video.name,
      userId: requestContext.session.user.id,
    },
  });

  try {
    await createDb().insert(uploadedFileTable).values({
      id: createUploadId(),
      userId: requestContext.session.user.id,
      r2Key: objectKey,
      originalFileName: video.name,
      contentType: video.type,
      sizeBytes: video.size,
      languageCode,
      status: "uploaded",
    });
  } catch (error) {
    await requestContext.videosBucket.delete(objectKey);
    console.error("Failed to persist uploaded file record", error);
    return c.json({ message: "Upload saved to storage but could not be recorded" }, 500);
  }

  return c.json({
    key: objectKey,
    fileName: video.name,
    languageCode,
    size: video.size,
  });
});

app.get("/api/videos/download", async (c) => {
  const requestContext = await getRequestContext(c);

  if (!requestContext.session) {
    return c.json({ message: "Authentication required" }, 401);
  }

  if (requestContext.session.user.approvalStatus !== "approved") {
    return c.json({ message: "Your account is not approved yet" }, 403);
  }

  const key = c.req.query("key");

  if (!key) {
    return c.json({ message: "Video key is required" }, 400);
  }

  const [uploadedVideo] = await createDb()
    .select({
      r2Key: uploadedFileTable.r2Key,
      originalFileName: uploadedFileTable.originalFileName,
      contentType: uploadedFileTable.contentType,
      sizeBytes: uploadedFileTable.sizeBytes,
    })
    .from(uploadedFileTable)
    .where(
      and(
        eq(uploadedFileTable.userId, requestContext.session.user.id),
        eq(uploadedFileTable.r2Key, key),
      ),
    );

  if (!uploadedVideo) {
    return c.json({ message: "Video not found" }, 404);
  }

  const object = await requestContext.videosBucket.get(uploadedVideo.r2Key);

  if (!object) {
    return c.json({ message: "Video file not found in storage" }, 404);
  }

  return new Response(object.body, {
    headers: {
      "Content-Disposition": `attachment; filename="${createDownloadFileName(uploadedVideo.originalFileName)}"; filename*=UTF-8''${encodeURIComponent(uploadedVideo.originalFileName)}`,
      "Content-Length": uploadedVideo.sizeBytes.toString(),
      "Content-Type": uploadedVideo.contentType || "application/octet-stream",
    },
  });
});

app.delete("/api/videos", async (c) => {
  if (!isAllowedRequestOrigin(c.req.raw)) {
    return c.json({ message: "Invalid request origin" }, 403);
  }

  const requestContext = await getRequestContext(c);

  if (!requestContext.session) {
    return c.json({ message: "Authentication required" }, 401);
  }

  if (requestContext.session.user.approvalStatus !== "approved") {
    return c.json({ message: "Your account is not approved yet" }, 403);
  }

  const key = c.req.query("key");

  if (!key) {
    return c.json({ message: "Video key is required" }, 400);
  }

  const [uploadedVideo] = await createDb()
    .select({
      r2Key: uploadedFileTable.r2Key,
    })
    .from(uploadedFileTable)
    .where(
      and(
        eq(uploadedFileTable.userId, requestContext.session.user.id),
        eq(uploadedFileTable.r2Key, key),
      ),
    );

  if (!uploadedVideo) {
    return c.json({ message: "Video not found" }, 404);
  }

  await requestContext.videosBucket.delete(uploadedVideo.r2Key);

  await createDb()
    .delete(uploadedFileTable)
    .where(
      and(
        eq(uploadedFileTable.userId, requestContext.session.user.id),
        eq(uploadedFileTable.r2Key, uploadedVideo.r2Key),
      ),
    );

  return c.json({ success: true });
});

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return getRequestContext(context);
    },
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
