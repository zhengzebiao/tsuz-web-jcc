import type { ApiClient } from "@tsuz/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  cancelJccAgentMessage,
  createJccAgentConversation,
  getJccAgentConversation,
  listJccAgentConversations,
  listJccAgentMessages,
  sendJccAgentMessage
} from "./jcc-agent-api";

const client = {
  get: vi.fn(),
  post: vi.fn()
} as unknown as ApiClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(client.get).mockResolvedValue({});
  vi.mocked(client.post).mockResolvedValue({});
});

describe("JCC Agent API", () => {
  test("lists conversations with fixed pagination inputs", async () => {
    await listJccAgentConversations(client, { limit: 20, offset: 40 });

    expect(client.get).toHaveBeenCalledWith("/jcc/agent/conversations", {
      query: { limit: 20, offset: 40 }
    });
  });

  test("creates a conversation with the selected strategy", async () => {
    await createJccAgentConversation(client, { title: "上分计划", strategy_mode: "gamble" });

    expect(client.post).toHaveBeenCalledWith("/jcc/agent/conversations", {
      title: "上分计划",
      strategy_mode: "gamble"
    });
  });

  test("encodes conversation identifiers in detail and message paths", async () => {
    await getJccAgentConversation(client, "conversation/one");
    await listJccAgentMessages(client, "conversation/one", { limit: 20, offset: 0 });

    expect(client.get).toHaveBeenNthCalledWith(1, "/jcc/agent/conversations/conversation%2Fone");
    expect(client.get).toHaveBeenNthCalledWith(
      2,
      "/jcc/agent/conversations/conversation%2Fone/messages",
      { query: { limit: 20, offset: 0 } }
    );
  });

  test("sends and cancels messages through ordinary REST wrappers", async () => {
    await sendJccAgentMessage(client, "conversation/one", {
      content: "推荐阵容",
      strategy_mode: "operation",
      client_request_id: "request-1"
    });
    await cancelJccAgentMessage(client, "conversation/one", "message/one");

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      "/jcc/agent/conversations/conversation%2Fone/messages",
      {
        content: "推荐阵容",
        strategy_mode: "operation",
        client_request_id: "request-1"
      }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      "/jcc/agent/conversations/conversation%2Fone/messages/message%2Fone/cancel"
    );
  });
});
