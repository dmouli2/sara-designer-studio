import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFabrics, createFabric, updateFabric, deleteFabric } from "./fabrics";
import { requireRole } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { mockRevalidatePath } from "../../../vitest.setup";
import type { Fabric } from "@/lib/db";

vi.mock("@/lib/dal", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

const silk: Fabric = { id: "f1", name: "Silk", price: 350 };

describe("fabric actions", () => {
  const list = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const del = vi.fn();

  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    list.mockReset().mockResolvedValue([silk]);
    create.mockReset().mockResolvedValue(silk);
    update.mockReset().mockResolvedValue(silk);
    del.mockReset().mockResolvedValue(undefined);
    vi.mocked(getDb).mockReturnValue({ fabrics: { list, create, update, delete: del } } as never);
  });

  it("getFabrics requires the admin role and returns the list", async () => {
    expect(await getFabrics()).toEqual([silk]);
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
  });

  it("createFabric trims the name, saves, and revalidates the wizard page", async () => {
    const result = await createFabric({ name: "  Organza ", price: 260 });
    expect(create).toHaveBeenCalledWith({ name: "Organza", price: 260 });
    expect(result).toEqual({ fabric: silk });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/orders/new");
  });

  it("createFabric rejects an empty name without touching the db", async () => {
    expect(await createFabric({ name: "   ", price: 100 })).toEqual({ error: "Enter a fabric name." });
    expect(create).not.toHaveBeenCalled();
  });

  it("createFabric rejects a negative or non-finite price", async () => {
    expect((await createFabric({ name: "Organza", price: -5 })).error).toMatch(/valid price/);
    expect((await createFabric({ name: "Organza", price: NaN })).error).toMatch(/valid price/);
    expect(create).not.toHaveBeenCalled();
  });

  it("createFabric maps a unique-constraint failure to a friendly message", async () => {
    create.mockRejectedValue(new Error('duplicate key value violates unique constraint "fabrics_name_key"'));
    expect(await createFabric({ name: "Silk", price: 350 })).toEqual({
      error: "A fabric with this name already exists.",
    });
  });

  it("createFabric maps other db failures to a generic connection message", async () => {
    create.mockRejectedValue(new Error("connection reset"));
    expect((await createFabric({ name: "Silk", price: 350 })).error).toMatch(/Couldn't add the fabric/);
  });

  it("updateFabric applies a partial patch and revalidates", async () => {
    const result = await updateFabric("f1", { price: 380 });
    expect(update).toHaveBeenCalledWith("f1", { price: 380 });
    expect(result).toEqual({ fabric: silk });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/orders/new");
  });

  it("updateFabric trims a renamed fabric", async () => {
    await updateFabric("f1", { name: " Pure Silk " });
    expect(update).toHaveBeenCalledWith("f1", { name: "Pure Silk" });
  });

  it("updateFabric rejects invalid values without touching the db", async () => {
    expect((await updateFabric("f1", { name: " " })).error).toBe("Enter a fabric name.");
    expect((await updateFabric("f1", { price: Infinity })).error).toMatch(/valid price/);
    expect(update).not.toHaveBeenCalled();
  });

  it("updateFabric maps a duplicate rename to a friendly message", async () => {
    update.mockRejectedValue(new Error("duplicate key value violates unique constraint"));
    expect((await updateFabric("f1", { name: "Cotton" })).error).toBe(
      "A fabric with this name already exists."
    );
  });

  it("updateFabric maps other db failures to a generic save message", async () => {
    update.mockRejectedValue(new Error("connection reset"));
    expect((await updateFabric("f1", { price: 400 })).error).toMatch(/Couldn't save the fabric/);
  });

  it("deleteFabric removes the fabric and revalidates", async () => {
    expect(await deleteFabric("f1")).toEqual({});
    expect(del).toHaveBeenCalledWith("f1");
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/orders/new");
  });

  it("deleteFabric reports a failure instead of throwing", async () => {
    del.mockRejectedValue(new Error("connection reset"));
    expect((await deleteFabric("f1")).error).toMatch(/Couldn't delete the fabric/);
  });
});
