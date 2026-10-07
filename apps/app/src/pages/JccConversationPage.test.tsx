import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ApiClient } from "@tsuz/api";
import { App as AntApp } from "antd";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createMfeApiClient } from "../services/api-client";
import type {
  JccAgentConversation,
  JccAgentListResponse,
  JccAgentMessage,
  JccAgentStreamOptions
} from "../services/jcc-agent-api";
import { cancelJccAgentMessage, streamJccAgentMessageEvents } from "../services/jcc-agent-api";
import JccConversationPage from "./JccConversationPage";

vi.mock("../services/api-client", () => ({
  createMfeApiClient: vi.fn()
}));

vi.mock("../services/jcc-agent-api", async () => {
  const actual = await vi.importActual<typeof import("../services/jcc-agent-api")>("../services/jcc-agent-api");
  return {
    ...actual,
    cancelJccAgentMessage: vi.fn(),
    streamJccAgentMessageEvents: vi.fn()
  };
});

const apiGet = vi.fn<ApiClient["get"]>();
const apiPost = vi.fn<ApiClient["post"]>();
const apiClient = { get: apiGet, post: apiPost, rawRequest: vi.fn() } as unknown as ApiClient;
const streamMock = vi.mocked(streamJccAgentMessageEvents);
const cancelMock = vi.mocked(cancelJccAgentMessage);
const conversation: JccAgentConversation = {
  id: "conversation-1",
  title: "上分计划",
  strategy_mode: "operation",
  status: "active",
  created_at: "2026-10-07T08:00:00Z",
  updated_at: "2026-10-07T09:00:00Z"
};
const currentMessages = [
  createMessage({ id: "message-2", role: "user", content: "请分析", sequence: 2 }),
  createMessage({ id: "message-3", role: "assistant", content: "分析结果", sequence: 3 })
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createMfeApiClient).mockReturnValue(apiClient);
  streamMock.mockResolvedValue(undefined);
  cancelMock.mockResolvedValue(undefined);
  apiPost.mockResolvedValue(createMessage({ id: "message-4", role: "user", content: "新问题" }));
  apiGet.mockImplementation((path) => {
    if (String(path).endsWith("/messages")) {
      return Promise.resolve(createMessagePage(currentMessages, currentMessages.length, 0));
    }
    return Promise.resolve(conversation);
  });
});

afterEach(() => cleanup());

