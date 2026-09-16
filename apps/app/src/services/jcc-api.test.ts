import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ApiClient } from "@tsuz/api";
import {
  listJccAdventures,
  listJccAugments,
  listJccEquipment,
  listJccGalaxies,
  listJccHeroes,
  listJccTraits
} from "./jcc-api";

const client = { get: vi.fn() } as unknown as ApiClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(client.get).mockResolvedValue({});
});

describe("JCC API", () => {
  test("maps hero filters and pagination to the JCC contract", async () => {
    await listJccHeroes(client, { limit: 20, offset: 40, name: "亚", trait_id: "trait.one", price: 3 });

    expect(client.get).toHaveBeenCalledWith("/jcc/heroes", {
      query: { limit: 20, offset: 40, name: "亚", trait_id: "trait.one", price: 3 }
    });
  });

  test.each([
    [listJccTraits, "/jcc/traits", { kind: "race" as const }],
    [listJccEquipment, "/jcc/equipment", { type: "装备" }],
    [listJccAugments, "/jcc/augments", { level: 2 }],
    [listJccAdventures, "/jcc/adventures", { price: 5 }],
    [listJccGalaxies, "/jcc/galaxies", { name: "传送" }]
  ])("uses the %s endpoint", async (list, path, filter) => {
    await (list as unknown as (api: ApiClient, params: Record<string, unknown>) => Promise<unknown>)(client, {
      limit: 20,
      offset: 0,
      ...filter
    });

    expect(client.get).toHaveBeenCalledWith(path, { query: { limit: 20, offset: 0, ...filter } });
  });

  test("does not send empty optional filters", async () => {
    await listJccGalaxies(client, { limit: 20, offset: 0, name: "" });

    expect(client.get).toHaveBeenCalledWith("/jcc/galaxies", { query: { limit: 20, offset: 0 } });
  });

  test("preserves zero-valued numeric filters", async () => {
    await listJccHeroes(client, { limit: 20, offset: 0, price: 0 });

    expect(client.get).toHaveBeenCalledWith("/jcc/heroes", {
      query: { limit: 20, offset: 0, price: 0 }
    });
  });
});
