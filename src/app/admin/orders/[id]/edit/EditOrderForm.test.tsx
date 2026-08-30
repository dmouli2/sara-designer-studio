import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditOrderForm from "./EditOrderForm";
import { updateOrder } from "@/app/actions/orders";
import { compressImageToDataUrl, galleryEntryToFile } from "@/lib/image";
import { mockRouter } from "../../../../../../vitest.setup";
import type { Order } from "@/types";

vi.mock("@/app/actions/orders", () => ({
  updateOrder: vi.fn(),
}));

vi.mock("@/lib/image", () => ({
  MAX_PHOTO_PAYLOAD_BYTES: 3.5 * 1024 * 1024,
  compressImageToDataUrl: vi.fn(),
  dataUrlToFile: vi.fn((dataUrl: string, filename: string) => new File(["decoded"], filename, { type: "image/jpeg" })),
  galleryEntryToFile: vi.fn(async (src: string, filename: string) => new File(["photo"], filename, { type: "image/jpeg" })),
}));

const order: Order = {
  id: "B2401",
  customer: "Priya Sharma",
  phone: "9876543210",
  dress: "Blouse",
  material: "Silk (shop)",
  status: "new",
  amount: 4200, // 400 fabric + Blouse 1×3800
  advance: 1000,
  advanceMethod: null,
  advanceSplit: null,
  finalPayment: 0,
  finalPaymentMethod: null,
  due: "2026-07-10",
  master: null,
  tailor: null,
  measurements: {
    type: "blouse",
    length: "15", shoulder: "", hs: "", sl: "", mlos: "", tlos: "", ahs: "",
    bust: "34", ub: "", waist: "", fnNr: "", bn: "", dart: "", dbd: "", p: "",
    sareeFall: "", piko: "",
  },
  lineItems: [{ particulars: "Blouse", qty: 1, amount: 3800 }],
  notes: "Heavy border",
  sketchDataUrl: "https://storage.example/sketch.png?sig=1",
  referenceImageUrls: ["https://storage.example/reference-1.jpg?sig=1"],
  materialImageUrls: ["https://storage.example/material-1.jpg?sig=1"],
  mainMaterialImageUrl: "https://storage.example/material-1.jpg?sig=1",
  cancellationCharge: null,
  deliveredOn: null,
  pieces: null,
  alterations: [],
  payments: [],
  createdAt: "2026-06-24",
};

function saveButton() {
  return screen.getByText("✓ Save Changes");
}

