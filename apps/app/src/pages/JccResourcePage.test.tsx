import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ApiClient } from "@tsuz/api";
import { App as AntApp } from "antd";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createMfeApiClient } from "../services/api-client";
import type {
  JccAdventureItem,
  JccGalaxyItem,
  JccHeroItem,
  JccListResponse,
  JccSnapshotMetadata
} from "../services/jcc-api";
import JccResourcePage, { type ResourceKey } from "./JccResourcePage";

vi.mock("../services/api-client", () => ({
  createMfeApiClient: vi.fn()
}));

const apiGet = vi.fn<ApiClient["get"]>();
const apiClient = { get: apiGet } as unknown as ApiClient;

const snapshot: JccSnapshotMetadata = {
  mode: "classic",
  mode_name: "经典模式",
  season: "S15",
  version: "15.1",
  revision: 7,
  content_hash: "hash-for-test",
  source_updated_at: "2026-09-15T00:00:00Z"
};

const hero: JccHeroItem = {
  id: "hero.yasuo",
  name: "亚索",
  price: 1,
  hero_type: "melee",
  map_id: 11,
  health: 650,
  attack_damage: 55,
  armor: 35,
  magic_resist: 30,
  attack_speed: 0.75,
  attack_range: 1,
  initial_mana: 20,
  max_mana: 80,
  skill_name: "斩钢闪",
  skill_description: "向前突刺并造成伤害。",
  skill_values: { damage: "100", duration: "2" },
  image_url: "https://assets.example.test/yasuo.png",
  skill_icon_url: "https://assets.example.test/yasuo-skill.png",
  traits: [{ id: "trait.ionia", name: "艾欧尼亚", kind: "race" }],
  classes: [{ id: "class.duelist", name: "决斗大师", kind: "job" }]
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createMfeApiClient).mockReturnValue(apiClient);
  apiGet.mockResolvedValue(listResponse([hero], 45));
});

afterEach(() => {
  cleanup();
});

describe("JccResourcePage queries", () => {
  test("maps page and applied hero filters to limit and offset", async () => {
    renderPage("heroes");

    await waitFor(() =>
      expect(apiGet).toHaveBeenLastCalledWith("/jcc/heroes", {
        query: { limit: 20, offset: 0 }
      })
    );
    await screen.findByText("亚索");

    fireEvent.click(screen.getByTitle("2"));
    await waitFor(() =>
      expect(apiGet).toHaveBeenLastCalledWith("/jcc/heroes", {
        query: { limit: 20, offset: 20 }
      })
    );

    const keywordInput = screen.getByPlaceholderText("搜索名称");
    fireEvent.change(keywordInput, { target: { value: "亚索" } });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "0" } });
    fireEvent.keyDown(keywordInput, { key: "Enter", code: "Enter", charCode: 13 });

    await waitFor(() =>
      expect(apiGet).toHaveBeenLastCalledWith("/jcc/heroes", {
        query: { limit: 20, offset: 0, name: "亚索", price: 0 }
      })
    );
    expect(screen.getByTitle("1")).toHaveClass("ant-pagination-item-active");
  });

  test("returns to the last valid page when total shrinks", async () => {
    apiGet.mockImplementation((_, options) => {
      const offset = options?.query?.offset;

      if (offset === 40) {
        return Promise.resolve(listResponse([], 20));
      }

      return Promise.resolve(listResponse([hero], offset === 0 && apiGet.mock.calls.length > 2 ? 20 : 45));
    });
    renderPage("heroes");
    await screen.findByText("亚索");

    fireEvent.click(screen.getByTitle("3"));

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/jcc/heroes", {
        query: { limit: 20, offset: 40 }
      })
    );
    await waitFor(() => expect(screen.getByTitle("1")).toHaveClass("ant-pagination-item-active"));
    await waitFor(() =>
      expect(apiGet).toHaveBeenLastCalledWith("/jcc/heroes", {
        query: { limit: 20, offset: 0 }
      })
    );
  });

  test("hides stale snapshot, totals, results, and pagination after a failed refetch", async () => {
    const { queryClient } = renderPage("heroes");

    expect(await screen.findByText("经典模式")).toBeInTheDocument();
    expect(screen.getByText("亚索")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();

    apiGet.mockRejectedValueOnce(Object.assign(new Error("unavailable"), { status: 503 }));
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["jcc", "heroes"] });
    });

    expect(await screen.findByText("JCC 资料暂不可用")).toBeInTheDocument();
    expect(screen.getByText("资料快照暂不可用")).toBeInTheDocument();
    expect(screen.queryByText("经典模式")).not.toBeInTheDocument();
    expect(screen.queryByText("亚索")).not.toBeInTheDocument();
    expect(screen.queryByText("45")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});

