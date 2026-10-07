import { App as AntApp } from "antd";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import ConversationComposer from "./ConversationComposer";

afterEach(() => cleanup());

function renderComposer(value = "", isSending = false, isCancelling = false) {
  const onChange = vi.fn();
  const onStrategyModeChange = vi.fn();
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <AntApp>
      <div data-testid="composer-test-root">
      <ConversationComposer
        value={value}
        strategyMode="gamble"
        isSending={isSending}
        isCancelling={isCancelling}
        onCancel={onCancel}
        onChange={onChange}
        onStrategyModeChange={onStrategyModeChange}
        onSubmit={onSubmit}
      />
      </div>
    </AntApp>
  );
  return { onChange, onStrategyModeChange, onSubmit, onCancel };
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

  test("stops a running response", () => {
    const { onCancel } = renderComposer("问题", true);
    fireEvent.click(screen.getByRole("button", { name: "停止" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox", { name: "输入问题" })).toBeDisabled();
  });

  test("disables the stop action while cancelling", () => {
    renderComposer("问题", true, true);
    expect(screen.getByRole("button", { name: "停止中" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "输入问题" })).toBeDisabled();
  });
});
