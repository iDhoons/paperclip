// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type FormEvent, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import { defaultCreateValues } from "./agent-config-defaults";
import { AgentConfigForm } from "./AgentConfigForm";

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompanyId: null,
  }),
}));

vi.mock("../adapters/use-disabled-adapters", () => ({
  useDisabledAdaptersSync: () => new Set<string>(),
}));

vi.mock("./MarkdownEditor", () => ({
  MarkdownEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label={placeholder ?? "Markdown editor"}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock("./PathInstructionsModal", () => ({
  ChoosePathButton: () => <button type="button">Choose path</button>,
}));

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>,
  );

  return {
    ...result,
    queryClient,
  };
}

function createValues(overrides: Partial<CreateConfigValues> = {}): CreateConfigValues {
  return {
    ...defaultCreateValues,
    ...overrides,
  };
}

function ControlledAgentConfigForm({
  initialValues = createValues(),
  onChange,
}: {
  initialValues?: CreateConfigValues;
  onChange?: (patch: Partial<CreateConfigValues>) => void;
}) {
  const [values, setValues] = useState(initialValues);

  return (
    <AgentConfigForm
      mode="create"
      values={values}
      onChange={(patch) => {
        setValues((prev) => ({ ...prev, ...patch }));
        onChange?.(patch);
      }}
      showAdapterTestEnvironmentButton={false}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AgentConfigForm", () => {
  it("renders the create-mode adapter configuration fields", () => {
    renderWithProviders(<ControlledAgentConfigForm />);

    expect(screen.getByText("Adapter")).toBeInTheDocument();
    expect(screen.getByText("Permissions & Configuration")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Claude Code/i })).toBeInTheDocument();
    expect(screen.getByText("Command")).toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("Run Policy")).toBeInTheDocument();
  });

  it("does not submit its enclosing form while required fields are empty", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    renderWithProviders(
      <form onSubmit={handleSubmit}>
        <input aria-label="Agent name" required defaultValue="" />
        <ControlledAgentConfigForm />
        <button type="submit">Create agent</button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Create agent" }));

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("updates the adapter-specific configuration when the adapter type changes", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    renderWithProviders(<ControlledAgentConfigForm onChange={handleChange} />);

    expect(screen.getByText("Enable Chrome")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Claude Code/i }));
    await user.click(screen.getByRole("button", { name: /OpenCode/i }));

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterType: "opencode_local",
        model: "",
      }),
    );
    expect(screen.getByRole("button", { name: /OpenCode/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Select model \(required\)/i })).toBeInTheDocument();
    expect(screen.queryByText("Enable Chrome")).not.toBeInTheDocument();
  });
});
