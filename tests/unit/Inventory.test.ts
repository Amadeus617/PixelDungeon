import { describe, it, expect, beforeEach } from "vitest";
import { Inventory } from "@/systems/Inventory";

describe("Inventory", () => {
  let inventory: Inventory;

  beforeEach(() => {
    inventory = new Inventory();
  });

  // --- add / has ---
  describe("add & has", () => {
    it("starts empty – has() returns false for any item", () => {
      expect(inventory.has("key")).toBe(false);
      expect(inventory.has("potion")).toBe(false);
    });

    it("has() returns true after add()", () => {
      inventory.add("key");
      expect(inventory.has("key")).toBe(true);
    });

    it("adding the same item twice does not duplicate it", () => {
      inventory.add("key");
      inventory.add("key");
      expect(inventory.getAll()).toEqual(["key"]);
    });

    it("tracks multiple different items independently", () => {
      inventory.add("key");
      inventory.add("potion");
      expect(inventory.has("key")).toBe(true);
      expect(inventory.has("potion")).toBe(true);
      expect(inventory.has("sword")).toBe(false);
    });
  });

  // --- remove ---
  describe("remove", () => {
    it("returns true when removing an existing item", () => {
      inventory.add("key");
      expect(inventory.remove("key")).toBe(true);
      expect(inventory.has("key")).toBe(false);
    });

    it("returns false when removing a non-existent item", () => {
      expect(inventory.remove("key")).toBe(false);
    });

    it("can remove one item without affecting others", () => {
      inventory.add("key");
      inventory.add("potion");
      inventory.remove("key");
      expect(inventory.has("key")).toBe(false);
      expect(inventory.has("potion")).toBe(true);
    });

    it("removing the same item twice: first true, second false", () => {
      inventory.add("key");
      expect(inventory.remove("key")).toBe(true);
      expect(inventory.remove("key")).toBe(false);
    });
  });

  // --- getAll ---
  describe("getAll", () => {
    it("returns empty array when nothing added", () => {
      expect(inventory.getAll()).toEqual([]);
    });

    it("returns all added items", () => {
      inventory.add("key");
      inventory.add("potion");
      inventory.add("gem");
      const items = inventory.getAll();
      expect(items.sort()).toEqual(["gem", "key", "potion"]);
    });
  });

  // --- clear ---
  describe("clear", () => {
    it("removes all items", () => {
      inventory.add("key");
      inventory.add("potion");
      inventory.clear();
      expect(inventory.getAll()).toEqual([]);
      expect(inventory.has("key")).toBe(false);
    });

    it("clear on empty inventory is a no-op", () => {
      inventory.clear();
      expect(inventory.getAll()).toEqual([]);
    });
  });

  // --- integration scenario ---
  describe("Game flow scenario", () => {
    it("collect key, check, use key to open chest, verify key consumed", () => {
      // Player picks up key
      inventory.add("key");
      expect(inventory.has("key")).toBe(true);

      // Player opens chest – consumes key
      const hasKey = inventory.has("key");
      expect(hasKey).toBe(true);
      inventory.remove("key");
      expect(inventory.has("key")).toBe(false);
    });

    it("collecting multiple keys still shows as having key", () => {
      inventory.add("key");
      inventory.add("key");
      expect(inventory.has("key")).toBe(true);
      inventory.remove("key");
      // After one remove, key is gone (Set behavior)
      expect(inventory.has("key")).toBe(false);
    });
  });
});
