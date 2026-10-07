import { Button, Collapse, Empty, Popover, Spin } from "antd";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { JccAgentMessage, JccAgentStreamEvent } from "../../services/jcc-agent-api";

export interface ConversationLiveResponse {
  userMessage: JccAgentMessage;
  assistantMessage: JccAgentMessage;
  events: JccAgentStreamEvent[];
  status: "streaming" | "completed" | "failed" | "cancelled" | "disconnected";
}

const TOOL_LABELS: Record<string, string> = {
  derive_lineup_candidates: "推导阵容候选",
  get_equipment: "查询装备",
  get_hero: "查询英雄",
  get_snapshot_metadata: "查询版本快照",
  get_trait: "查询羁绊",
  search_adventures: "搜索特殊机制",
  search_augments: "搜索强化符文",
  search_equipment: "搜索装备",
  search_galaxies: "搜索奇遇",
  search_heroes: "搜索英雄",
  search_knowledge: "查询知识库",
  search_traits: "搜索羁绊"
};

const CALL_DETAIL_EVENT_TYPES = new Set([
  "message.queued",
  "run.started",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "source"
]);

const SOURCE_LABELS: Record<string, string> = {
  official_structured_data: "官方结构化数据",
  rag_document: "知识库资料",
  system_derived: "系统推导",
  model_explanation: "模型解释"
};

export interface ConversationMessageListProps {
  messages: JccAgentMessage[];
  isInitialLoading: boolean;
  isLoadingPrevious: boolean;
  hasPreviousPage: boolean;
  error?: unknown;
  onLoadPrevious: () => void;
  onRetry: () => void;
  liveResponse?: ConversationLiveResponse;
}

interface MessageGroup {
  kind: "message" | "events";
  message?: JccAgentMessage;
  events: JccAgentMessage[];
}

export function sortConversationMessages(messages: JccAgentMessage[]) {
  return messages
    .map((message, index) => ({ message, index }))
    .sort((left, right) => {
      if (left.message.sequence !== undefined && right.message.sequence !== undefined) {
        return left.message.sequence - right.message.sequence || left.index - right.index;
      }
      const leftTime = Date.parse(left.message.created_at);
      const rightTime = Date.parse(right.message.created_at);
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return left.index - right.index;
    })
    .map(({ message }) => message);
}

export function groupConversationMessages(messages: JccAgentMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentAssistant: MessageGroup | undefined;

  for (const message of messages) {
    if (message.role === "user" || message.role === "assistant") {
      const group: MessageGroup = { kind: "message", message, events: [] };
      groups.push(group);
      currentAssistant = message.role === "assistant" ? group : undefined;
      continue;
    }

    if (currentAssistant) {
      currentAssistant.events.push(message);
    } else {
      const previous = groups.at(-1);
      if (previous?.kind === "events") {
        previous.events.push(message);
      } else {
        const group: MessageGroup = { kind: "events", events: [message] };
        groups.push(group);
      }
    }
  }

  return groups;
}

