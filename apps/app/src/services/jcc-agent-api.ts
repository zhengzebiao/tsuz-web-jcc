import type { ApiClient } from "@tsuz/api";

export type JccAgentStreamEventType =
  | "message.queued"
  | "run.started"
  | "text.delta"
  | "tool.started"
  | "tool.completed"
  | "tool.failed"
  | "source"
  | "message.completed"
  | "message.failed"
  | "message.cancelled"
  | "heartbeat";

export interface JccAgentStreamEvent {
  type: JccAgentStreamEventType | string;
  id?: string;
  data: unknown;
}

export interface JccAgentStreamOptions {
  signal?: AbortSignal;
  lastEventId?: string;
  onEvent: (event: JccAgentStreamEvent) => void;
}

export type JccAgentStrategyMode = "gamble" | "operation";
export type JccAgentConversationStatus = "active" | "archived" | string;
export type JccAgentMessageRole = "user" | "assistant" | "tool" | "system" | string;

export interface JccAgentConversation {
  id: string;
  title: string;
  strategy_mode: JccAgentStrategyMode;
  status: JccAgentConversationStatus;
  created_at: string;
  updated_at: string;
}

export interface JccAgentListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface JccAgentMessage {
  id: string;
  conversation_id: string;
  role: JccAgentMessageRole;
  content: string | null;
  sequence?: number;
  created_at: string;
}

export interface CreateJccAgentConversationRequest {
  title: string;
  strategy_mode: JccAgentStrategyMode;
}

export interface JccAgentMessagePaginationParams {
  limit: number;
  offset: number;
}

export interface SendJccAgentMessageRequest {
  content: string;
  strategy_mode?: JccAgentStrategyMode;
  client_request_id?: string;
}

const CONVERSATIONS_PATH = "/jcc/agent/conversations";

export function listJccAgentConversations(client: ApiClient, params: JccAgentMessagePaginationParams) {
  return client.get<JccAgentListResponse<JccAgentConversation>>(CONVERSATIONS_PATH, { query: { ...params } });
}

export function createJccAgentConversation(
  client: ApiClient,
  body: CreateJccAgentConversationRequest
) {
  return client.post<JccAgentConversation>(CONVERSATIONS_PATH, body);
}

export function getJccAgentConversation(client: ApiClient, conversationId: string) {
  return client.get<JccAgentConversation>(conversationPath(conversationId));
}

export function listJccAgentMessages(
  client: ApiClient,
  conversationId: string,
  params: JccAgentMessagePaginationParams
) {
  return client.get<JccAgentListResponse<JccAgentMessage>>(`${conversationPath(conversationId)}/messages`, {
    query: { ...params }
  });
}

export function sendJccAgentMessage(
  client: ApiClient,
  conversationId: string,
  body: SendJccAgentMessageRequest
) {
  return client.post<JccAgentMessage>(`${conversationPath(conversationId)}/messages`, body);
}

export function cancelJccAgentMessage(client: ApiClient, conversationId: string, messageId: string) {
  return client.post<void>(
    `${conversationPath(conversationId)}/messages/${encodeURIComponent(messageId)}/cancel`
  );
}

export async function streamJccAgentMessageEvents(
  client: ApiClient,
  conversationId: string,
  messageId: string,
  options: JccAgentStreamOptions
) {
  const headers = new Headers({ Accept: "text/event-stream" });
  if (options.lastEventId) headers.set("Last-Event-ID", options.lastEventId);
  const response = await client.rawRequest(
    `${conversationPath(conversationId)}/messages/${encodeURIComponent(messageId)}/events`,
    { headers, signal: options.signal }
  );

  if (!response.body) throw new Error("SSE response body is unavailable");
  for await (const event of parseJccAgentSse(response.body, options.signal)) options.onEvent(event);
}

export async function* parseJccAgentSse(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): AsyncGenerator<JccAgentStreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let eventId: string | undefined;
  let dataLines: string[] = [];

  const emit = () => {
    if (!dataLines.length) {
      eventName = "message";
      eventId = undefined;
      return undefined;
    }
    const rawData = dataLines.join("\n");
    let data: unknown = rawData;
    try {
      data = JSON.parse(rawData);
    } catch {
      if (rawData.trim().startsWith("{") || rawData.trim().startsWith("[")) {
        throw new Error("Invalid SSE event JSON");
      }
    }
    const event = { type: eventName, id: eventId, data } satisfies JccAgentStreamEvent;
    eventName = "message";
    eventId = undefined;
    dataLines = [];
    return event;
  };

  const processLine = (line: string) => {
    if (line === "") return emit();
    if (line.startsWith(":")) return undefined;
    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    const value = separator < 0 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") eventName = value || "message";
    if (field === "id") eventId = value;
    if (field === "data") dataLines.push(value);
    return undefined;
  };

  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("The operation was aborted", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.search(/[\r\n]/);
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        const newline = buffer[newlineIndex];
        buffer = buffer.slice(newlineIndex + 1);
        if (newline === "\r" && buffer.startsWith("\n")) buffer = buffer.slice(1);
        const event = processLine(line);
        if (event) yield event;
        newlineIndex = buffer.search(/[\r\n]/);
      }
    }
    buffer += decoder.decode();
    if (buffer) {
      const event = processLine(buffer);
      if (event) yield event;
    }
    const event = emit();
    if (event) yield event;
  } finally {
    reader.releaseLock();
  }
}

function conversationPath(conversationId: string) {
  return `${CONVERSATIONS_PATH}/${encodeURIComponent(conversationId)}`;
}
