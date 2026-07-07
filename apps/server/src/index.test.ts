/// <reference types="bun-types" />

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

type Session = {
  user: {
    id: string;
    role: "admin" | "user";
    approvalStatus: "approved" | "pending" | "rejected";
    approvedAt?: Date | null;
  };
};

const videosBucket = {
  put: mock(async () => undefined),
  get: mock(async () => null),
  delete: mock(async () => undefined),
};

const db = {
  insert: mock(() => ({
    values: mock(async () => undefined),
  })),
  select: mock(() => ({
    from: mock(() => ({
      where: mock(async () => []),
    })),
  })),
  delete: mock(() => ({
    where: mock(async () => undefined),
  })),
};

let currentSession: Session | null = null;

mock.module("@dubbed-i/api/context", () => ({
  createContext: mock(async () => ({
    auth: null,
    videosBucket,
    session: currentSession,
  })),
}));

mock.module("@dubbed-i/auth", () => ({
  ADMIN_EMAIL: "admin@mail.com",
  createAuth: () => ({
    handler: () => new Response("OK"),
  }),
}));

mock.module("@dubbed-i/db", () => ({
  createDb: () => db,
}));

mock.module("@dubbed-i/db/schema/uploaded-files", () => ({
  uploadedFile: {
    contentType: "contentType",
    originalFileName: "originalFileName",
    r2Key: "r2Key",
    sizeBytes: "sizeBytes",
    userId: "userId",
  },
}));

mock.module("@dubbed-i/env/server", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    CORS_ORIGIN: "http://localhost:3000",
    ADMIN_EMAIL: "admin@mail.com",
    VIDEOS_BUCKET: videosBucket,
  },
}));

mock.module("@hono/trpc-server", () => ({
  trpcServer: () => {
    const middleware = new Hono();
    middleware.use("*", async (_c, next) => {
      await next();
    });
    return middleware;
  },
}));

const { default: app } = await import("./index");

const allowedOrigin = "http://localhost:3000";

function createMutationHeaders(headers?: HeadersInit) {
  return new Headers({ Origin: allowedOrigin, ...headers });
}

function createRefererOnlyMutationHeaders(referer: string) {
  const headers = createMutationHeaders();
  headers.delete("Origin");
  headers.set("Referer", referer);
  return headers;
}

function createApprovedSession(): Session {
  return {
    user: {
      id: "user-1",
      role: "user",
      approvalStatus: "approved",
      approvedAt: new Date("2026-07-07T00:00:00.000Z"),
    },
  };
}

beforeEach(() => {
  currentSession = null;
  videosBucket.put.mockClear();
  videosBucket.get.mockClear();
  videosBucket.delete.mockClear();
  db.insert.mockClear();
  db.select.mockClear();
  db.delete.mockClear();
});

describe("video endpoints", () => {
  it("returns 401 for upload without a session", async () => {
    const response = await app.request("http://localhost/api/videos/upload", {
      method: "POST",
      body: new FormData(),
      headers: createMutationHeaders(),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Authentication required" });
  });

  it("returns 403 for upload with a non-approved session", async () => {
    currentSession = {
      user: {
        id: "user-1",
        role: "user",
        approvalStatus: "pending",
        approvedAt: null,
      },
    };

    const response = await app.request("http://localhost/api/videos/upload", {
      method: "POST",
      body: new FormData(),
      headers: createMutationHeaders(),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "Your account is not approved yet" });
  });

  it("returns 400 when languageCode is missing or unsupported", async () => {
    currentSession = createApprovedSession();

    const missingLanguageForm = new FormData();
    missingLanguageForm.set("video", new File(["video"], "clip.mp4", { type: "video/mp4" }));

    const missingLanguageResponse = await app.request("http://localhost/api/videos/upload", {
      method: "POST",
      body: missingLanguageForm,
      headers: createMutationHeaders(),
    });

    expect(missingLanguageResponse.status).toBe(400);
    expect(await missingLanguageResponse.json()).toEqual({
      message: "Select a supported dubbing language",
    });

    const unsupportedLanguageForm = new FormData();
    unsupportedLanguageForm.set("languageCode", "xx");
    unsupportedLanguageForm.set("video", new File(["video"], "clip.mp4", { type: "video/mp4" }));

    const unsupportedLanguageResponse = await app.request("http://localhost/api/videos/upload", {
      method: "POST",
      body: unsupportedLanguageForm,
      headers: createMutationHeaders(),
    });

    expect(unsupportedLanguageResponse.status).toBe(400);
    expect(await unsupportedLanguageResponse.json()).toEqual({
      message: "Select a supported dubbing language",
    });
  });

  it("returns 400 when video is missing", async () => {
    currentSession = createApprovedSession();

    const formData = new FormData();
    formData.set("languageCode", "hi-IN");

    const response = await app.request("http://localhost/api/videos/upload", {
      method: "POST",
      body: formData,
      headers: createMutationHeaders(),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "Select a video file to upload" });
  });

  it("returns 403 for upload without origin or referer", async () => {
    const response = await app.request("http://localhost/api/videos/upload", {
      method: "POST",
      body: new FormData(),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "Invalid request origin" });
    expect(videosBucket.put).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns 403 for upload with a wrong origin", async () => {
    const response = await app.request("http://localhost/api/videos/upload", {
      method: "POST",
      body: new FormData(),
      headers: createMutationHeaders({ Origin: "http://evil.example" }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "Invalid request origin" });
    expect(videosBucket.put).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("allows upload to proceed with a matching referer when origin is absent", async () => {
    const response = await app.request("http://localhost/api/videos/upload", {
      method: "POST",
      body: new FormData(),
      headers: createRefererOnlyMutationHeaders(`${allowedOrigin}/dashboard`),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Authentication required" });
  });

  it("returns 401 for delete without a session", async () => {
    const response = await app.request("http://localhost/api/videos?key=video-key", {
      method: "DELETE",
      headers: createMutationHeaders(),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Authentication required" });
  });

  it("returns 403 for delete without origin or referer", async () => {
    const response = await app.request("http://localhost/api/videos?key=video-key", {
      method: "DELETE",
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "Invalid request origin" });
    expect(videosBucket.delete).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("returns 403 for delete with a wrong origin", async () => {
    const response = await app.request("http://localhost/api/videos?key=video-key", {
      method: "DELETE",
      headers: createMutationHeaders({ Origin: "http://evil.example" }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "Invalid request origin" });
    expect(videosBucket.delete).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("allows delete to proceed with a matching referer when origin is absent", async () => {
    const response = await app.request("http://localhost/api/videos?key=video-key", {
      method: "DELETE",
      headers: createRefererOnlyMutationHeaders(`${allowedOrigin}/dashboard`),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Authentication required" });
  });

  it("returns 401 for download without a session", async () => {
    const response = await app.request("http://localhost/api/videos/download?key=video-key");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Authentication required" });
  });
});
