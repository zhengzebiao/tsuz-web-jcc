import { App as AntApp } from "antd";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import ConversationComposer from "./ConversationComposer";

afterEach(() => cleanup());

function renderComposer(value = "", isSending = false) {
  const onChange = vi.fn();
  const onStrategyModeChange = vi.fn();
  const onSubmit = vi.fn();
  render(
    <AntApp>
      <div data-testid="composer-test-root">
      <ConversationComposer
        value={value}
        strategyMode="gamble"
        isSending={isSending}
        onChange={onChange}
        onStrategyModeChange={onStrategyModeChange}
        onSubmit={onSubmit}
      />
      </div>
    </AntApp>
  );
  return { onChange, onStrategyModeChange, onSubmit };
}

describe("ConversationComposer", () => {
  test("disables sending when the question is blank", () => {
    renderComposer("  ");
    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
  });

  test("submits a non-empty question", () => {
    const { onSubmit } = renderComposer("问题");
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  test("disables controls while sending", () => {
    renderComposer("问题", true);
    expect(screen.getByRole("textbox", { name: "输入问题" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "发送中" })).toBeDisabled();
  });
});