describe("EditOrderForm", () => {
  beforeEach(() => {
    vi.mocked(updateOrder).mockReset();
    vi.mocked(updateOrder).mockResolvedValue(order);
    vi.mocked(galleryEntryToFile).mockReset();
    vi.mocked(galleryEntryToFile).mockImplementation(
      async (src: string, filename: string) => new File(["photo"], filename, { type: "image/jpeg" })
    );
  });

  it("prefills every field from the order, including stored photos and sketch", () => {
    render(<EditOrderForm order={order} />);
    expect(screen.getByText("Edit B2401")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByDisplayValue("9876543210")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Silk (shop)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Heavy border")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-07-10")).toBeInTheDocument();
    expect(screen.getByLabelText("Length")).toHaveValue(15);
    expect(screen.getByLabelText("Blouse quantity")).toHaveValue(1);
    expect(screen.getByLabelText("Blouse price")).toHaveValue(3800);
    expect(screen.getByText("Order total (₹)").parentElement!.querySelector("input")).toHaveValue(4200);
    expect(screen.getByAltText("Material 1")).toBeInTheDocument();
    expect(screen.getByAltText("Reference 1")).toBeInTheDocument();
    expect(screen.getByAltText("Current sketch")).toBeInTheDocument();
  });

  it("navigates back without calling the server when nothing changed", async () => {
    const user = userEvent.setup();
    render(<EditOrderForm order={order} />);
    await user.click(saveButton());
    expect(updateOrder).not.toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/B2401");
  });

  it("sends only the fields that changed", async () => {
    const user = userEvent.setup();
    render(<EditOrderForm order={order} />);

    const nameInput = screen.getByDisplayValue("Priya Sharma");
    await user.clear(nameInput);
    await user.type(nameInput, "Meena R");
    await user.click(saveButton());

    expect(updateOrder).toHaveBeenCalledTimes(1);
    expect(updateOrder).toHaveBeenCalledWith("B2401", { customer: "Meena R" }, undefined);
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/B2401");
  });

  it("recomputes the total from qty × price when a line item changes and submits both", async () => {
    const user = userEvent.setup();
    render(<EditOrderForm order={order} />);

    const qty = screen.getByLabelText("Blouse quantity");
    await user.clear(qty);
    await user.type(qty, "2");

    // 4200 - (1×3800) + (2×3800) = 8000 — the fabric part of the total rides along.
    expect(screen.getByText("Order total (₹)").parentElement!.querySelector("input")).toHaveValue(8000);

    await user.click(saveButton());
    expect(updateOrder).toHaveBeenCalledWith(
      "B2401",
      {
        lineItems: [{ particulars: "Blouse", qty: 2, amount: 3800 }],
        amount: 8000,
      },
      undefined
    );
  });

  it("submits an added line item with its trimmed comment", async () => {
    const user = userEvent.setup();
    render(<EditOrderForm order={order} />);

    await user.type(screen.getByLabelText("Lining Blouse quantity"), "2");
    await user.type(screen.getByLabelText("Lining Blouse price"), "100");
    await user.type(screen.getByLabelText("Lining Blouse comments"), " double stitch ");
    await user.click(saveButton());

    const patch = vi.mocked(updateOrder).mock.calls[0][1];
    expect(patch.lineItems).toEqual([
      { particulars: "Blouse", qty: 1, amount: 3800 },
      { particulars: "Lining Blouse", qty: 2, amount: 100, note: "double stitch" },
    ]);
    expect(patch.amount).toBe(4400); // 4200 + 2×100
  });

  it("lets the admin override the total directly", async () => {
    const user = userEvent.setup();
    render(<EditOrderForm order={order} />);

    const totalInput = screen.getByText("Order total (₹)").parentElement!.querySelector("input")!;
    await user.clear(totalInput);
    await user.type(totalInput, "5000");
    await user.click(saveButton());

    expect(updateOrder).toHaveBeenCalledWith("B2401", { amount: 5000 }, undefined);
  });

  it("disables saving while the phone number is invalid", async () => {
    const user = userEvent.setup();
    render(<EditOrderForm order={order} />);
    const phoneInput = screen.getByDisplayValue("9876543210");
    await user.clear(phoneInput);
    await user.type(phoneInput, "12345");
    expect(screen.getByText("Enter a valid 10-digit Indian mobile number.")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("disables saving when every material photo is removed", async () => {
    const user = userEvent.setup();
    render(<EditOrderForm order={order} />);
    await user.click(screen.getByLabelText("Remove material photo 1"));
    expect(screen.getByText("At least one material photo is required.")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("re-sends the full material gallery as Files when a photo is added", async () => {
    const user = userEvent.setup();
    vi.mocked(compressImageToDataUrl).mockResolvedValue("data:image/jpeg;base64,newfabric");
    const { container } = render(<EditOrderForm order={order} />);

    // First hidden file input on the page belongs to MaterialImageUpload.
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, {
      target: { files: [new File(["fabric"], "new.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(screen.getByAltText("Material 2")).toBeInTheDocument());

    await user.click(saveButton());

    expect(updateOrder).toHaveBeenCalledTimes(1);
    const photos = vi.mocked(updateOrder).mock.calls[0][2] as FormData;
    expect(photos.get("materialChanged")).toBe("1");
    expect(photos.getAll("material")).toHaveLength(2);
    // The kept photo is refetched from its signed URL, the new one from its data URL.
    expect(galleryEntryToFile).toHaveBeenCalledWith("https://storage.example/material-1.jpg?sig=1", "material-1.jpg");
    expect(galleryEntryToFile).toHaveBeenCalledWith("data:image/jpeg;base64,newfabric", "material-2.jpg");
    // Untouched galleries are not re-sent.
    expect(photos.get("referenceChanged")).toBeNull();
    expect(photos.get("sketchChanged")).toBeNull();
  });

  it("flags a removed sketch without attaching a file, and shows a blank canvas for redrawing", async () => {
    const user = userEvent.setup();
    render(<EditOrderForm order={order} />);

    await user.click(screen.getByText("Remove sketch & redraw"));
    expect(screen.getByText("Draw garment sketch here")).toBeInTheDocument();

    await user.click(saveButton());
    const photos = vi.mocked(updateOrder).mock.calls[0][2] as FormData;
    expect(photos.get("sketchChanged")).toBe("1");
    expect(photos.getAll("sketch")).toHaveLength(0);
  });

  it("blocks the save with a size error when the photo payload exceeds the limit", async () => {
    const user = userEvent.setup();
    vi.mocked(compressImageToDataUrl).mockResolvedValue("data:image/jpeg;base64,huge");
    vi.mocked(galleryEntryToFile).mockImplementation(
      async (src: string, filename: string) =>
        new File([new ArrayBuffer(2 * 1024 * 1024)], filename, { type: "image/jpeg" })
    );
    const { container } = render(<EditOrderForm order={order} />);

    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, {
      target: { files: [new File(["fabric"], "new.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(screen.getByAltText("Material 2")).toBeInTheDocument());

    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/Photos are too large/);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it("shows an error toast and stays on the page when saving fails", async () => {
    vi.mocked(updateOrder).mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<EditOrderForm order={order} />);

    const nameInput = screen.getByDisplayValue("Priya Sharma");
    await user.clear(nameInput);
    await user.type(nameInput, "Meena R");
    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the changes");
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(saveButton()).not.toBeDisabled();
  });

  it("returns to the detail page from the Cancel button and the top bar back arrow", async () => {
    const user = userEvent.setup();
    render(<EditOrderForm order={order} />);
    await user.click(screen.getByText("Cancel"));
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/B2401");

    mockRouter.push.mockClear();
    await user.click(screen.getByLabelText("Back"));
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/B2401");
  });

  describe("changing how many garments the order is for", () => {
    function renderWith(overrides: Partial<Order> = {}) {
      render(<EditOrderForm order={{ ...order, ...overrides }} />);
    }

    it("sends the new count when it changes", async () => {
      const user = userEvent.setup();
      renderWith();

      await user.click(screen.getByRole("button", { name: "One more piece" }));
      await user.click(screen.getByRole("button", { name: "One more piece" }));
      await user.click(saveButton());

      await waitFor(() =>
        expect(updateOrder).toHaveBeenCalledWith(
          "B2401",
          expect.objectContaining({ pieceCount: 3 }),
          undefined
        )
      );
    });

    it("sends nothing when the count is left alone", async () => {
      const user = userEvent.setup();
      renderWith();

      await user.type(screen.getByPlaceholderText("Full name *"), "!");
      await user.click(saveButton());

      await waitFor(() => expect(updateOrder).toHaveBeenCalled());
      expect(vi.mocked(updateOrder).mock.calls[0][1]).not.toHaveProperty("pieceCount");
    });

    it("starts from the order's existing count", () => {
      renderWith({
        pieces: [
          { id: "p1", label: "Blouse 1", due: "2026-07-10", status: "pending", deliveredAt: null },
          { id: "p2", label: "Blouse 2", due: "2026-07-10", status: "pending", deliveredAt: null },
        ],
      });
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    // The floor is one above what's already gone: those garments are with the
    // customer, and the last one in the shop has to leave through a hand-over,
    // which is where the balance gets collected.
    it("won't let a delivered garment be removed", () => {
      renderWith({
        status: "partly_delivered",
        pieces: [
          { id: "p1", label: "Blouse 1", due: "2026-07-10", status: "delivered", deliveredAt: "x" },
          { id: "p2", label: "Blouse 2", due: "2026-07-10", status: "pending", deliveredAt: null },
        ],
      });
      expect(screen.getByRole("button", { name: "One less piece" })).toBeDisabled();
      expect(screen.getByText(/1 already handed over/)).toBeInTheDocument();
    });

    it("is offered on a Salwar order too", () => {
      renderWith({ dress: "Salwar" });
      expect(screen.getByText("How many salwars?")).toBeInTheDocument();
    });

    // A mixed order is rare, so the per-garment rows stay hidden unless the
    // stored pieces actually disagree about where the cloth came from.
    describe("per-garment material source", () => {
      const twoPieces = [
        { id: "p1", label: "Blouse 1", due: "2026-07-10", status: "pending" as const, deliveredAt: null },
        { id: "p2", label: "Blouse 2", due: "2026-07-10", status: "pending" as const, deliveredAt: null },
      ];

      it("opens uniform for an order whose garments all match", () => {
        renderWith({ pieces: twoPieces });
        expect(screen.getByRole("checkbox")).toBeChecked();
      });

      it("opens un-uniform when the stored garments differ", () => {
        renderWith({
          pieces: [
            { ...twoPieces[0], materialSource: "shop" as const },
            { ...twoPieces[1], materialSource: "customer" as const },
          ],
        });
        expect(screen.getByRole("checkbox")).not.toBeChecked();
        expect(screen.getByLabelText("Blouse 1 material shop")).toHaveAttribute("aria-pressed", "true");
      });

      it("sends the sources once the garments are set apart", async () => {
        const user = userEvent.setup();
        renderWith({ pieces: twoPieces });

        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByLabelText("Blouse 1 material shop"));
        await user.click(saveButton());

        await waitFor(() =>
          expect(updateOrder).toHaveBeenCalledWith(
            "B2401",
            expect.objectContaining({ pieceCount: 2, pieceSources: ["shop", "customer"] }),
            undefined
          )
        );
      });
    });
  });
});
