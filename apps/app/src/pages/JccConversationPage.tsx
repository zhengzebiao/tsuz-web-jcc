import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { PageContainer } from "@tsuz/ui";
import { Alert, Button, Card, Descriptions, Spin, Tag } from "antd";
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

  return (
    <PageContainer title="Agent 会话" description="会话详情">
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
          <>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="标题">{conversationQuery.data.title}</Descriptions.Item>
              <Descriptions.Item label="风格">
                <Tag>{conversationQuery.data.strategy_mode === "gamble" ? "赌狗" : "运营"}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">{conversationQuery.data.status}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{conversationQuery.data.created_at}</Descriptions.Item>
              <Descriptions.Item label="最近更新">{conversationQuery.data.updated_at}</Descriptions.Item>
            </Descriptions>
            <section className="jcc-conversation-history" aria-label="消息历史">
              <h2>消息历史</h2>
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
          </>
        ) : null}
        <Button onClick={() => navigate("/jcc/conversations")} style={{ marginTop: 16 }}>
          返回会话列表
        </Button>
      </Card>
    </PageContainer>
  );
}
