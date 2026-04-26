import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BatchRunner from "../BatchRunner.jsx";

describe("BatchRunner", () => {
  it("calls onRun with parsed jobs from the textarea", async () => {
    const onRun = vi.fn();
    const user = userEvent.setup();
    render(<BatchRunner onRun={onRun} busy={false} log={[]} />);

    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.click(textarea);
    // Type a minimal valid array — userEvent.type respects raw chars
    await user.paste('[{"id":"job-x","brief":{"brand":"B"}}]');

    await user.click(screen.getByRole("button", { name: "큐 실행" }));
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledWith([{ id: "job-x", brief: { brand: "B" } }]);
  });

  it("shows parse error and does not call onRun on invalid JSON", async () => {
    const onRun = vi.fn();
    const user = userEvent.setup();
    render(<BatchRunner onRun={onRun} busy={false} log={[]} />);

    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.click(textarea);
    await user.paste("not json");

    await user.click(screen.getByRole("button", { name: "큐 실행" }));
    expect(onRun).not.toHaveBeenCalled();
    expect(screen.getByText(/JSON 파싱 실패/)).toBeInTheDocument();
  });

  it("rejects non-array top level with a parse error", async () => {
    const onRun = vi.fn();
    const user = userEvent.setup();
    render(<BatchRunner onRun={onRun} busy={false} log={[]} />);

    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.click(textarea);
    await user.paste('{"id":"x"}');

    await user.click(screen.getByRole("button", { name: "큐 실행" }));
    expect(onRun).not.toHaveBeenCalled();
    expect(screen.getByText(/최상위는 배열이어야/)).toBeInTheDocument();
  });

  it("renders progress log lines", () => {
    render(
      <BatchRunner
        onRun={() => {}}
        busy={true}
        log={["▶ 시작", "  · 캡처 1/4 (v1)", "✓ 완료"]}
      />
    );
    expect(screen.getByText("▶ 시작")).toBeInTheDocument();
    expect(screen.getByText(/· 캡처 1\/4 \(v1\)/)).toBeInTheDocument();
    expect(screen.getByText("✓ 완료")).toBeInTheDocument();
  });

  it("disables the run button while busy", () => {
    render(<BatchRunner onRun={() => {}} busy={true} log={[]} />);
    expect(screen.getByRole("button", { name: "실행 중..." })).toBeDisabled();
  });
});
