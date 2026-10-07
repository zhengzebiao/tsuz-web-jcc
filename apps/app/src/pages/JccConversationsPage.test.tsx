import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ApiClient } from "@tsuz/api";
import { App as AntApp } from "antd";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createMfeApiClient } from "../services/api-client";
import type { JccAgentConversation, JccAgentListResponse } from "../services/jcc-agent-api";
import JccConversationsPage from "./JccConversationsPage";

vi.mock("../services/api-client", () => ({
  createMfeApiClient: vi.fn()
}));

const apiGet = vi.fn<ApiClient["get"]>();
const apiPost = vi.fn<ApiClient["post"]>();
const apiClient = { get: apiGet, post: apiPost } as unknown as ApiClient;
const conversation: JccAgentConversation = {
  id: "conversation-1",
  title: "上分计划",
  strategy_mode: "gamble",
  status: "active",
  created_at: "2026-10-07T08:00:00Z",
  updated_at: "2026-10-07T09:00:00Z"
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createMfeApiClient).mockReturnValue(apiClient);
  apiGet.mockResolvedValue(listResponse([conversation], 45));
  apiPost.mockResolvedValue(conversation);
});

afterEach(() => cleanup());

describe("JccConversationsPage", () => {
  test("loads the conversation list and maps the second page to offset 20", async () => {
    renderPage();

    expect(await screen.findByText("上分计划")).toBeInTheDocument();
    expect(screen.getByText("赌狗")).toBeInTheDocument();
    expect(screen.getByText("活跃")).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith("/jcc/agent/conversations", {
      query: { limit: 20, offset: 0 }
    });

    fireEvent.click(screen.getByTitle("2"));

    await waitFor(() =>
      expect(apiGet).toHaveBeenLastCalledWith("/jcc/agent/conversations", {
        query: { limit: 20, offset: 20 }
      })
    );
  });

  test("shows the empty and error states", async () => {
    apiGet.mockResolvedValueOnce(listResponse([], 0));
    const first = renderPage();
    expect(await screen.findByText("暂无会话")).toBeInTheDocument();
    first.unmount();

    apiGet.mockRejectedValueOnce(new Error("会话服务不可用"));
    renderPage();
    expect(await screen.findByText("会话服务不可用")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
  });

  test("creates with the gamble default and navigates to the returned conversation", async () => {
    renderPage();
    await screen.findByText("上分计划");

    fireEvent.click(screen.getByRole("button", { name: "新建会话" }));
    const dialog = await screen.findByRole("dialog", { name: "新建会话" });
    expect(within(dialog).getByText("赌狗")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "会话标题" }), {
      target: { value: "  冲分复盘  " }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith("/jcc/agent/conversations", {
        title: "冲分复盘",
        strategy_mode: "gamble"
      })
    );
    await waitFor(() =>
      expect(screen.getByTestId("current-path")).toHaveTextContent("/jcc/conversation/conversation-1")
    );
  });

  test("keeps the modal open and reports a create failure", async () => {
    apiPost.mockRejectedValueOnce(new Error("创建失败"));
    renderPage();
    await screen.findByText("上分计划");

    fireEvent.click(screen.getByRole("button", { name: "新建会话" }));
    let dialog = await screen.findByRole("dialog", { name: "新建会话" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "会话标题" }), {
      target: { value: "失败用例" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));

    expect(await screen.findByText("创建失败")).toBeInTheDocument();
    dialog = screen.getByRole("dialog", { name: "新建会话" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/jcc/conversations");
  });

  test("validates an empty title before creating", async () => {
    renderPage();
    await screen.findByText("上分计划");

    fireEvent.click(screen.getByRole("button", { name: "新建会话" }));
    const dialog = await screen.findByRole("dialog", { name: "新建会话" });
    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));

    expect(await within(dialog).findByText("请输入会话标题")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={["/jcc/conversations"]}>
          <Routes>
            <Route path="/jcc/conversations" element={<JccConversationsPage />} />
            <Route path="/jcc/conversation/:conversationId" element={<div>会话目标页</div>} />
          </Routes>
          <RouteProbe />
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );
}

function RouteProbe() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}</output>;
}

function listResponse(items: JccAgentConversation[], total: number): JccAgentListResponse<JccAgentConversation> {
  return { items, total, limit: 20, offset: 0 };
}
