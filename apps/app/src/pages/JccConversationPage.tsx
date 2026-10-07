import { useQuery } from "@tanstack/react-query";
import { PageContainer } from "@tsuz/ui";
import { Alert, Button, Card, Descriptions, Spin, Tag } from "antd";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createMfeApiClient } from "../services/api-client";
import { getJccAgentConversation } from "../services/jcc-agent-api";
import { useAppStore } from "../stores/app.store";

export default function JccConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const hostProps = useAppStore((state) => state.hostProps);
  const client = useMemo(() => createMfeApiClient(hostProps), [hostProps]);
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["jcc-agent", "conversation", conversationId],
    queryFn: () => getJccAgentConversation(client, conversationId ?? ""),
    enabled: Boolean(conversationId)
  });

  return (
    <PageContainer title="Agent 会话" description="会话详情">
      <Card className="subapp-card">
        {!conversationId ? (
          <Alert type="error" message="缺少会话 ID" />
        ) : query.isError ? (
          <Alert
            type="error"
            showIcon
            message={query.error instanceof Error ? query.error.message : "会话加载失败"}
            action={<Button onClick={() => void query.refetch()}>重新加载</Button>}
          />
        ) : query.isLoading ? (
          <Spin />
        ) : query.data ? (
          <>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="标题">{query.data.title}</Descriptions.Item>
              <Descriptions.Item label="风格">
                <Tag>{query.data.strategy_mode === "gamble" ? "赌狗" : "运营"}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">{query.data.status}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{query.data.created_at}</Descriptions.Item>
              <Descriptions.Item label="最近更新">{query.data.updated_at}</Descriptions.Item>
            </Descriptions>
            <Alert
              type="info"
              showIcon
              message="消息历史与实时问答将在后续阶段接入。"
              style={{ marginTop: 16 }}
            />
          </>
        ) : null}
        <Button onClick={() => navigate("/jcc/conversations")} style={{ marginTop: 16 }}>
          返回会话列表
        </Button>
      </Card>
    </PageContainer>
  );
}