describe("JccResourcePage details", () => {
  test("shows all hero combat, trait, skill, and media fields", async () => {
    renderPage("heroes");

    fireEvent.click(await screen.findByRole("button", { name: "查看亚索详情" }));

    expect(await screen.findByText("hero.yasuo")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("650 / 55")).toBeInTheDocument();
    expect(screen.getByText("35 / 30")).toBeInTheDocument();
    expect(screen.getByText("0.75 / 1")).toBeInTheDocument();
    expect(screen.getByText("20 / 80")).toBeInTheDocument();
    expect(screen.getByText("艾欧尼亚（trait.ionia · race）")).toBeInTheDocument();
    expect(screen.getByText("决斗大师（class.duelist · job）")).toBeInTheDocument();
    expect(screen.getByText("damage：100")).toBeInTheDocument();
    expect(screen.getByText("duration：2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开英雄图片" })).toHaveAttribute("href", hero.image_url);
    expect(screen.getByRole("link", { name: "打开技能图标" })).toHaveAttribute("href", hero.skill_icon_url);
  });

  test.each([
    {
      resource: "adventures" as const,
      title: "特殊机制",
      item: {
        id: "mechanic.loot",
        title: "战利品订阅",
        description: "每个阶段提供额外战利品。",
        price: 3,
        category: "economy",
        logo_url: "https://assets.example.test/mechanic-logo.png",
        video_url: "https://assets.example.test/mechanic-video.mp4",
        background_image_url: "https://assets.example.test/mechanic-background.png"
      } satisfies JccAdventureItem,
      path: "/jcc/adventures"
    },
    {
      resource: "galaxies" as const,
      title: "传送门",
      item: {
        id: "portal.crab",
        name: "迅捷蟹水潭",
        description: "带来特殊战斗效果。",
        logo_url: "https://assets.example.test/portal-logo.png",
        video_url: "https://assets.example.test/portal-video.mp4",
        background_image_url: "https://assets.example.test/portal-background.png"
      } satisfies JccGalaxyItem,
      path: "/jcc/galaxies"
    }
  ])("shows all $title media links from the list item", async ({ resource, title, item, path }) => {
    apiGet.mockResolvedValue(listResponse([item], 1));
    renderPage(resource, title);

    const itemTitle = "title" in item ? item.title : item.name;
    fireEvent.click(await screen.findByRole("button", { name: `查看${itemTitle}详情` }));

    expect(apiGet).toHaveBeenCalledWith(path, { query: { limit: 20, offset: 0 } });
    expect(await screen.findByText(item.id)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开标志图片" })).toHaveAttribute("href", item.logo_url);
    expect(screen.getByRole("link", { name: "打开背景图片" })).toHaveAttribute("href", item.background_image_url);
    expect(screen.getByRole("link", { name: "打开视频" })).toHaveAttribute("href", item.video_url);
  });
});

function renderPage(resource: ResourceKey, title = "英雄") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0
      }
    }
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <JccResourcePage resource={resource} title={title} description="测试资料页面" />
      </AntApp>
    </QueryClientProvider>
  );

  return { ...result, queryClient };
}

function listResponse<T>(items: T[], total: number): JccListResponse<T> {
  return {
    snapshot,
    items,
    total,
    limit: 20,
    offset: 0
  };
}
