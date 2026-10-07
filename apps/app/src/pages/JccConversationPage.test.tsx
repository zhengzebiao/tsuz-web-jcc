import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ApiClient } from "@tsuz/api";
import { App as AntApp } from "antd";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createMfeApiClient } from "../services/api-client";
import type { JccAgentConversation } from "../services/jcc-agent-api";
import JccConversationPage from "./JccConversationPage";

vi.mock("../services/api-client", () => ({
  createMfeApiClient: vi.fn()
}));

const apiGet = vi.fn<ApiClient["get"]>();
const apiClient = { get: apiGet } as unknown as ApiClient;
const conversation: JccAgentConversation = {
  id: "conversation-1",
  title: "上分计划",
  strategy_mode: "operation",
  status: "active",
  created_at: "2026-10-07T08:00:00Z",
  updated_at: "2026-10-07T09:00:00Z"
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createMfeApiClient).mockReturnValue(apiClient);
  apiGet.mockResolvedValue(conversation);
});

afterEach(() => cleanup());

describe("JccConversationPage", () => {
  test("loads only the conversation detail for the route parameter", async () => {
    renderPage();

    expect(await screen.findByText("上分计划")).toBeInTheDocument();
    expect(screen.getByText("运营")).toBeInTheDocument();
    expect(screen.getByText("消息历史与实时问答将在后续阶段接入。")).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet).toHaveBeenCalledWith("/jcc/agent/conversations/conversation-1");
    expect(apiGet.mock.calls.some(([path]) => String(path).includes("/messages"))).toBe(false);
    expect(screen.queryByRole("button", { name: /发送|停止/ })).not.toBeInTheDocument();
  });

  test("shows the detail error and retries", async () => {
    apiGet.mockRejectedValueOnce(new Error("详情不可用")).mockResolvedValueOnce(conversation);
    renderPage();

    expect(await screen.findByText("详情不可用")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByText("上分计划")).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  test("returns to the conversation list", async () => {
    renderPage();
    await screen.findByText("上分计划");

    fireEvent.click(screen.getByRole("button", { name: "返回会话列表" }));

    await waitFor(() => expect(screen.getByTestId("current-path")).toHaveTextContent("/jcc/conversations"));
  });
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={["/jcc/conversation/conversation-1"]}>
          <Routes>
            <Route path="/jcc/conversation/:conversationId" element={<JccConversationPage />} />
            <Route path="/jcc/conversations" element={<div>会话列表页</div>} />
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
