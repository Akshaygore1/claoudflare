/// <reference types="bun-types" />

import { describe, expect, it, mock } from "bun:test";

mock.module("@dubbed-i/env/server", () => ({
  env: {
    ADMIN_EMAIL: "admin@example.com",
  },
}));

import { getNewUserDefaults } from "./user-defaults";

describe("auth user defaults", () => {
  it("returns pending non-admin defaults", () => {
    expect(getNewUserDefaults()).toEqual({
      role: "user",
      approvalStatus: "pending",
      approvedAt: null,
    });
  });

  it("returns admin defaults for the configured admin email", () => {
    const defaults = getNewUserDefaults("admin@example.com");
    expect(defaults.role).toBe("admin");
    expect(defaults.approvalStatus).toBe("approved");
    expect(defaults.approvedAt).toBeInstanceOf(Date);
  });
});
