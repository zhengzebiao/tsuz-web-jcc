import { Button, Input, Select } from "antd";
import { FormEvent } from "react";
import type { JccAgentStrategyMode } from "../../services/jcc-agent-api";

interface ConversationComposerProps {
  value: string;
  strategyMode: JccAgentStrategyMode;
  isSending: boolean;
  error?: unknown;
  onChange: (value: string) => void;
  onStrategyModeChange: (value: JccAgentStrategyMode) => void;
  onSubmit: () => void;
}

export default function ConversationComposer({
  value,
  strategyMode,
  isSending,
  error,
  onChange,
  onStrategyModeChange,
  onSubmit
}: ConversationComposerProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (value.trim() && !isSending) onSubmit();
  };

  return (
    <form className="jcc-conversation-composer" onSubmit={handleSubmit}>
      <Input.TextArea
        aria-label="输入问题"
        autoSize={{ minRows: 1, maxRows: 4 }}
        disabled={isSending}
        placeholder="输入问题，按 Enter 发送"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onPressEnter={(event) => {
          if (!event.shiftKey) {
            event.preventDefault();
            if (value.trim() && !isSending) onSubmit();
          }
        }}
      />
      <Select
        aria-label="会话风格"
        disabled={isSending}
        value={strategyMode}
        options={[
          { label: "赌狗", value: "gamble" },
          { label: "运营", value: "operation" }
        ]}
        onChange={onStrategyModeChange}
      />
      <Button
        htmlType="submit"
        type="primary"
        disabled={!value.trim() || isSending}
        loading={isSending}
        aria-label={isSending ? "发送中" : "发送"}
      >
        {isSending ? "发送中" : "发送"}
      </Button>
      {error ? <div className="jcc-conversation-composer-error">发送失败，请稍后重试</div> : null}
    </form>
  );
}
