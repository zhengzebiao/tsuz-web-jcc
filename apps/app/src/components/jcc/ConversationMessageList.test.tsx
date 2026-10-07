import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  groupConversationMessages,
  sortConversationMessages
} from "./ConversationMessageList";
import ConversationMessageList from "./ConversationMessageList";
import type { JccAgentMessage } from "../../services/jcc-agent-api";

function message(overrides: Partial<JccAgentMessage>): JccAgentMessage {
  return {
    id: "message-1",
    conversation_id: "conversation-1",
    role: "assistant",
    content: "内容",
    created_at: "2026-10-07T09:00:00Z",
    ...overrides
  };
}

afterEach(() => cleanup());

describe("ConversationMessageList", () => {
  test("renders user on the right and assistant on the left without role labels", () => {
    render(
      <ConversationMessageList
        messages={[message({ id: "user-1", role: "user", content: "提问" }), message({ id: "assistant-1" })]}
        isInitialLoading={false}
        isLoadingPrevious={false}
        hasPreviousPage={false}
        onLoadPrevious={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText("提问").closest(".jcc-conversation-message-row")).toHaveClass(
      "jcc-conversation-message-row--user"
    );
    expect(screen.getByText("内容").closest(".jcc-conversation-message-row")).toHaveClass(
      "jcc-conversation-message-row--assistant"
    );
    expect(document.querySelector(".jcc-conversation-role")).not.toBeInTheDocument();
  });

  test("renders assistant markdown while keeping user content as plain text", () => {
    render(
      <ConversationMessageList
        messages={[
          message({
            id: "assistant-markdown",
            role: "assistant",
            content: "# 标题\n\n**加粗**\n\n- 第一项"
          }),
          message({
            id: "user-markdown",
            role: "user",
            content: "**不要解析** [链接](https://example.com)"
          })
        ]}
        isInitialLoading={false}
        isLoadingPrevious={false}
        hasPreviousPage={false}
        onLoadPrevious={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    const assistantRow = document.querySelector(".jcc-conversation-message-row--assistant");
    const userRow = document.querySelector(".jcc-conversation-message-row--user");
    expect(assistantRow?.querySelector("h1")).toHaveTextContent("标题");
    expect(assistantRow?.querySelector("strong")).toHaveTextContent("加粗");
    expect(assistantRow?.querySelector("li")).toHaveTextContent("第一项");
    expect(userRow?.querySelector("strong, a, ul, ol")).toBeNull();
    expect(userRow).toHaveTextContent("**不要解析** [链接](https://example.com)");
  });

  test("does not render assistant HTML as executable markup", () => {
    render(
      <ConversationMessageList
        messages={[message({ id: "unsafe", role: "assistant", content: '<script>alert("xss")</script>\n\n**文本**' })]}
        isInitialLoading={false}
        isLoadingPrevious={false}
        hasPreviousPage={false}
        onLoadPrevious={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText("文本")).toBeInTheDocument();
  });

  test("groups tool and system events under the nearest assistant and keeps empty events", () => {
    const groups = groupConversationMessages([
      message({ id: "assistant-1", role: "assistant" }),
      message({ id: "tool-1", role: "tool", content: "" }),
      message({ id: "system-1", role: "system", content: "系统信息" })
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].events.map((event) => event.id)).toEqual(["tool-1", "system-1"]);

    render(
      <ConversationMessageList
        messages={[
          message({ id: "assistant-1", role: "assistant" }),
          message({ id: "tool-1", role: "tool", content: "" })
        ]}
        isInitialLoading={false}
        isLoadingPrevious={false}
        hasPreviousPage={false}
        onLoadPrevious={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText("1 条事件记录")).toBeInTheDocument();
    fireEvent.click(screen.getByText("1 条事件记录"));
    expect(screen.getByText("空事件记录")).toBeInTheDocument();
  });

  test("does not discard events that have no assistant before them", () => {
    const groups = groupConversationMessages([message({ id: "tool-1", role: "tool" })]);
    expect(groups).toEqual([{ kind: "events", events: [expect.objectContaining({ id: "tool-1" })] }]);
  });

  test("sorts by sequence and falls back to created_at", () => {
    const sorted = sortConversationMessages([
      message({ id: "later", sequence: 2, created_at: "2026-10-07T08:00:00Z" }),
      message({ id: "earlier", sequence: 1, created_at: "2026-10-07T10:00:00Z" }),
      message({ id: "time-early", sequence: undefined, created_at: "2026-10-07T07:00:00Z" })
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["time-early", "earlier", "later"]);
  });

  test("keeps unknown roles as event records", () => {
    render(
      <ConversationMessageList
        messages={[message({ id: "unknown-1", role: "custom", content: "未知事件" })]}
        isInitialLoading={false}
        isLoadingPrevious={false}
        hasPreviousPage={false}
        onLoadPrevious={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("1 条事件记录"));
    expect(screen.getByText("未知事件")).toBeInTheDocument();
    expect(document.querySelector(".jcc-conversation-role")).not.toBeInTheDocument();
  });

  test("restores the viewport after prepending messages", () => {
    function Harness() {
      const [messages, setMessages] = useState([message({ id: "message-2", sequence: 2 })]);
      return (
        <ConversationMessageList
          messages={messages}
          isInitialLoading={false}
          isLoadingPrevious={false}
          hasPreviousPage
          onLoadPrevious={() =>
            setMessages((current) => [message({ id: "message-1", sequence: 1 }), ...current])
          }
          onRetry={vi.fn()}
        />
      );
    }

    render(<Harness />);
    const scroll = screen.getByTestId("conversation-message-scroll");
    Object.defineProperty(scroll, "scrollHeight", {
      configurable: true,
      get: () =>
        scroll.querySelectorAll(".jcc-conversation-message-row").length === 1 ? 200 : 320
    });
    scroll.scrollTop = 40;

    fireEvent.click(screen.getByRole("button", { name: "加载更早消息" }));

    expect(scroll.scrollTop).toBe(160);
  });

  test("loads earlier messages and exposes retry states", () => {
    const onLoadPrevious = vi.fn();
    render(
      <ConversationMessageList
        messages={[message({})]}
        isInitialLoading={false}
        isLoadingPrevious={false}
        hasPreviousPage
        onLoadPrevious={onLoadPrevious}
        onRetry={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "加载更早消息" }));
    expect(onLoadPrevious).toHaveBeenCalledOnce();
  });
});
