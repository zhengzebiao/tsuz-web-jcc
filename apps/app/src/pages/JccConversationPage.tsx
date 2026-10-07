import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { PageContainer } from "@tsuz/ui";
import { Alert, Button, Card, Spin } from "antd";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConversationMessageList from "../components/jcc/ConversationMessageList";
import { createMfeApiClient } from "../services/api-client";
import {
  getJccAgentConversation,
  listJccAgentMessages,
  type JccAgentMessage
} from "../services/jcc-agent-api";
import { useAppStore } from "../stores/app.store";

const PAGE_SIZE = 20;

export default function JccConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const hostProps = useAppStore((state) => state.hostProps);
  const client = useMemo(() => createMfeApiClient(hostProps), [hostProps]);
  const navigate = useNavigate();
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
          <section className="jcc-conversation-history">
            <ConversationMessageList
              messages={messages}
              isInitialLoading={messagesQuery.isLoading}
              isLoadingPrevious={messagesQuery.isFetchingNextPage}
              hasPreviousPage={Boolean(messagesQuery.hasNextPage)}
              error={messagesQuery.error}
              onLoadPrevious={() => void messagesQuery.fetchNextPage()}
              onRetry={() => void messagesQuery.refetch()}
            />
          </section>
        ) : null}
        <Button onClick={() => navigate("/jcc/conversations")} style={{ marginTop: 16 }}>
          返回会话列表
        </Button>
      </Card>
    </PageContainer>
  );
}
