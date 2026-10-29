import { render, renderHook, type RenderOptions } from "@testing-library/react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createQueryClient } from "@/lib/query-client";

export const queryWrapper = (client: QueryClient = createQueryClient()) => {
  function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return QueryWrapper;
};

export const renderWithQuery = (
  ui: ReactElement,
  options: Omit<RenderOptions, "wrapper"> & { client?: QueryClient } = {},
) => {
  const { client = createQueryClient(), ...rest } = options;
  return { client, ...render(ui, { wrapper: queryWrapper(client), ...rest }) };
};

export const renderHookWithQuery = <Result,>(
  hook: () => Result,
  client: QueryClient = createQueryClient(),
) => ({ client, ...renderHook(hook, { wrapper: queryWrapper(client) }) });
