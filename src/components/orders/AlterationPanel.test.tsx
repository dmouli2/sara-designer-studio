import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AlterationPanel from "./AlterationPanel";
import type { AlterationRecord, Order, OrderStatus } from "@/types";

function alteration(over: Partial<AlterationRecord> = {}): AlterationRecord {
  return {
    id: "a1",
    reason: "Sleeve tight",
    pieceLabel: null,
    receivedAt: "2026-08-01",
    promisedAt: "2026-08-08",
    completedAt: null,
    redeliveredAt: null,
    ...over,
  };
}

function setup(status: OrderStatus, alterations: AlterationRecord[], pending = false) {
  const onStart = vi.fn();
  const onComplete = vi.fn();
  const onRedeliver = vi.fn();
  const { container } = render(
    <AlterationPanel
      order={{ status, alterations } as Order}
      pending={pending}
      onStart={onStart}
      onComplete={onComplete}
      onRedeliver={onRedeliver}
    />
  );
  return { container, onStart, onComplete, onRedeliver };
}

afterEach(() => vi.useRealTimers());

describe("AlterationPanel", () => {
  // The overwhelming majority of orders never come back — the panel must not
  // add clutter to any of them.
  it("renders nothing on an order that can't have one and never had one", () => {
    expect(setup("stitching", []).container).toBeEmptyDOMElement();
  });

  it("tolerates an order stored before alterations existed", () => {
    const { container } = render(
      <AlterationPanel
        order={{ status: "stitching" } as Order}
        pending={false}
        onStart={vi.fn()}
        onComplete={vi.fn()}
        onRedeliver={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers exactly one action on a delivered order", async () => {
    const user = userEvent.setup();
    const { onStart } = setup("delivered", []);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    await user.click(buttons[0]);
    expect(onStart).toHaveBeenCalled();
  });

  it("offers no entry point before the order is delivered", () => {
    setup("ready", [alteration({ redeliveredAt: "2026-07-01" })]);
    expect(screen.queryByRole("button", { name: /Came back/ })).not.toBeInTheDocument();
  });

  describe("with an alteration open", () => {
    it("shows the reason and the promise, and only offers 'done'", async () => {
      const user = userEvent.setup();
      const { onComplete, onRedeliver } = setup("delivered", [alteration()]);

      expect(screen.getByText("In alteration")).toBeInTheDocument();
      expect(screen.getByText("Sleeve tight")).toBeInTheDocument();
      // Never two next-steps on screen at once.
      expect(screen.getAllByRole("button")).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "✓ Alteration done" }));
      expect(onComplete).toHaveBeenCalledWith(expect.any(String));
      expect(onRedeliver).not.toHaveBeenCalled();
    });

    it("names the garment on a split order", () => {
      setup("delivered", [alteration({ pieceLabel: "Blouse 2" })]);
      expect(screen.getByText("In alteration · Blouse 2")).toBeInTheDocument();
    });

    it("flags a promise the shop has already missed", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-20T06:00:00Z"));
      setup("delivered", [alteration()]);
      expect(screen.getByText(/Was promised/)).toBeInTheDocument();
    });

    it("moves on to handing back once the work is done", async () => {
      const user = userEvent.setup();
      const { onRedeliver } = setup("delivered", [alteration({ completedAt: "2026-08-05" })]);
      expect(screen.getByText(/waiting for pickup/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "✓ Handed back to customer" }));
      expect(onRedeliver).toHaveBeenCalledWith(expect.any(String));
    });

    it("hides the 'came back' entry while one is already open", () => {
      setup("delivered", [alteration()]);
      expect(screen.queryByRole("button", { name: /Came back/ })).not.toBeInTheDocument();
    });

    it("locks the action while saving", () => {
      setup("delivered", [alteration()], true);
      expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    });
  });

  // "Delivered, altered, delivered again" has to read as history, not as a
  // state someone reconstructs from dates.
  it("lists closed episodes underneath", () => {
    setup("delivered", [
      alteration({ reason: "Hook", completedAt: "2026-07-05", redeliveredAt: "2026-07-06" }),
    ]);
    expect(screen.getByText(/Altered & returned/)).toBeInTheDocument();
    expect(screen.getByText(/Hook/)).toBeInTheDocument();
  });

  it("says so when a closed episode has no reason recorded", () => {
    setup("delivered", [alteration({ reason: "", redeliveredAt: "2026-07-06" })]);
    expect(screen.getByText(/No reason recorded/)).toBeInTheDocument();
  });

  // Inline rather than a modal: one action on the card, so its date sits
  // right above it.
  describe("dating the step", () => {
    it("labels the date for the step being taken", () => {
      setup("delivered", [alteration()]);
      expect(screen.getByLabelText("Alteration done on")).toBeInTheDocument();

      cleanup();
      setup("delivered", [alteration({ completedAt: "2026-08-05" })]);
      expect(screen.getByLabelText("Handed back on")).toBeInTheDocument();
    });

    it("passes the chosen day to the action", async () => {
      const user = userEvent.setup();
      const { onComplete } = setup("delivered", [alteration()]);
      fireEvent.change(screen.getByLabelText("Alteration done on"), {
        target: { value: "2026-08-20" },
      });
      await user.click(screen.getByRole("button", { name: "✓ Alteration done" }));
      expect(onComplete).toHaveBeenCalledWith("2026-08-20");
    });

    it("blocks a future date", () => {
      setup("delivered", [alteration()]);
      fireEvent.change(screen.getByLabelText("Alteration done on"), {
        target: { value: "2099-01-01" },
      });
      expect(screen.getByRole("button", { name: "✓ Alteration done" })).toBeDisabled();
    });
  });
});
