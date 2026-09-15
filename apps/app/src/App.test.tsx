import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp } from "antd";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test } from "vitest";
import App from "./App";

afterEach(() => {
  cleanup();
});

describe("base sub app shell", () => {
  test("renders without admin navigation or content", () => {
    renderApp();

    expect(document.querySelector(".app-shell")).toBeInTheDocument();
    expect(document.querySelector(".app-sider")).not.toBeInTheDocument();
    expect(screen.queryByText("用户管理")).not.toBeInTheDocument();
    expect(screen.queryByText("角色管理")).not.toBeInTheDocument();
    expect(screen.queryByText("权限管理")).not.toBeInTheDocument();
  });
});

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );
}
