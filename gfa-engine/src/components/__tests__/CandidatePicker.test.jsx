import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CandidatePicker from "../CandidatePicker.jsx";

const CANDIDATES = [
  {
    id: "cand-1",
    copy: { headline: "후보 A 헤드라인", description: "설명 A", ctaText: "구매" },
  },
  {
    id: "cand-2",
    copy: { headline: "후보 B 헤드라인", description: "설명 B", ctaText: "보기" },
  },
];

describe("CandidatePicker", () => {
  it("returns null when nothing to show", () => {
    const { container } = render(
      <CandidatePicker
        candidates={null}
        busy={false}
        error={null}
        onPick={() => {}}
        onRegenerate={() => {}}
        onClose={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders busy state with progress", () => {
    render(
      <CandidatePicker
        candidates={null}
        busy={true}
        progress={{ index: 1, total: 3 }}
        onPick={() => {}}
        onRegenerate={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/생성 중/)).toBeInTheDocument();
    expect(screen.getByText(/2\/3/)).toBeInTheDocument();
  });

  it("renders error message and dismiss/regen buttons", () => {
    render(
      <CandidatePicker
        candidates={null}
        busy={false}
        error="Ollama 연결 실패"
        onPick={() => {}}
        onRegenerate={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/Ollama 연결 실패/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "재생성" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "닫기" })).toBeInTheDocument();
  });

  it("renders all candidates with their copy fields", () => {
    render(
      <CandidatePicker
        candidates={CANDIDATES}
        busy={false}
        error={null}
        onPick={() => {}}
        onRegenerate={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("후보 A 헤드라인")).toBeInTheDocument();
    expect(screen.getByText("후보 B 헤드라인")).toBeInTheDocument();
    expect(screen.getByText("CTA · 구매")).toBeInTheDocument();
    expect(screen.getByText("CTA · 보기")).toBeInTheDocument();
  });

  it("calls onPick with the selected candidate's copy when 적용 clicked", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <CandidatePicker
        candidates={CANDIDATES}
        busy={false}
        error={null}
        onPick={onPick}
        onRegenerate={() => {}}
        onClose={() => {}}
      />
    );
    const buttons = screen.getAllByRole("button", { name: "적용" });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[1]);
    expect(onPick).toHaveBeenCalledWith(CANDIDATES[1].copy);
  });

  it("flags overlong headlines via lintCopy in candidate items", () => {
    const long = "가".repeat(45);
    render(
      <CandidatePicker
        candidates={[
          {
            id: "x",
            copy: { headline: long, description: "ok", ctaText: "go" },
          },
        ]}
        busy={false}
        error={null}
        onPick={() => {}}
        onRegenerate={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/headline 길이 45자/)).toBeInTheDocument();
  });
});
