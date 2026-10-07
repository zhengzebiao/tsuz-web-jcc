import type { ApiClient } from "@tsuz/api";

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

function conversationPath(conversationId: string) {
  return `${CONVERSATIONS_PATH}/${encodeURIComponent(conversationId)}`;
}
