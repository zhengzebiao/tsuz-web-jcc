import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { PageContainer } from "@tsuz/ui";
import { Alert, Button, Card, Spin } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import ConversationComposer from "../components/jcc/ConversationComposer";
import ConversationMessageList from "../components/jcc/ConversationMessageList";
import { createMfeApiClient } from "../services/api-client";
import {
  cancelJccAgentMessage,
  getJccAgentConversation,
  listJccAgentMessages,
  sendJccAgentMessage,
  streamJccAgentMessageEvents,
  type JccAgentMessage,
  type JccAgentStreamEvent,
  type JccAgentStrategyMode
} from "../services/jcc-agent-api";
import type { ConversationLiveResponse } from "../components/jcc/ConversationMessageList";
import { useAppStore } from "../stores/app.store";

const PAGE_SIZE = 20;

function extractTextDelta(data: unknown) {
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "text" in data && typeof data.text === "string") return data.text;
  if (data && typeof data === "object" && "delta" in data && typeof data.delta === "string") return data.delta;
  if (data && typeof data === "object" && "content" in data && typeof data.content === "string") return data.content;
  return "";
}

export default function JccConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const hostProps = useAppStore((state) => state.hostProps);
  const client = useMemo(() => createMfeApiClient(hostProps), [hostProps]);
  const [question, setQuestion] = useState("");
  const [strategyMode, setStrategyMode] = useState<JccAgentStrategyMode>("gamble");
  const [liveResponse, setLiveResponse] = useState<ConversationLiveResponse>();
  const [runState, setRunState] = useState<"idle" | "streaming" | "cancelling" | "disconnected">("idle");
  const [runError, setRunError] = useState<unknown>();
  const streamAbortRef = useRef<AbortController | undefined>(undefined);
  const streamRunRef = useRef<{ messageId: string; lastEventId?: string } | undefined>(undefined);
  const conversationQuery = useQuery({
    queryKey: ["jcc-agent", "conversation", conversationId],
    queryFn: () => getJccAgentConversation(client, conversationId ?? ""),
    enabled: Boolean(conversationId)
  });
  const messagesQuery = useInfiniteQuery({
    queryKey: ["jcc-agent", "conversation", conversationId, "messages"],
    queryFn: ({ pageParam }) =>
      listJccAgentMessages(client, conversationId ?? "", { limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = new Set(pages.flatMap((page) => page.items.map((message) => message.id)).values()).size;
      return loaded < lastPage.total ? pages.length * PAGE_SIZE : undefined;
    },
    enabled: Boolean(conversationId)
  });
  const messages = useMemo(() => {
    const byId = new Map<string, JccAgentMessage>();
    messagesQuery.data?.pages.forEach((page) => {
      page.items.forEach((message) => byId.set(message.id, message));
    });
    return [...byId.values()];
  }, [messagesQuery.data]);

  const handleStreamEvent = useCallback(
    (event: JccAgentStreamEvent) => {
      if (!streamRunRef.current || event.id === streamRunRef.current.lastEventId) return;
      if (event.id) streamRunRef.current.lastEventId = event.id;
      setLiveResponse((current) => {
        if (!current) return current;
        if (event.type === "text.delta") {
          const delta = extractTextDelta(event.data);
          return {
            ...current,
            assistantMessage: {
              ...current.assistantMessage,
              content: (current.assistantMessage.content ?? "") + delta
            }
          };
        }
        if (event.type === "message.completed") return { ...current, status: "completed" };
        if (event.type === "message.failed") return { ...current, status: "failed" };
        if (event.type === "message.cancelled") return { ...current, status: "cancelled" };
        if (event.type === "heartbeat") return current;
        return { ...current, events: [...current.events, event] };
      });
      if (["message.completed", "message.failed", "message.cancelled"].includes(event.type)) {
        setRunState("idle");
        streamAbortRef.current = undefined;
      }
    },
    []
  );

  const startStream = useCallback(
    async (messageId: string, lastEventId?: string) => {
      const controller = new AbortController();
      streamAbortRef.current = controller;
      streamRunRef.current = { messageId, lastEventId };
      setRunState("streaming");
      setRunError(undefined);
      try {
        await streamJccAgentMessageEvents(client, conversationId ?? "", messageId, {
          signal: controller.signal,
          lastEventId,
          onEvent: handleStreamEvent
        });
        if (!controller.signal.aborted && streamAbortRef.current === controller) {
          setRunState((state) => (state === "streaming" ? "disconnected" : state));
          setLiveResponse((current) => (current?.status === "streaming" ? { ...current, status: "disconnected" } : current));
        }
      } catch (error) {
        if (!controller.signal.aborted && streamAbortRef.current === controller) {
          setRunError(error);
          setRunState("disconnected");
          setLiveResponse((current) => (current ? { ...current, status: "disconnected" } : current));
        }
      }
    },
    [client, conversationId, handleStreamEvent]
  );

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      sendJccAgentMessage(client, conversationId ?? "", {
        content,
        strategy_mode: strategyMode,
        client_request_id: crypto.randomUUID()
      }),
    onSuccess: (message) => {
      setQuestion("");
      const userMessage = message as JccAgentMessage;
      const assistantMessage: JccAgentMessage = {
        id: `${userMessage.id}-assistant`,
        conversation_id: conversationId ?? "",
        role: "assistant",
        content: "",
        created_at: new Date().toISOString()
      };
      setLiveResponse({ userMessage, assistantMessage, events: [], status: "streaming" });
      void startStream(userMessage.id);
    }
  });

  const handleReconnect = useCallback(() => {
    const run = streamRunRef.current;
    if (run && runState === "disconnected") void startStream(run.messageId, run.lastEventId);
  }, [runState, startStream]);

  const handleCancel = useCallback(async () => {
    const run = streamRunRef.current;
    if (!run || runState !== "streaming") return;
    setRunState("cancelling");
    try {
      await cancelJccAgentMessage(client, conversationId ?? "", run.messageId);
      streamAbortRef.current?.abort();
      setLiveResponse((current) => (current ? { ...current, status: "cancelled" } : current));
      setRunState("idle");
    } catch (error) {
      setRunError(error);
      setRunState("streaming");
    }
  }, [client, conversationId, runState]);

  useEffect(() => () => streamAbortRef.current?.abort(), []);

  useEffect(() => {
    if (conversationQuery.data) setStrategyMode(conversationQuery.data.strategy_mode);
  }, [conversationQuery.data]);

  const conversationTitle = conversationQuery.data?.title ?? "标题";
  const conversationDescription = conversationQuery.data
    ? `${conversationQuery.data.strategy_mode === "gamble" ? "赌狗" : "运营"} · ${conversationQuery.data.status}`
    : "风格和状态";

  return (
    <PageContainer
      className="jcc-conversation-page"
      title={conversationTitle}
      description={conversationDescription}
    >
      <Card className="subapp-card">
        {!conversationId ? (
          <Alert type="error" message="缺少会话 ID" />
        ) : conversationQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message={conversationQuery.error instanceof Error ? conversationQuery.error.message : "会话加载失败"}
            action={<Button onClick={() => void conversationQuery.refetch()}>重新加载</Button>}
          />
        ) : conversationQuery.isLoading ? (
          <Spin />
        ) : conversationQuery.data ? (
          <section className="jcc-conversation-workspace">
            <section className="jcc-conversation-history">
              <ConversationMessageList
                messages={messages}
                isInitialLoading={messagesQuery.isLoading}
                isLoadingPrevious={messagesQuery.isFetchingNextPage}
                hasPreviousPage={Boolean(messagesQuery.hasNextPage)}
                error={messagesQuery.error}
                onLoadPrevious={() => void messagesQuery.fetchNextPage()}
                onRetry={() => void messagesQuery.refetch()}
                liveResponse={liveResponse}
              />
            </section>
            {runState === "disconnected" ? (
              <div className="jcc-conversation-stream-error">
                <span>{runError instanceof Error ? runError.message : "连接中断"}</span>
                <Button onClick={handleReconnect}>重新连接</Button>
              </div>
            ) : null}
            <ConversationComposer
              value={question}
              strategyMode={strategyMode}
              isSending={sendMutation.isPending || runState === "streaming" || runState === "cancelling"}
              isCancelling={runState === "cancelling"}
              error={sendMutation.error ?? runError}
              onCancel={() => void handleCancel()}
              onChange={setQuestion}
              onStrategyModeChange={setStrategyMode}
              onSubmit={() => void sendMutation.mutateAsync(question.trim())}
            />
          </section>
        ) : null}
      </Card>
    </PageContainer>
  );
}
