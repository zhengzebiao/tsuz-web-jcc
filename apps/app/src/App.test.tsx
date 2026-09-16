import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp } from "antd";
import { useState } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import App from "./App";

vi.mock("./pages/JccResourcePage", () => ({
  default: ({ title }: { title: string }) => {
    const [draft, setDraft] = useState("");

    return (
      <>
        <h1>{title}</h1>
        <input aria-label={`${title}临时筛选`} value={draft} onChange={(event) => setDraft(event.target.value)} />
      </>
    );
  }
}));

afterEach(() => {
  cleanup();
});

const routes = [
  ["英雄", "/heroes"],
  ["羁绊", "/traits"],
  ["装备", "/equipment"],
  ["强化符文", "/augments"],
  ["特殊机制", "/special-mechanics"],
  ["传送门", "/portals"]
] as const;

describe("JCC navigation", () => {
  test.each(routes)("opens the %s resource page from the menu", async (label, path) => {
    renderApp();

    fireEvent.click(screen.getByRole("menuitem", { name: new RegExp(`${label}$`) }));

    await waitFor(() => expect(screen.getByTestId("current-path")).toHaveTextContent(path));
    expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: new RegExp(`${label}$`) })).toHaveClass("ant-menu-item-selected");
  });

  test.each(routes)("renders the %s resource page at its direct route", (label, path) => {
    renderApp(path);

    expect(screen.getByTestId("current-path")).toHaveTextContent(path);
    expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
  });

  test.each(["/", "/unknown", "/admin/users", "/users"])("redirects %s to the canonical hero route", async (path) => {
    renderApp(path);

    await waitFor(() => expect(screen.getByTestId("current-path")).toHaveTextContent("/heroes"));
    expect(screen.getByRole("heading", { name: "英雄" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /英雄$/ })).toHaveClass("ant-menu-item-selected");
  });

  test("resets page-local state when switching resources", async () => {
    renderApp();
    fireEvent.change(screen.getByRole("textbox", { name: "英雄临时筛选" }), {
      target: { value: "亚索" }
    });

    fireEvent.click(screen.getByRole("menuitem", { name: /装备$/ }));
    await screen.findByRole("heading", { name: "装备" });
    fireEvent.click(screen.getByRole("menuitem", { name: /英雄$/ }));
    await screen.findByRole("heading", { name: "英雄" });

    expect(screen.getByRole("textbox", { name: "英雄临时筛选" })).toHaveValue("");
  });

  test("renders only approved JCC resource navigation and labels", () => {
    renderApp();

    expect(screen.getAllByRole("menuitem")).toHaveLength(6);
    expect(screen.queryByText("用户管理")).not.toBeInTheDocument();
    expect(screen.queryByText("角色管理")).not.toBeInTheDocument();
    expect(screen.queryByText("权限管理")).not.toBeInTheDocument();
    expect(screen.queryByText("冒险")).not.toBeInTheDocument();
    expect(screen.queryByText("星系")).not.toBeInTheDocument();
  });
});

function renderApp(initialPath = "/heroes") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={[initialPath]}>
          <App />
          <RouteProbe />
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );
}

function RouteProbe() {
  const location = useLocation();

  return <output data-testid="current-path">{location.pathname}</output>;
}
