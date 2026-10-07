import { Collapse, Empty, Spin } from "antd";
import { useLayoutEffect, useRef } from "react";
import type { JccAgentMessage } from "../../services/jcc-agent-api";

export interface ConversationMessageListProps {
  messages: JccAgentMessage[];
  isInitialLoading: boolean;
  isLoadingPrevious: boolean;
  hasPreviousPage: boolean;
  error?: unknown;
  onLoadPrevious: () => void;
  onRetry: () => void;
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
  onRetry
}: ConversationMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingRestoreRef = useRef<{ top: number; height: number } | null>(null);
  const previousMessageCountRef = useRef(messages.length);

  useLayoutEffect(() => {
    const restore = pendingRestoreRef.current;
    const element = scrollRef.current;
    if (restore && element && messages.length !== previousMessageCountRef.current) {
      element.scrollTop = restore.top + (element.scrollHeight - restore.height);
      pendingRestoreRef.current = null;
    }
    previousMessageCountRef.current = messages.length;
  }, [messages.length]);

  const loadPrevious = () => {
    const element = scrollRef.current;
    if (element) {
      pendingRestoreRef.current = { top: element.scrollTop, height: element.scrollHeight };
    }
    onLoadPrevious();
  };

  const handleScroll = () => {
    const element = scrollRef.current;
    if (element && element.scrollTop <= 24 && hasPreviousPage && !isLoadingPrevious) {
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

      {messages.length === 0 ? (
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
                  <span className="jcc-conversation-role">
                    {group.message.role === "user" ? "用户" : "Agent"}
                  </span>
                  <div className="jcc-conversation-content">
                    {group.message.content?.trim() || "空消息"}
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
        </div>
      )}

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

function EventCollapse({ events }: { events: JccAgentMessage[] }) {
  return (
    <Collapse
      className="jcc-conversation-events"
      items={[
        {
          key: "events",
          label: `${events.length} 条事件记录`,
          children: (
            <div>
              {events.map((event) => (
                <div className="jcc-conversation-event" key={event.id}>
                  <span className="jcc-conversation-role">
                    {event.role === "tool" ? "工具" : event.role === "system" ? "系统" : event.role}
                  </span>
                  <time>{event.created_at}</time>
                  <div className="jcc-conversation-content">
                    {event.content?.trim() || "空事件记录"}
                  </div>
                </div>
              ))}
            </div>
          )
        }
      ]}
    />
  );
}
