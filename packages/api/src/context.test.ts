/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import { createContextValue } from "./context-value";

describe("createContextValue", () => {
  it("returns Better Auth session data without rewriting roles or approval state", () => {
    const session = {
      session: { id: "session-1" },
      user: {
        id: "user-1",
        email: "admin@mail.com",
        role: "user",
        approvalStatus: "pending",
        approvedAt: null,
      },
    };
    const videosBucket = { bucket: true } as any as R2Bucket;

    expect(createContextValue(session, videosBucket)).toEqual({
      auth: null,
      session,
      videosBucket,
    });
  });
});
