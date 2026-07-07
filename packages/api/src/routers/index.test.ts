/// <reference types="bun-types" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

type Session = {
  user: {
    id: string;
    email: string;
    role: "admin" | "user";
    approvalStatus: "approved" | "pending" | "rejected";
    approvedAt?: Date | null;
  };
  session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string | null | undefined;
    userAgent?: string | null | undefined;
  };
};

const dbState = {
  deleteResult: [] as any[],
  selectResults: [] as any[][],
  updateResult: [] as any[],
  lastApprovedSet: null as Record<string, unknown> | null,
};

const db = {
  select: mock(() => ({
    from: mock(() => ({
      orderBy: mock(async () => dbState.selectResults.shift() ?? []),
      where: mock(async () => dbState.selectResults.shift() ?? []),
    })),
  })),
  update: mock(() => ({
    set: mock((values: Record<string, unknown>) => {
      dbState.lastApprovedSet = values;

      return {
        where: mock(() => ({
          returning: mock(async () => dbState.updateResult),
        })),
      };
    }),
  })),
  delete: mock(() => ({
    where: mock(() => ({
      returning: mock(async () => dbState.deleteResult),
    })),
  })),
};

mock.module("@dubbed-i/db", () => ({
  createDb: () => db,
}));

const { appRouter } = await import("./index");

function createCaller(session: Session | null) {
  return appRouter.createCaller({
    auth: null,
    session: session as any,
    videosBucket: null as never,
  });
}

function createAdminSession(): Session {
  return {
    user: {
      id: "admin-user",
      email: "admin-operator@example.com",
      role: "admin",
      approvalStatus: "approved",
      approvedAt: new Date("2026-07-07T00:00:00.000Z"),
    },
    session: {
      id: "test-session",
      userId: "admin-user",
      token: "test-token",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

beforeEach(() => {
  dbState.deleteResult = [];
  dbState.selectResults = [];
  dbState.updateResult = [];
  dbState.lastApprovedSet = null;
  db.select.mockClear();
  db.update.mockClear();
  db.delete.mockClear();
});

describe("appRouter admin and session procedures", () => {
  it("requires a session for getMyAccountStatus", async () => {
    const caller = createCaller(null);

    await expect(caller.getMyAccountStatus()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  });

  it("requires admin access for listUsersForApproval", async () => {
    const caller = createCaller({
      user: {
        id: "user-1",
        email: "user@example.com",
        role: "user",
        approvalStatus: "approved",
        approvedAt: new Date("2026-07-07T00:00:00.000Z"),
      },
      session: {
        id: "test-session",
        userId: "user-1",
        token: "test-token",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await expect(caller.listUsersForApproval()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
    expect(db.select).not.toHaveBeenCalled();
  });

  it("rejects deleting the current user's own account", async () => {
    const caller = createCaller(createAdminSession());

    await expect(caller.deleteUser({ userId: "admin-user" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You cannot delete your own account",
    });
    expect(db.select).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("rejects deleting the last remaining admin account", async () => {
    dbState.selectResults = [
      [{ email: "admin@example.com", role: "admin" }],
      [{ id: "admin-user" }],
    ];

    const caller = createCaller(createAdminSession());

    await expect(caller.deleteUser({ userId: "user-2" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You cannot delete the last admin account",
    });
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("allows deleting an admin when another admin remains", async () => {
    dbState.selectResults = [
      [{ email: "admin-2@example.com", role: "admin" }],
      [{ id: "admin-user" }, { id: "admin-user-2" }],
    ];
    dbState.deleteResult = [
      {
        approvalStatus: "approved",
        approvedAt: new Date("2026-07-07T12:00:00.000Z"),
        email: "admin-2@example.com",
        id: "admin-user-2",
        name: "Admin Two",
        role: "admin",
      },
    ];

    const caller = createCaller(createAdminSession());
    const result = await caller.deleteUser({ userId: "admin-user-2" });

    expect(result).toEqual(dbState.deleteResult[0]);
  });

  it("deletes non-admin users without any hardcoded email checks", async () => {
    dbState.selectResults = [[{ email: "admin@mail.com", role: "user" }]];
    dbState.deleteResult = [
      {
        approvalStatus: "pending",
        approvedAt: null,
        email: "admin@mail.com",
        id: "user-2",
        name: "Not An Admin",
        role: "user",
      },
    ];

    const caller = createCaller(createAdminSession());
    const result = await caller.deleteUser({ userId: "user-2" });

    expect(result).toEqual(dbState.deleteResult[0]);
  });

  it("marks a found user as approved via the current update path", async () => {
    dbState.updateResult = [
      {
        approvalStatus: "approved",
        approvedAt: new Date("2026-07-07T12:00:00.000Z"),
        email: "user@example.com",
        id: "user-3",
        name: "User Three",
        role: "user",
      },
    ];

    const caller = createCaller(createAdminSession());
    const result = await caller.approveUser({ userId: "user-3" });

    expect(result).toEqual(dbState.updateResult[0]);
    expect(dbState.lastApprovedSet?.approvalStatus).toBe("approved");
    expect(dbState.lastApprovedSet?.approvedAt).toBeInstanceOf(Date);
  });
});
