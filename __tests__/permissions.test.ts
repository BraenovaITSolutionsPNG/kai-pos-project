import { describe, it, expect } from "vitest";
import { canAccess } from "../lib/permissions";

describe("permissions", () => {
  it("owner can access all routes", () => {
    expect(canAccess("owner", "/dashboard")).toBe(true);
    expect(canAccess("owner", "/pos")).toBe(true);
    expect(canAccess("owner", "/admin")).toBe(false); // admin is separate
  });

  it("cashier can only access limited routes", () => {
    expect(canAccess("cashier", "/pos")).toBe(true);
    expect(canAccess("cashier", "/products")).toBe(false);
    expect(canAccess("cashier", "/settings")).toBe(false);
  });

  it("kitchen can access kitchen and orders", () => {
    expect(canAccess("kitchen", "/kitchen")).toBe(true);
    expect(canAccess("kitchen", "/orders")).toBe(true);
    expect(canAccess("kitchen", "/pos")).toBe(false);
  });
});

