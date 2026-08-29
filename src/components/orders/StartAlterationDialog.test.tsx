import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StartAlterationDialog, { defaultPromisedDate } from "./StartAlterationDialog";
import { shopToday } from "@/lib/utils";
import type { OrderPiece } from "@/types";

const pieces: OrderPiece[] = [
  { id: "p1", label: "Blouse 1", due: "2026-09-01", status: "delivered", deliveredAt: "x" },
  { id: "p2", label: "Blouse 2", due: "2026-09-05", status: "delivered", deliveredAt: "y" },
];

function setup(overrides: Partial<Parameters<typeof StartAlterationDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <StartAlterationDialog
      open
      orderId="B2505"
      pieces={null}
      pending={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />
  );
  return { onConfirm, onCancel };
}

afterEach(() => vi.useRealTimers());

describe("defaultPromisedDate", () => {
  it("is a week out from the shop's today", () => {
    expect(defaultPromisedDate("2026-08-29")).toBe("2026-09-05");
  });

  it("rolls over a month boundary", () => {
    expect(defaultPromisedDate("2026-12-28")).toBe("2027-01-04");
  });
});

describe("StartAlterationDialog", () => {
  it("renders nothing while closed", () => {
    const { container } = render(
      <StartAlterationDialog
        open={false}
        orderId="B2505"
        pieces={null}
        pending={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  // Reassurance that matters: the admin must not think this un-delivers the
  // order or moves the money.
  it("says the order stays delivered", () => {
    setup();
    expect(screen.getByText("Alteration for B2505")).toBeInTheDocument();
    expect(screen.getByText(/stays delivered/)).toBeInTheDocument();
  });

  it("pre-fills the promised date so the admin only changes exceptions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T06:00:00Z"));
    setup();
    expect(screen.getByLabelText(/Promised back on/)).toHaveValue("2026-09-05");
  });

  it("submits the reason and date, with no piece on a single-garment order", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.type(screen.getByLabelText(/What needs changing/), "Sleeve tight");
    await user.click(screen.getByRole("button", { name: "Take it in" }));
    expect(onConfirm).toHaveBeenCalledWith({
      reason: "Sleeve tight",
      promisedAt: expect.any(String),
      pieceLabel: null,
      receivedAt: shopToday(),
    });
  });

  it("offers no piece picker when the order is a single garment", () => {
    setup();
    expect(screen.queryByLabelText("Which piece?")).not.toBeInTheDocument();
  });

  it("lets the admin name which garment came back", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup({ pieces });
    await user.selectOptions(screen.getByLabelText("Which piece?"), "Blouse 2");
    await user.click(screen.getByRole("button", { name: "Take it in" }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ pieceLabel: "Blouse 2" }));
  });

  it("keeps 'whole order' as an option on a split order", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup({ pieces });
    await user.click(screen.getByRole("button", { name: "Take it in" }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ pieceLabel: null }));
  });

  it("cannot be submitted without a promised date", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Promised back on/), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Take it in" })).toBeDisabled();
  });

  it("backs out without recording anything", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("locks the buttons while saving", () => {
    setup({ pending: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  // The customer may have dropped it off yesterday.
  it("takes the day it actually came back in", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    fireEvent.change(screen.getByLabelText("Taken in on"), { target: { value: "2026-08-20" } });
    await user.click(screen.getByRole("button", { name: "Take it in" }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ receivedAt: "2026-08-20" }));
  });

  it("defaults the taken-in date to today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T06:00:00Z"));
    setup();
    expect(screen.getByLabelText("Taken in on")).toHaveValue("2026-08-29");
  });

  it("won't take something in from the future", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Taken in on"), { target: { value: "2099-01-01" } });
    expect(screen.getByRole("button", { name: "Take it in" })).toBeDisabled();
  });
});