export default function ConversationMessageList({
  messages,
  isInitialLoading,
  isLoadingPrevious,
  hasPreviousPage,
  error,
  onLoadPrevious,
  onRetry,
  liveResponse
}: ConversationMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingRestoreRef = useRef<{ top: number; height: number } | null>(null);
  const previousMessageCountRef = useRef(messages.length);
  const previousLiveMessageIdRef = useRef<string | undefined>(undefined);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const element = scrollRef.current;
    if (!element) return;
    if (typeof element.scrollTo === "function") {
      element.scrollTo({ top: element.scrollHeight, behavior });
    } else {
      element.scrollTop = element.scrollHeight;
    }
  };

  useLayoutEffect(() => {
    const restore = pendingRestoreRef.current;
    const element = scrollRef.current;
    if (restore && element && messages.length !== previousMessageCountRef.current) {
      element.scrollTop = restore.top + (element.scrollHeight - restore.height);
      pendingRestoreRef.current = null;
    }
    previousMessageCountRef.current = messages.length;
  }, [messages.length]);

  useLayoutEffect(() => {
    if (isInitialLoading || pendingRestoreRef.current) return;
    scrollToBottom("auto");
  }, [isInitialLoading]);

  useEffect(() => {
    const liveMessageId = liveResponse?.userMessage.id;
    if (!liveMessageId) return;
    const isNewLiveMessage = previousLiveMessageIdRef.current !== liveMessageId;
    previousLiveMessageIdRef.current = liveMessageId;
    if (isNewLiveMessage || isNearBottom) scrollToBottom(isNewLiveMessage ? "auto" : "smooth");
  }, [isNearBottom, liveResponse?.assistantMessage.content, liveResponse?.userMessage.id]);

  const loadPrevious = () => {
    const element = scrollRef.current;
    if (element) {
      pendingRestoreRef.current = { top: element.scrollTop, height: element.scrollHeight };
    }
    onLoadPrevious();
  };

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    setIsNearBottom(element.scrollHeight - element.scrollTop - element.clientHeight <= 48);
    if (element.scrollTop <= 24 && hasPreviousPage && !isLoadingPrevious) {
      loadPrevious();
    }
  };

  if (isInitialLoading) {
    return <Spin aria-label="消息加载中" />;
  }

  if (error && messages.length === 0) {
    return (
      <div className="jcc-conversation-message-state">
        <p>消息历史加载失败</p>
        <button type="button" onClick={onRetry}>
          重新加载消息
        </button>
      </div>
    );
  }

  const groups = groupConversationMessages(sortConversationMessages(messages));

  return (
    <div
      className="jcc-conversation-message-scroll"
      data-testid="conversation-message-scroll"
      onScroll={handleScroll}
      ref={scrollRef}
    >
      <div className="jcc-conversation-message-toolbar">
        {hasPreviousPage ? (
          <button type="button" onClick={loadPrevious} disabled={isLoadingPrevious}>
            {isLoadingPrevious ? "正在加载更早消息…" : "加载更早消息"}
          </button>
        ) : messages.length > 0 ? (
          <span>已加载全部历史</span>
        ) : null}
      </div>

      {messages.length === 0 && !liveResponse ? (
        <Empty description="暂无消息历史" />
      ) : (
        <div className="jcc-conversation-message-list">
          {groups.map((group, index) =>
            group.kind === "message" && group.message ? (
              <div
                className={`jcc-conversation-message-row jcc-conversation-message-row--${group.message.role}`}
                key={group.message.id}
              >
                <div className="jcc-conversation-bubble">
                  <div className="jcc-conversation-content">
                    {group.message.role === "assistant" ? (
                      <div className="jcc-conversation-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {group.message.content?.trim() || "空消息"}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      group.message.content?.trim() || "空消息"
                    )}
                  </div>
                </div>
                {group.events.length > 0 ? (
                  <EventCollapse events={group.events} />
                ) : null}
              </div>
            ) : (
              <EventCollapse events={group.events} key={`events-${index}`} />
            )
          )}
          {liveResponse ? <LiveResponse response={liveResponse} /> : null}
        </div>
      )}

      {!isNearBottom ? (
        <button
          type="button"
          className="jcc-conversation-scroll-bottom"
          aria-label="滚动到底部"
          onClick={() => scrollToBottom()}
        >
          ↓
        </button>
      ) : null}

      {error && messages.length > 0 ? (
        <div className="jcc-conversation-message-inline-error">
          <span>更早消息加载失败</span>
          <button type="button" onClick={onRetry}>
            重试
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LiveResponse({ response }: { response: ConversationLiveResponse }) {
  const events = response.events.filter((event) => CALL_DETAIL_EVENT_TYPES.has(event.type));
  const eventMessages: ConversationEvent[] = events.map((event, index) => ({
    id: `${response.assistantMessage.id}-${event.id ?? index}`,
    conversation_id: response.assistantMessage.conversation_id,
    role: "tool",
    content: formatLiveEvent(event),
    created_at: new Date().toISOString(),
    eventType: event.type
  }));

  return (
    <div className="jcc-conversation-live-response">
      <div className="jcc-conversation-message-row jcc-conversation-message-row--user">
        <div className="jcc-conversation-bubble">
          <div className="jcc-conversation-content">{response.userMessage.content}</div>
        </div>
      </div>
      <div className="jcc-conversation-message-row jcc-conversation-message-row--assistant">
        <div className="jcc-conversation-bubble">
          <div className="jcc-conversation-content jcc-conversation-markdown">
            {response.assistantMessage.content?.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{response.assistantMessage.content}</ReactMarkdown>
            ) : null}
          </div>
          {response.status !== "completed" || events.length ? (
            <div className="jcc-conversation-live-status">
              {response.status !== "completed" ? (
                <>
                  <span className="jcc-conversation-live-status__label">正在生成…</span>
                  {response.status !== "streaming" ? (
                    <span className="jcc-conversation-live-status__detail">{liveStatusLabel(response.status)}</span>
                  ) : null}
                </>
              ) : null}
              {events.length ? (
                <Popover
                  trigger="click"
                  placement="topLeft"
                  content={<EventDetails events={eventMessages} />}
                  title="调用详情"
                >
                  <Button type="link" size="small" className="jcc-conversation-live-details">
                    查看调用详情
                  </Button>
                </Popover>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function readEventField(data: unknown, ...keys: string[]) {
  if (!data || typeof data !== "object") return undefined;
  for (const key of keys) {
    const value = (data as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function formatLiveEvent(event: JccAgentStreamEvent) {
  const toolName = readEventField(event.data, "tool_name", "toolName") ?? "未知工具";
  const sourceType = readEventField(event.data, "source_type", "sourceType") ?? "未知来源";
  const model = readEventField(event.data, "model", "model_name") ?? "未知模型";

  switch (event.type) {
    case "message.queued":
      return "开始处理...";
    case "run.started":
      return `调用模型 ${model}`;
    case "tool.started":
      return `调用 ${TOOL_LABELS[toolName] ?? toolName}`;
    case "tool.completed":
      return `调用 ${TOOL_LABELS[toolName] ?? toolName} 成功`;
    case "tool.failed":
      return `调用 ${TOOL_LABELS[toolName] ?? toolName} 失败`;
    case "source":
      return `查询资料来源于 ${SOURCE_LABELS[sourceType] ?? sourceType}`;
    default:
      if (typeof event.data === "string") return event.data;
      return `${event.type}: ${JSON.stringify(event.data)}`;
  }
}

function eventClassName(event: JccAgentStreamEvent) {
  if (event.type === "message.queued") return "queued";
  if (event.type === "run.started") return "run";
  if (event.type.startsWith("tool.")) return "tool";
  if (event.type === "source") return "source";
  if (event.type.startsWith("message.")) return "terminal";
  return "unknown";
}

function liveStatusLabel(status: ConversationLiveResponse["status"]) {
  return {
    streaming: "正在生成…",
    completed: "已完成",
    failed: "执行失败",
    cancelled: "已停止",
    disconnected: "连接中断"
  }[status];
}

type ConversationEvent = JccAgentMessage & { eventType?: string };

function formatEventTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function EventDetails({ events }: { events: ConversationEvent[] }) {
  return (
    <div className="jcc-conversation-live-details-list">
      {events.map((event) => (
        <div
          className={`jcc-conversation-event jcc-conversation-event--${event.eventType ? eventClassName({ type: event.eventType, data: event.content }) : "unknown"}`}
          key={event.id}
        >
          <time>{formatEventTime(event.created_at)}：</time>
          <div className="jcc-conversation-content">{event.content?.trim() || "空事件记录"}</div>
        </div>
      ))}
    </div>
  );
}

function EventCollapse({ events }: { events: ConversationEvent[] }) {
  return (
    <Collapse
      className="jcc-conversation-events"
      items={[
        {
          key: "events",
          label: "调用工具",
          children: (
            <div>
              {events.map((event) => {
                const streamEvent = event.eventType ? { type: event.eventType, data: event.content } : undefined;
                return (
                  <div
                    className={`jcc-conversation-event jcc-conversation-event--${streamEvent ? eventClassName(streamEvent) : "unknown"}`}
                    key={event.id}
                  >
                    <time>{formatEventTime(event.created_at)}：</time>
                    <div className="jcc-conversation-content">
                      {event.content?.trim() || "空事件记录"}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      ]}
    />
  );
}