describe("JccConversationPage", () => {
  test("loads conversation detail and the first message page", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "上分计划" })).toBeInTheDocument();
    expect(screen.getByText("运营 · active")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "消息历史" })).not.toBeInTheDocument();
    expect(document.querySelector(".ant-descriptions-view")).not.toBeInTheDocument();
    expect(await screen.findByText("请分析")).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith("/jcc/agent/conversations/conversation-1");
    expect(apiGet).toHaveBeenCalledWith("/jcc/agent/conversations/conversation-1/messages", {
      query: { limit: 20, offset: 0 }
    });
    expect(screen.getByRole("textbox", { name: "输入问题" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("会话风格")[0]).toHaveTextContent("运营");
    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
    expect(apiGet.mock.calls.some(([path]) => String(path).includes("/events"))).toBe(false);
    expect(apiGet.mock.calls.some(([path]) => String(path).includes("/cancel"))).toBe(false);
  });

  test("renders streamed text and completed state", async () => {
    let options!: JccAgentStreamOptions;
    streamMock.mockImplementation(async (_client, _conversationId, _messageId, streamOptions) => {
      options = streamOptions;
      streamOptions.onEvent({ id: "event-1", type: "text.delta", data: { text: "实时回答" } });
      streamOptions.onEvent({ id: "event-2", type: "heartbeat", data: {} });
      streamOptions.onEvent({ id: "event-3", type: "message.completed", data: {} });
    });
    renderPage();
    await screen.findByText("请分析");
    fireEvent.change(screen.getByRole("textbox", { name: "输入问题" }), { target: { value: "新问题" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("实时回答")).toBeInTheDocument();
    expect(screen.getByText("实时回答")).toBeInTheDocument();
    expect(options.lastEventId).toBeUndefined();
    expect(screen.queryByText(/heartbeat/)).not.toBeInTheDocument();
  });

  test("cancels a running stream and aborts its signal", async () => {
    let options!: JccAgentStreamOptions;
    streamMock.mockImplementation(async (_client, _conversationId, _messageId, streamOptions) => {
      options = streamOptions;
      await new Promise(() => undefined);
    });
    renderPage();
    await screen.findByText("请分析");
    fireEvent.change(screen.getByRole("textbox", { name: "输入问题" }), { target: { value: "新问题" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    fireEvent.click(await screen.findByRole("button", { name: "停止" }));

    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith(apiClient, "conversation-1", "message-4"));
    expect(options.signal?.aborted).toBe(true);
    expect(screen.queryByText("已完成")).not.toBeInTheDocument();
  });

  test("reconnects after a dropped stream with the last event id", async () => {
    let call = 0;
    let firstOptions!: JccAgentStreamOptions;
    let secondOptions!: JccAgentStreamOptions;
    streamMock.mockImplementation(async (_client, _conversationId, _messageId, streamOptions) => {
      call += 1;
      if (call === 1) {
        firstOptions = streamOptions;
        streamOptions.onEvent({ id: "event-7", type: "text.delta", data: { text: "部分" } });
        return;
      }
      secondOptions = streamOptions;
      streamOptions.onEvent({ id: "event-8", type: "text.delta", data: { text: "完成" } });
      streamOptions.onEvent({ id: "event-9", type: "message.completed", data: {} });
    });
    renderPage();
    await screen.findByText("请分析");
    fireEvent.change(screen.getByRole("textbox", { name: "输入问题" }), { target: { value: "新问题" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(await screen.findByText("部分")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "重新连接" }));

    await waitFor(() => expect(call).toBe(2));
    expect(firstOptions.lastEventId).toBeUndefined();
    expect(secondOptions.lastEventId).toBe("event-7");
    expect(await screen.findByText("部分完成")).toBeInTheDocument();
  });

  test("does not append a duplicate event id", async () => {
    streamMock.mockImplementation(async (_client, _conversationId, _messageId, streamOptions) => {
      streamOptions.onEvent({ id: "same", type: "text.delta", data: { text: "一次" } });
      streamOptions.onEvent({ id: "same", type: "text.delta", data: { text: "重复" } });
    });
    renderPage();
    await screen.findByText("请分析");
    fireEvent.change(screen.getByRole("textbox", { name: "输入问题" }), { target: { value: "新问题" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("一次")).toBeInTheDocument();
    expect(screen.queryByText("一次重复")).not.toBeInTheDocument();
  });

  test("loads an earlier offset page and merges messages in display order", async () => {
    apiGet.mockImplementation((path, options) => {
      if (!String(path).endsWith("/messages")) return Promise.resolve(conversation);
      const offset = (options as { query?: { offset?: number } })?.query?.offset ?? 0;
      return Promise.resolve(
        offset === 0
          ? createMessagePage(currentMessages, 3, 0)
          : createMessagePage(
              [createMessage({ id: "message-1", role: "assistant", content: "更早回复", sequence: 1 })],
              3,
              20
            )
      );
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "加载更早消息" }));

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/jcc/agent/conversations/conversation-1/messages", {
        query: { limit: 20, offset: 20 }
      })
    );
    expect(await screen.findByText("更早回复")).toBeInTheDocument();
    const contents = screen
      .getAllByText(/更早回复|请分析|分析结果/)
      .map((element) => element.textContent);
    expect(contents).toEqual(["更早回复", "请分析", "分析结果"]);
    expect(screen.getByText("已加载全部历史")).toBeInTheDocument();
  });

  test("shows an independent message error and retries without hiding detail", async () => {
    let messageAttempts = 0;
    apiGet.mockImplementation((path) => {
      if (!String(path).endsWith("/messages")) return Promise.resolve(conversation);
      messageAttempts += 1;
      return messageAttempts === 1
        ? Promise.reject(new Error("消息不可用"))
        : Promise.resolve(createMessagePage(currentMessages, currentMessages.length, 0));
    });
    renderPage();

    expect(await screen.findByRole("heading", { name: "上分计划" })).toBeInTheDocument();
    expect(await screen.findByText("消息历史加载失败")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新加载消息" }));
    expect(await screen.findByText("请分析")).toBeInTheDocument();
    expect(messageAttempts).toBe(2);
  });

  test("shows the detail error and retries", async () => {
    let detailAttempts = 0;
    apiGet.mockImplementation((path) => {
      if (String(path).endsWith("/messages")) {
        return Promise.resolve(createMessagePage(currentMessages, currentMessages.length, 0));
      }
      detailAttempts += 1;
      return detailAttempts === 1 ? Promise.reject(new Error("详情不可用")) : Promise.resolve(conversation);
    });
    renderPage();

    expect(await screen.findByText("详情不可用")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByRole("heading", { name: "上分计划" })).toBeInTheDocument();
    expect(detailAttempts).toBe(2);
  });

  test("sends a trimmed question with the selected strategy", async () => {
    renderPage();
    await screen.findByText("请分析");

    const input = screen.getByRole("textbox", { name: "输入问题" });
    fireEvent.change(input, { target: { value: "  新问题  " } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/jcc/agent/conversations/conversation-1/messages",
        expect.objectContaining({ content: "新问题", strategy_mode: "operation" })
      )
    );
    expect(input).toHaveValue("");
  });
});

function createMessage(overrides: Partial<JccAgentMessage>): JccAgentMessage {
  return {
    id: "message-1",
    conversation_id: "conversation-1",
    role: "assistant",
    content: "消息内容",
    created_at: "2026-10-07T08:01:00Z",
    ...overrides
  };
}

function createMessagePage(
  items: JccAgentMessage[],
  total: number,
  offset: number
): JccAgentListResponse<JccAgentMessage> {
  return { items, total, limit: 20, offset };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={["/jcc/conversation/conversation-1"]}>
          <Routes>
            <Route path="/jcc/conversation/:conversationId" element={<JccConversationPage />} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );
}
