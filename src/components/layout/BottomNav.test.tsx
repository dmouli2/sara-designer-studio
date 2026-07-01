import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BottomNav from "./BottomNav";

const tabs = [
  { id: "queue", label: "Queue", icon: <span>Q</span> },
  { id: "done", label: "Done", icon: <span>D</span> },
];

describe("BottomNav", () => {
  it("renders all tabs and marks the active one", () => {
    render(<BottomNav tabs={tabs} active="queue" onChange={() => {}} />);
    const queueBtn = screen.getByText("Queue").closest("button")!;
    const doneBtn = screen.getByText("Done").closest("button")!;
    expect(queueBtn).toHaveClass("active");
    expect(doneBtn).not.toHaveClass("active");
  });

  it("calls onChange with the tab id when clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BottomNav tabs={tabs} active="queue" onChange={onChange} />);
    await user.click(screen.getByText("Done"));
    expect(onChange).toHaveBeenCalledWith("done");
  });
});
