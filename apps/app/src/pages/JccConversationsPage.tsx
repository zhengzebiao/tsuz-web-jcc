import { useMutation, useQuery } from "@tanstack/react-query";
import { PageContainer } from "@tsuz/ui";
import { Alert, Button, Card, Form, Input, Modal, Pagination, Select, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMfeApiClient } from "../services/api-client";
import {
  createJccAgentConversation,
  listJccAgentConversations,
  type CreateJccAgentConversationRequest,
  type JccAgentConversation
} from "../services/jcc-agent-api";
import { useAppStore } from "../stores/app.store";

const PAGE_SIZE = 20;

export default function JccConversationsPage() {
  const hostProps = useAppStore((state) => state.hostProps);
  const client = useMemo(() => createMfeApiClient(hostProps), [hostProps]);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<CreateJccAgentConversationRequest>();
  const [createError, setCreateError] = useState<string>();
  const query = useQuery({
    queryKey: ["jcc-agent", "conversations", page],
    queryFn: () => listJccAgentConversations(client, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
  });
  const mutation = useMutation({
    mutationFn: (values: CreateJccAgentConversationRequest) => createJccAgentConversation(client, values),
    onSuccess: (conversation) => {
      setOpen(false);
      form.resetFields();
      navigate(`/jcc/conversation/${encodeURIComponent(conversation.id)}`);
    },
    onError: (error) => setCreateError(getErrorMessage(error))
  });

  const columns: ColumnsType<JccAgentConversation> = [
    { title: "标题", dataIndex: "title", key: "title" },
    {
      title: "风格",
      dataIndex: "strategy_mode",
      key: "strategy_mode",
      render: (mode: JccAgentConversation["strategy_mode"]) => (
        <Tag color={mode === "gamble" ? "orange" : "blue"}>{mode === "gamble" ? "赌狗" : "运营"}</Tag>
      )
    },
    { title: "状态", dataIndex: "status", key: "status", render: (status: string) => statusLabel(status) },
    { title: "创建时间", dataIndex: "created_at", key: "created_at" },
    { title: "最近更新", dataIndex: "updated_at", key: "updated_at" },
    {
      title: "操作",
      key: "action",
      render: (_value, conversation) => (
        <Button type="link" onClick={() => navigate(`/jcc/conversation/${encodeURIComponent(conversation.id)}`)}>
          进入会话
        </Button>
      )
    }
  ];

  const openCreate = () => {
    setCreateError(undefined);
    form.resetFields();
    form.setFieldsValue({ strategy_mode: "gamble" });
    setOpen(true);
  };

  return (
    <PageContainer
      className="jcc-resource-page"
      title="Agent 会话"
      description="创建并进入 JCC Agent 会话"
      actions={<Button type="primary" onClick={openCreate}>新建会话</Button>}
    >
      <Card className="subapp-card jcc-resource-card">
        {query.isError ? (
          <Alert
            type="error"
            showIcon
            message={getErrorMessage(query.error)}
            description="请确认登录状态和 JCC Agent 服务是否可用。"
            action={<Button onClick={() => void query.refetch()}>重新加载</Button>}
          />
        ) : (
          <Table<JccAgentConversation>
            rowKey="id"
            loading={query.isLoading}
            dataSource={query.data?.items ?? []}
            columns={columns}
            pagination={false}
            locale={{ emptyText: "暂无会话" }}
          />
        )}
        {!query.isError ? (
          <div className="jcc-pagination-row">
            <Typography.Text type="secondary">
              {query.data ? `已加载 ${query.data.items.length} 条` : "等待会话"}
            </Typography.Text>
            <Pagination
              current={page}
              pageSize={PAGE_SIZE}
              total={query.data?.total ?? 0}
              showSizeChanger={false}
              showTotal={(total) => `共 ${total} 条`}
              onChange={setPage}
            />
          </div>
        ) : null}
      </Card>
      <Modal
        title="新建会话"
        open={open}
        confirmLoading={mutation.isPending}
        onCancel={() => setOpen(false)}
        onOk={() => void form.submit()}
        destroyOnHidden
      >
        {createError ? <Alert type="error" showIcon message={createError} /> : null}
        <Form
          form={form}
          layout="vertical"
          initialValues={{ strategy_mode: "gamble" }}
          onFinish={(values) => {
            setCreateError(undefined);
            mutation.mutate({ ...values, title: values.title.trim() });
          }}
        >
          <Form.Item
            label="会话标题"
            name="title"
            rules={[
              { required: true, whitespace: true, message: "请输入会话标题" },
              { min: 1, max: 255, message: "标题长度必须为 1-255 个字符" }
            ]}
          >
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item label="会话风格" name="strategy_mode">
            <Select options={[{ value: "gamble", label: "赌狗" }, { value: "operation", label: "运营" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}

function statusLabel(status: string) {
  return status === "archived" ? "已归档" : status === "active" ? "活跃" : status;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败，请稍后重试";
}
