import type { ApiClient } from "@tsuz/api";
import { describe, expect, test, vi } from "vitest";
import { parseJccAgentSse, streamJccAgentMessageEvents } from "./jcc-agent-api";

function streamFrom(...chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    }
  });
}

describe("parseJccAgentSse", () => {
  test("parses chunk boundaries, CRLF, multiline JSON data, and ignores heartbeat comments", async () => {
    const events = [];
    for await (const event of parseJccAgentSse(
      streamFrom(
        ": heartbeat\r\nevent: text.delta\r\nid: e-1\r\ndata: {\"text\":\r\n",
        "data: \"你好\"}\r\n\r\n: keep-alive\n\n"
      )
    )) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "text.delta", id: "e-1", data: { text: "你好" } }]);
  });

  test("flushes an event at EOF and preserves unknown event types", async () => {
    const events = [];
    for await (const event of parseJccAgentSse(streamFrom("event: custom\ndata: plain text"))) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "custom", id: undefined, data: "plain text" }]);
  });

  test("rejects malformed JSON payloads", async () => {
    await expect(
      (async () => {
        for await (const _event of parseJccAgentSse(streamFrom("event: text.delta\ndata: {broken}\n\n"))) {
          // Consume the stream.
        }
      })()
    ).rejects.toThrow("Invalid SSE event JSON");
  });
});

describe("streamJccAgentMessageEvents", () => {
  test("passes SSE headers, encoded identifiers, signal, and events to the callback", async () => {
    const rawRequest = vi.fn().mockResolvedValue(
      new Response(streamFrom('id: e-2\nevent: message.completed\ndata: {"ok":true}\n\n').pipeThrough(new TransformStream()), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" }
      })
    );
    const client = { rawRequest } as unknown as ApiClient;
    const onEvent = vi.fn();
    const signal = new AbortController().signal;

    await streamJccAgentMessageEvents(client, "conversation/one", "message/one", {
      signal,
      lastEventId: "e-1",
      onEvent
    });

    expect(rawRequest).toHaveBeenCalledWith(
      "/jcc/agent/conversations/conversation%2Fone/messages/message%2Fone/events",
      expect.objectContaining({ signal, headers: expect.any(Headers) })
    );
    const [, options] = rawRequest.mock.calls[0] as [{}, { headers: Headers }];
    expect(options.headers.get("Accept")).toBe("text/event-stream");
    expect(options.headers.get("Last-Event-ID")).toBe("e-1");
    expect(onEvent).toHaveBeenCalledWith({ type: "message.completed", id: "e-2", data: { ok: true } });
  });
});
