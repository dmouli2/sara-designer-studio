import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewOrderWizard, { DRAFT_KEY, MAX_PHOTO_PAYLOAD_BYTES, type ScanSource } from "./NewOrderWizard";
import { createOrder } from "@/app/actions/orders";
import { confirmDraft } from "@/app/actions/drafts";
import { createFabric } from "@/app/actions/fabrics";
import { compressImageToDataUrl } from "@/lib/image";
import { mockRouter } from "../../../../../vitest.setup";
import type { Fabric } from "@/lib/db/types";

vi.mock("@/app/actions/orders", () => ({
  createOrder: vi.fn(),
}));

vi.mock("@/app/actions/drafts", () => ({
  confirmDraft: vi.fn(),
}));

vi.mock("@/app/actions/fabrics", () => ({
  createFabric: vi.fn(),
  updateFabric: vi.fn(),
  deleteFabric: vi.fn(),
}));

vi.mock("@/lib/image", () => ({
  MAX_PHOTO_PAYLOAD_BYTES: 3.5 * 1024 * 1024,
  compressImageToDataUrl: vi.fn(),
  // Real implementation atob-decodes potentially huge strings — a cheap fake
  // keeps the oversized-payload test fast while preserving the File shape
  // the wizard sends to createOrder.
  dataUrlToFile: vi.fn(
    (dataUrl: string, filename: string) => new File(["decoded"], filename, { type: "image/jpeg" })
  ),
  // Signed-URL gallery entries (the scanned slip) come back as Files
  // without hitting the network.
  galleryEntryToFile: vi.fn(
    async (src: string, filename: string) => new File(["fetched"], filename, { type: "image/jpeg" })
  ),
}));

const TEST_FABRICS: Fabric[] = [
  { id: "f1", name: "Cotton", price: 120 },
  { id: "f2", name: "Silk", price: 350 },
];

async function chooseOrderType(user: ReturnType<typeof userEvent.setup>, type: "Blouse" | "Salwar" = "Blouse") {
  await user.click(screen.getByText(type));
}

// Material photos are required to leave Step 1 — captures one via the
// hidden file input MaterialImageUpload renders (the only file input
// present on Step 1; ReferenceImageUpload's lives on Step 2).
async function takeMaterialPhoto(container: HTMLElement) {
  vi.mocked(compressImageToDataUrl).mockResolvedValue("data:image/jpeg;base64,fabric");
  const input = container.querySelector('input[type="file"]')!;
  fireEvent.change(input, {
    target: { files: [new File(["fabric"], "fabric.jpg", { type: "image/jpeg" })] },
  });
  await waitFor(() => expect(screen.getByAltText("Material 1")).toBeInTheDocument());
}

async function fillStep1AndAdvance(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
  await user.type(screen.getByPlaceholderText("Full name *"), "Test Customer");
  await user.type(screen.getByPlaceholderText("Phone / WhatsApp *"), "9999999999");
  await takeMaterialPhoto(container);
  await user.click(screen.getByText("Next: Measurements →"));
}

async function fillDeliveryDate(user: ReturnType<typeof userEvent.setup>, value = "2026-07-20") {
  const deliveryInput = screen.getByText("Delivery date *").parentElement!.querySelector("input")!;
  await user.type(deliveryInput, value);
}

describe("NewOrderWizard", () => {
  beforeEach(() => {
    vi.mocked(createOrder).mockReset();
    vi.mocked(createOrder).mockResolvedValue({ id: "B2401", publicToken: "tok-abc123" } as never);
  });

  describe("order-type selector", () => {
    it("shows the order-type selector before any wizard fields", () => {
      render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      expect(screen.getByText("What are we stitching?")).toBeInTheDocument();
      expect(screen.getByText("Blouse")).toBeInTheDocument();
      expect(screen.getByText("Salwar")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Full name *")).not.toBeInTheDocument();
    });

    it("goes back to the orders list when back is clicked on the selector", async () => {
      const user = userEvent.setup();
      render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await user.click(screen.getByLabelText("Back"));
      expect(mockRouter.back).toHaveBeenCalled();
    });

    it("enters the wizard at step 1 once an order type is chosen", async () => {
      const user = userEvent.setup();
      render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user, "Blouse");

      expect(screen.getByText("New Order · Step 1/3")).toBeInTheDocument();
      expect(screen.getByText("Blouse", { selector: "span" })).toBeInTheDocument();
    });

    it("goes back to the order-type selector (not the orders list) when back is clicked on step 1", async () => {
      const user = userEvent.setup();
      render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user, "Blouse");
      await user.click(screen.getByLabelText("Back"));

      expect(screen.getByText("What are we stitching?")).toBeInTheDocument();
      expect(mockRouter.back).not.toHaveBeenCalled();
    });

    it("lets the order type be changed from step 1 via the Change link", async () => {
      const user = userEvent.setup();
      render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user, "Blouse");
      await user.click(screen.getByText("Change"));

      expect(screen.getByText("What are we stitching?")).toBeInTheDocument();
    });

    it("shows the salwar measurement form when Salwar is chosen", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user, "Salwar");
      await fillStep1AndAdvance(user, container);

      expect(screen.getByText("TLCS")).toBeInTheDocument();
      // O.Shalwar / L.Shalwar were removed from the order form.
      expect(screen.queryByText("O.Shalwar")).not.toBeInTheDocument();
      expect(screen.queryByText("L.Shalwar")).not.toBeInTheDocument();
    });
  });

  it("shows step 1 with the Next button disabled until name, phone and a material photo are provided", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);

    expect(screen.getByText("New Order · Step 1/3")).toBeInTheDocument();
    const nextBtn = screen.getByText("Next: Measurements →");
    expect(nextBtn).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Full name *"), "Test Customer");
    expect(nextBtn).toBeDisabled();
    await user.type(screen.getByPlaceholderText("Phone / WhatsApp *"), "9999999999");
    expect(nextBtn).toBeDisabled(); // still missing the required material photo
    await takeMaterialPhoto(container);
    expect(nextBtn).not.toBeDisabled();
  });

  it("rejects an invalid phone number and blocks advancing to step 2", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    const nextBtn = screen.getByText("Next: Measurements →");

    await user.type(screen.getByPlaceholderText("Full name *"), "Test Customer");
    await user.type(screen.getByPlaceholderText("Phone / WhatsApp *"), "12345");
    await takeMaterialPhoto(container);

    expect(screen.getByText("Enter a valid 10-digit Indian mobile number.")).toBeInTheDocument();
    expect(nextBtn).toBeDisabled();
  });

  it("accepts a phone number with a +91 prefix", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await user.type(screen.getByPlaceholderText("Full name *"), "Test Customer");
    await user.type(screen.getByPlaceholderText("Phone / WhatsApp *"), "+919876543210");
    await takeMaterialPhoto(container);

    expect(screen.queryByText("Enter a valid 10-digit Indian mobile number.")).not.toBeInTheDocument();
    expect(screen.getByText("Next: Measurements →")).not.toBeDisabled();
  });

  it("blocks submit with a specific size error when photos exceed the action body limit", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await fillStep1AndAdvance(user, container);

    // One huge reference photo on step 2 pushes the payload past the limit —
    // photos ship as binary Files (~3/4 of the base64 character count), so
    // the fixture must be comfortably over limit ÷ 0.75.
    vi.mocked(compressImageToDataUrl).mockResolvedValue(
      "data:image/jpeg;base64," + "a".repeat(Math.ceil((MAX_PHOTO_PAYLOAD_BYTES / 0.75) * 1.1))
    );
    const refInput = container.querySelector('input[type="file"]')!;
    fireEvent.change(refInput, {
      target: { files: [new File(["big"], "big.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(screen.getByAltText("Reference 1")).toBeInTheDocument());

    await user.click(screen.getByText("Next: Pricing →"));
    await fillDeliveryDate(user);
    await user.click(screen.getByText("✓ Confirm & Place Order"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Photos are too large .* Remove a photo/);
    // Never sent — the request would be rejected by the server's body cap.
    expect(createOrder).not.toHaveBeenCalled();
    expect(screen.queryByText("Order placed successfully!")).not.toBeInTheDocument();
  });

  it("disables Next and shows a hint until a material photo is taken, even with a valid fabric selected", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await user.type(screen.getByPlaceholderText("Full name *"), "Test Customer");
    await user.type(screen.getByPlaceholderText("Phone / WhatsApp *"), "9999999999");

    expect(screen.getByText("Take at least one photo of the material to continue.")).toBeInTheDocument();
    expect(screen.getByText("Next: Measurements →")).toBeDisabled();
  });

  it("renders Material photos as the last field group in step 1, after the fabric section", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);

    // Default customer mode: its details input comes before the photos.
    const custFabricSection = screen.getByText("Customer fabric details");
    expect(
      custFabricSection.compareDocumentPosition(screen.getByText("Material photos")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // Same ordering with the shop fabric picker
    await user.click(screen.getByText("From shop"));
    const fabricSection = screen.getByText("Shop fabric");
    expect(
      fabricSection.compareDocumentPosition(screen.getByText("Material photos")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("defaults to customer-supplied fabric, listed before From shop in the toggle", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);

    // Customer mode is the default — its input shows without any clicks.
    expect(screen.getByText("Customer fabric details")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Blue silk, floral print")).toBeInTheDocument();
    expect(screen.queryByText("Shop fabric")).not.toBeInTheDocument();

    // "Customer brings" renders first (left), "From shop" second.
    expect(
      screen.getByText("Customer brings").compareDocumentPosition(screen.getByText("From shop")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("switches to the shop fabric picker and computes fabric cost", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await user.click(screen.getByText("From shop"));
    expect(screen.getByText("Shop fabric")).toBeInTheDocument();
    await user.click(screen.getByText("Silk"));
    expect(screen.getByText(/Fabric cost:/)).toHaveTextContent("₹700"); // 350 * 2m default
  });

  it("recomputes fabric cost when the metres field changes", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await user.click(screen.getByText("From shop"));
    const metresInput = screen.getByPlaceholderText("Metres required");
    await user.clear(metresInput);
    await user.type(metresInput, "3");
    expect(screen.getByText(/Fabric cost:/)).toHaveTextContent("₹360"); // Cotton 120 * 3m
  });

  it("updates the style notes field on the measurements step", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await fillStep1AndAdvance(user, container);
    const notesInput = screen.getByPlaceholderText("Embroidery, piping, closures, special requests…");
    await user.type(notesInput, "Special request");
    expect(notesInput).toHaveValue("Special request");
  });

  it("switches back to customer-supplied fabric details after visiting the shop picker", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await user.click(screen.getByText("From shop"));
    expect(screen.queryByText("Customer fabric details")).not.toBeInTheDocument();
    await user.click(screen.getByText("Customer brings"));
    expect(screen.getByText("Customer fabric details")).toBeInTheDocument();
    expect(screen.queryByText("Shop fabric")).not.toBeInTheDocument();
  });

  it("advances to the measurements step and back button goes to step 1 instead of router.back", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await fillStep1AndAdvance(user, container);

    expect(screen.getByText("New Order · Step 2/3")).toBeInTheDocument();
    expect(screen.getByText("L.B")).toBeInTheDocument(); // blouse form column header

    await user.click(screen.getByLabelText("Back"));
    expect(screen.getByText("New Order · Step 1/3")).toBeInTheDocument();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it("moves from measurements to pricing", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await fillStep1AndAdvance(user, container);
    await user.click(screen.getByText("Next: Pricing →"));

    expect(screen.getByText("New Order · Step 3/3")).toBeInTheDocument();
    expect(screen.getByText("Order items")).toBeInTheDocument();
  });

  it("submits the order with computed totals and navigates to the orders list", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await user.click(screen.getByText("From shop")); // customer is the default now
    await fillStep1AndAdvance(user, container);
    await user.click(screen.getByText("Next: Pricing →"));

    // First row is the default "Blouse" line item (qty already 1) at ₹1500;
    // second row "Lining Blouse" gets qty 2 × ₹100 and a comment — its line
    // must contribute 200, not 100.
    await user.type(screen.getByLabelText("Blouse price"), "1500");
    await user.type(screen.getByLabelText("Lining Blouse quantity"), "2");
    await user.type(screen.getByLabelText("Lining Blouse price"), "100");
    await user.type(screen.getByLabelText("Lining Blouse comments"), "  double stitch ");
    const advanceInput = screen.getByText("Advance collected (₹)").parentElement!.querySelector("input")!;
    await user.type(advanceInput, "500");
    await fillDeliveryDate(user);

    // The on-screen summary uses the same qty × price math as the submission.
    expect(screen.getByText("Lining Blouse ×2 @ ₹100")).toBeInTheDocument();
    expect(screen.getByText("₹200")).toBeInTheDocument();
    expect(screen.getByText("₹1,940")).toBeInTheDocument();

    await user.click(screen.getByText("✓ Confirm & Place Order"));

    expect(createOrder).toHaveBeenCalledTimes(1);
    const submitted = vi.mocked(createOrder).mock.calls[0][0];
    expect(submitted).not.toHaveProperty("id"); // server allocates the id, not the client
    expect(submitted.dress).toBe("Blouse");
    expect(submitted.customer).toBe("Test Customer");
    expect(submitted.phone).toBe("9999999999");
    expect(submitted.status).toBe("new");
    expect(submitted.material).toMatch(/\(shop\)$/);
    // Cotton fabric 120 × 2m + Blouse 1×1500 + Lining Blouse 2×100.
    expect(submitted.amount).toBe(240 + 1500 + 200);
    expect(submitted.advance).toBe(500);
    // Cash is the default and the picker sits right under the field.
    expect(submitted.advanceMethod).toBe("cash");
    // Delivery money is only ever recorded by deliverOrder.
    expect(submitted.finalPayment).toBe(0);
    expect(submitted.finalPaymentMethod).toBeNull();
    expect(submitted.masterId).toBeNull();
    expect(submitted.tailorId).toBeNull();
    expect(submitted.lineItems).toEqual([
      { particulars: "Blouse", qty: 1, amount: 1500 },
      { particulars: "Lining Blouse", qty: 2, amount: 100, note: "double stitch" },
    ]);
    // Photos never ride inside the arguments (React caps base64 strings in
    // nested arrays at 1e6 chars) — they go as multipart Files instead.
    expect(submitted).not.toHaveProperty("materialImageUrls");
    expect(submitted).not.toHaveProperty("referenceImageUrls");
    expect(submitted).not.toHaveProperty("sketchDataUrl");
    const photos = vi.mocked(createOrder).mock.calls[0][1] as FormData;
    expect(photos).toBeInstanceOf(FormData);
    expect(photos.getAll("material")).toHaveLength(1);
    expect(photos.getAll("material")[0]).toBeInstanceOf(File);
    expect(photos.get("scanOrder")).toBeNull(); // manual orders never carry the scan flag

    expect(screen.getByText("Order placed successfully!")).toBeInTheDocument();
    expect(screen.getByText("B2401", { exact: false })).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalledWith("/admin/orders");

    await user.click(screen.getByText("Done"));
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders");
  });

  it("opens a WhatsApp share link with the order details when sharing", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await fillStep1AndAdvance(user, container);
    await user.click(screen.getByText("Next: Pricing →"));
    await fillDeliveryDate(user);
    await user.click(screen.getByText("✓ Confirm & Place Order"));

    await user.click(screen.getByText("Share on WhatsApp"));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target] = openSpy.mock.calls[0];
    expect(url).toContain("https://wa.me/919999999999");
    expect(decodeURIComponent(url as string)).toContain("/track/tok-abc123");
    expect(target).toBe("_blank");
    openSpy.mockRestore();
  });

  it("disables the submit button while a submission is in flight", async () => {
    let resolveCreate: (value: unknown) => void = () => {};
    vi.mocked(createOrder).mockImplementation(
      () => new Promise((resolve) => (resolveCreate = resolve)) as never
    );
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await fillStep1AndAdvance(user, container);
    await user.click(screen.getByText("Next: Pricing →"));
    await fillDeliveryDate(user);

    await user.click(screen.getByText("✓ Confirm & Place Order"));

    expect(screen.getByText("Placing order…")).toBeDisabled();
    expect(createOrder).toHaveBeenCalledTimes(1);

    resolveCreate({ id: "B2401", publicToken: "tok-abc123" });
    expect(await screen.findByText("Order placed successfully!")).toBeInTheDocument();
  });

  it("shows an error toast and re-enables submit when placing the order fails", async () => {
    vi.mocked(createOrder).mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await fillStep1AndAdvance(user, container);
    await user.click(screen.getByText("Next: Pricing →"));
    await fillDeliveryDate(user);

    await user.click(screen.getByText("✓ Confirm & Place Order"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't place the order");
    expect(screen.queryByText("Order placed successfully!")).not.toBeInTheDocument();
    expect(screen.getByText("✓ Confirm & Place Order")).not.toBeDisabled();
  });

  it("disables the submit button and shows a message until a delivery date is set", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await fillStep1AndAdvance(user, container);
    await user.click(screen.getByText("Next: Pricing →"));

    expect(screen.getByText("Delivery date is required.")).toBeInTheDocument();
    expect(screen.getByText("✓ Confirm & Place Order")).toBeDisabled();

    await fillDeliveryDate(user);
    expect(screen.queryByText("Delivery date is required.")).not.toBeInTheDocument();
    expect(screen.getByText("✓ Confirm & Place Order")).not.toBeDisabled();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("labels customer-supplied material correctly on submit", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    // Customer mode is already the default — no toggle click needed.
    await user.type(screen.getByPlaceholderText("e.g. Blue silk, floral print"), "Blue silk");
    await fillStep1AndAdvance(user, container);
    await user.click(screen.getByText("Next: Pricing →"));
    await fillDeliveryDate(user);
    await user.click(screen.getByText("✓ Confirm & Place Order"));

    const submitted = vi.mocked(createOrder).mock.calls[0][0];
    expect(submitted.material).toBe("Blue silk (customer)");
  });

  it("falls back to a generic label when customer fabric details are left blank", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await fillStep1AndAdvance(user, container); // default customer mode, no fabric text
    await user.click(screen.getByText("Next: Pricing →"));
    await fillDeliveryDate(user);
    await user.click(screen.getByText("✓ Confirm & Place Order"));

    const submitted = vi.mocked(createOrder).mock.calls[0][0];
    expect(submitted.material).toBe("Customer fabric (customer)");
  });

  it("treats a cleared quantity or amount field as zero", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await fillStep1AndAdvance(user, container);
    await user.click(screen.getByText("Next: Pricing →"));

    const amountInputs = screen.getAllByPlaceholderText("0");
    const qtyInput = amountInputs[0]; // Blouse qty, defaults to 1
    await user.clear(qtyInput);
    expect(qtyInput).toHaveValue(null);

    const amountInput = amountInputs[1];
    await user.type(amountInput, "5");
    await user.clear(amountInput);
    expect(amountInput).toHaveValue(null);
  });

  describe("draft persistence", () => {
    it("mirrors the in-progress order to localStorage and resumes it after a restart", async () => {
      const user = userEvent.setup();
      const { unmount } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await user.type(screen.getByPlaceholderText("Full name *"), "Test Customer");

      await waitFor(() => {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        expect(raw).toBeTruthy();
        expect(JSON.parse(raw!)).toMatchObject({ dress: "Blouse", name: "Test Customer" });
      });

      // Simulate the PWA being killed and reopened.
      unmount();
      render(<NewOrderWizard fabrics={TEST_FABRICS} />);

      expect(await screen.findByText(/Unfinished Blouse order for Test Customer/)).toBeInTheDocument();
      await user.click(screen.getByText("Resume draft"));

      expect(screen.getByText("New Order · Step 1/3")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Full name *")).toHaveValue("Test Customer");
    });

    it("discards a saved draft on request", async () => {
      const user = userEvent.setup();
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ dress: "Blouse", name: "Old Customer", step: 1 })
      );
      render(<NewOrderWizard fabrics={TEST_FABRICS} />);

      expect(await screen.findByText(/Unfinished Blouse order for Old Customer/)).toBeInTheDocument();
      await user.click(screen.getByText("Discard"));

      expect(screen.queryByText(/Unfinished Blouse order/)).not.toBeInTheDocument();
      expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it("ignores unparseable or dress-less drafts", async () => {
      window.localStorage.setItem(DRAFT_KEY, "not json{");
      render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await waitFor(() => {
        expect(screen.queryByText(/Unfinished/)).not.toBeInTheDocument();
      });
    });

    it("clears the draft once the order is placed", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await fillStep1AndAdvance(user, container);
      await user.click(screen.getByText("Next: Pricing →"));
      await fillDeliveryDate(user);

      await waitFor(() => expect(window.localStorage.getItem(DRAFT_KEY)).toBeTruthy());

      await user.click(screen.getByText("✓ Confirm & Place Order"));
      expect(await screen.findByText("Order placed successfully!")).toBeInTheDocument();
      expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    });
  });

  describe("dynamic fabrics", () => {
    it("disables Next and shows a hint when the shop has no fabrics yet", async () => {
      const user = userEvent.setup();
      render(<NewOrderWizard fabrics={[]} />);
      await chooseOrderType(user);
      await user.click(screen.getByText("From shop")); // customer is the default now

      await user.type(screen.getByPlaceholderText("Full name *"), "Test Customer");
      await user.type(screen.getByPlaceholderText("Phone / WhatsApp *"), "9999999999");

      expect(screen.getByText("Add at least one fabric to continue.")).toBeInTheDocument();
      expect(screen.getByText("Next: Measurements →")).toBeDisabled();
    });

    it("still allows customer-supplied fabric when the shop list is empty", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={[]} />);
      await chooseOrderType(user);

      // Customer mode is already the default — no toggle click needed.
      await user.type(screen.getByPlaceholderText("Full name *"), "Test Customer");
      await user.type(screen.getByPlaceholderText("Phone / WhatsApp *"), "9999999999");
      await takeMaterialPhoto(container);

      expect(screen.getByText("Next: Measurements →")).not.toBeDisabled();
    });

    it("opens the fabric manager from the add tile, and a newly added fabric becomes selectable", async () => {
      vi.mocked(createFabric).mockResolvedValue({ fabric: { id: "f9", name: "Organza", price: 260 } });
      const user = userEvent.setup();
      render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await user.click(screen.getByText("From shop"));

      await user.click(screen.getByText("+ Add fabric"));
      expect(screen.getByText("Manage fabrics")).toBeInTheDocument();

      await user.type(screen.getByLabelText("Fabric name"), "Organza");
      await user.type(screen.getByLabelText("Price per metre"), "260");
      await user.click(screen.getByText("Add", { selector: "button" }));
      expect(createFabric).toHaveBeenCalledWith({ name: "Organza", price: 260 });

      await user.click(screen.getByText("Done", { selector: "button" }));

      // The new fabric shows in the grid and can be selected for the order.
      await user.click(screen.getByText("Organza"));
      expect(screen.getByText(/Fabric cost:/)).toHaveTextContent("₹520"); // 260 * 2m
    });

    it("opens the fabric manager from the Manage link", async () => {
      const user = userEvent.setup();
      render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await user.click(screen.getByText("From shop"));

      await user.click(screen.getByText("Manage"));
      expect(screen.getByText("Manage fabrics")).toBeInTheDocument();
    });
  });

  // ── The measurement garment ("alavu blouse") ────────────────────────
  // The customer hands over a blouse of their own instead of standing for
  // measurements, so step 2 has nothing to ask.
  describe("measurement garment", () => {
    it("asks the question above the measurement form, unticked", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await fillStep1AndAdvance(user, container);

      expect(screen.getByLabelText(/customer gave a measurement blouse/i)).not.toBeChecked();
      expect(screen.getByLabelText("Length")).toBeInTheDocument();
    });

    it("names the garment after the book the order is in", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user, "Salwar");
      await fillStep1AndAdvance(user, container);

      expect(screen.getByLabelText(/customer gave a measurement salwar/i)).toBeInTheDocument();
    });

    // Folded away, not removed: the fast path is one tick and on to the
    // items, but "same blouse, two inches longer" is a real order.
    it("folds the measurement form away behind the note once ticked", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await fillStep1AndAdvance(user, container);

      await user.click(screen.getByLabelText(/customer gave a measurement blouse/i));

      expect(screen.getByText("Measurement blouse with us")).toBeInTheDocument();
      expect(screen.getByText("Add measurements (optional)")).toBeInTheDocument();
      // Still in the page, just not on screen until asked for.
      expect(screen.getByLabelText("Length")).not.toBeVisible();
      // Everything else on the step is untouched — the sketch and the
      // reference photos still matter for a garment we are copying.
      expect(screen.getByText("Garment sketch")).toBeInTheDocument();
    });

    it("opens the form on request and keeps what is typed into it", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await fillStep1AndAdvance(user, container);
      await user.click(screen.getByLabelText(/customer gave a measurement blouse/i));

      await user.click(screen.getByText("Add measurements (optional)"));
      expect(screen.getByLabelText("Length")).toBeVisible();

      await user.type(screen.getByLabelText("Length"), "16");
      // Once a figure exists the note says what it is — an adjustment to the
      // garment, not the garment's whole measurement.
      expect(screen.getByText(/anything below is an adjustment to it/i)).toBeInTheDocument();
    });

    // Measurements survive the tick now — a length noted before the customer
    // produced their blouse is still a length that has to be honoured.
    it("sends the flag alongside whatever measurements were entered", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await fillStep1AndAdvance(user, container);

      await user.type(screen.getByLabelText("Length"), "15");
      await user.click(screen.getByLabelText(/customer gave a measurement blouse/i));

      await user.click(screen.getByText("Next: Pricing →"));
      await fillDeliveryDate(user);
      await user.click(screen.getByText("✓ Confirm & Place Order"));

      await waitFor(() => expect(createOrder).toHaveBeenCalled());
      const [input] = vi.mocked(createOrder).mock.calls[0];
      expect(input.sampleGarment).toBe(true);
      expect(input.measurements).toMatchObject({ type: "blouse", length: "15" });
    });

    it("sends an empty template when nothing was measured", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await fillStep1AndAdvance(user, container);
      await user.click(screen.getByLabelText(/customer gave a measurement blouse/i));

      await user.click(screen.getByText("Next: Pricing →"));
      await fillDeliveryDate(user);
      await user.click(screen.getByText("✓ Confirm & Place Order"));

      await waitFor(() => expect(createOrder).toHaveBeenCalled());
      const [input] = vi.mocked(createOrder).mock.calls[0];
      expect(input.measurements).toMatchObject({ type: "blouse", length: "", bust: "" });
    });

    it("sends the measurements untouched, and the flag off, for an ordinary order", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await fillStep1AndAdvance(user, container);

      await user.type(screen.getByLabelText("Length"), "15");
      await user.click(screen.getByText("Next: Pricing →"));
      await fillDeliveryDate(user);
      await user.click(screen.getByText("✓ Confirm & Place Order"));

      await waitFor(() => expect(createOrder).toHaveBeenCalled());
      const [input] = vi.mocked(createOrder).mock.calls[0];
      expect(input.sampleGarment).toBe(false);
      expect(input.measurements).toMatchObject({ length: "15" });
    });

    // A half-entered order has to survive the PWA being killed by a call.
    it("keeps the tick in the saved draft and restores it on resume", async () => {
      const user = userEvent.setup();
      window.localStorage.clear();
      const { container, unmount } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await fillStep1AndAdvance(user, container);
      await user.click(screen.getByLabelText(/customer gave a measurement blouse/i));

      await waitFor(() =>
        expect(JSON.parse(window.localStorage.getItem(DRAFT_KEY)!)).toMatchObject({
          sampleGarment: true,
        })
      );
      unmount();

      render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await user.click(await screen.findByText("Resume draft"));
      expect(screen.getByLabelText(/customer gave a measurement blouse/i)).toBeChecked();
    });

    it("resumes a draft saved before the field existed as the measured order it was", async () => {
      const user = userEvent.setup();
      window.localStorage.clear();
      const { container, unmount } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await fillStep1AndAdvance(user, container);
      await waitFor(() => expect(window.localStorage.getItem(DRAFT_KEY)).toBeTruthy());

      // The same draft object with the key simply absent, which is exactly
      // what every draft written before this feature holds.
      const legacy = JSON.parse(window.localStorage.getItem(DRAFT_KEY)!);
      delete legacy.sampleGarment;
      unmount();
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(legacy));

      render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await user.click(await screen.findByText("Resume draft"));
      expect(screen.getByLabelText(/customer gave a measurement blouse/i)).not.toBeChecked();
      expect(screen.getByLabelText("Length")).toBeInTheDocument();
    });
  });

  describe("scan entry point", () => {
    it("offers the slip scanner from the order-type screen", async () => {
      const user = userEvent.setup();
      render(<NewOrderWizard fabrics={TEST_FABRICS} />);

      await user.click(screen.getByText("Scan order slip"));
      expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/scan");
    });

    it("shows the pending-drafts shortcut only when drafts are waiting", async () => {
      const user = userEvent.setup();
      const { unmount } = render(<NewOrderWizard fabrics={TEST_FABRICS} pendingDraftCount={0} />);
      expect(screen.queryByText(/waiting for verification/)).not.toBeInTheDocument();
      unmount();

      render(<NewOrderWizard fabrics={TEST_FABRICS} pendingDraftCount={3} />);
      await user.click(screen.getByText(/3 scanned drafts waiting for verification/));
      expect(mockRouter.push).toHaveBeenCalledWith("/admin/drafts");
    });
  });

  describe("scan verification (prefilled from a draft)", () => {
    function scanSource(overrides: Partial<ScanSource["extraction"]> = {}): ScanSource {
      return {
        draftId: "d1",
        scanImageUrl: "https://signed/scan.jpg",
        warnings: ["Verify measurements: Bust."],
        extraction: {
          bookType: "Blouse",
          bookTypeConfidence: "high",
          billNo: "2392",
          date: "25/6",
          dueDate: "30/6/2026",
          customerName: "Vaishnavi",
          customerNameConfidence: "high",
          phone: "9876543210",
          phoneConfidence: "high",
          measurements: [
            { key: "length", value: "14", confidence: "high" },
            { key: "bust", value: "36", note: "loose", confidence: "low" },
          ],
          lineItems: [{ particulars: "Blouse", qty: 2, amount: 400, confidence: "high" }],
          advance: "200",
          advanceConfidence: "high",
          writtenTotal: "800",
          writtenTotalConfidence: "high",
          extraNotes: ["L.B: ✓", "princess cut blouse"],
          ...overrides,
        },
      };
    }

    beforeEach(() => {
      vi.mocked(confirmDraft).mockReset();
      vi.mocked(confirmDraft).mockResolvedValue(undefined);
    });

    it("arrives with the measurement-garment tick already set when the slip was marked", async () => {
      render(
        <NewOrderWizard
          fabrics={TEST_FABRICS}
          scan={scanSource({ sampleGarment: true, measurements: [] })}
        />
      );

      await userEvent.setup().click(screen.getByText("Next: Measurements →"));
      expect(screen.getByLabelText(/customer gave a measurement blouse/i)).toBeChecked();
      expect(screen.getByLabelText("Length")).not.toBeVisible();
    });

    it("leaves the tick off for an ordinary slip, so the read measurements stand", async () => {
      render(<NewOrderWizard fabrics={TEST_FABRICS} scan={scanSource()} />);

      await userEvent.setup().click(screen.getByText("Next: Measurements →"));
      expect(screen.getByLabelText(/customer gave a measurement blouse/i)).not.toBeChecked();
      expect(screen.getByLabelText("Length")).toHaveValue(14);
    });

    it("skips the gate and prefills every step from the extraction", async () => {
      render(<NewOrderWizard fabrics={TEST_FABRICS} scan={scanSource()} />);

      // Straight into step 1 — the slip's printed header picked the type.
      expect(screen.getByText("Verify Scan · Step 1/3")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Full name *")).toHaveValue("Vaishnavi");
      expect(screen.getByPlaceholderText("Phone / WhatsApp *")).toHaveValue("9876543210");
      expect(screen.getByText("View scanned slip", { exact: false })).toBeInTheDocument();
      expect(screen.getByText("Verify measurements: Bust.")).toBeInTheDocument();

      // Material photo is optional for scanned orders — the fabric usually
      // isn't on hand at scan time — so step 1 is already passable.
      expect(screen.getByText("Next: Measurements →")).toBeEnabled();
      expect(
        screen.getByText("Optional for scanned orders — add a fabric photo if handy.")
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Take at least one photo of the material to continue.")
      ).not.toBeInTheDocument();
    });

    it("carries measurements, notes, items, advance and delivery into the steps", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} scan={scanSource()} />);
      await takeMaterialPhoto(container);
      await user.click(screen.getByText("Next: Measurements →"));

      expect(screen.getByDisplayValue("14")).toBeInTheDocument(); // length
      // Only the style writing rides into notes — no scan header, and the
      // bookkeeping "L.B: ✓" tick is filtered out.
      expect(screen.getByDisplayValue("princess cut blouse")).toBeInTheDocument();

      await user.click(screen.getByText("Next: Pricing →"));
      expect(screen.getByLabelText("Blouse quantity")).toHaveValue(2);
      expect(screen.getByLabelText("Blouse price")).toHaveValue(400);
      expect(screen.getByDisplayValue("200")).toBeInTheDocument(); // advance
      expect(screen.getByDisplayValue("2026-06-30")).toBeInTheDocument(); // delivery
    });

    it("asks for the order type when detection failed, then fills from the extraction", async () => {
      const user = userEvent.setup();
      render(<NewOrderWizard fabrics={TEST_FABRICS} scan={scanSource({ bookType: "unknown" })} />);

      expect(screen.getByText(/couldn't be detected from the slip/)).toBeInTheDocument();
      await chooseOrderType(user, "Blouse");

      expect(screen.getByPlaceholderText("Full name *")).toHaveValue("Vaishnavi");
      // Measurements were rebuilt from the extraction, not blanked.
      await takeMaterialPhoto(document.body);
      await user.click(screen.getByText("Next: Measurements →"));
      expect(screen.getByDisplayValue("14")).toBeInTheDocument();
    });

    it("does not offer or overwrite the manual localStorage draft", async () => {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ dress: "Salwar", name: "Manual Customer", step: 1 })
      );
      render(<NewOrderWizard fabrics={TEST_FABRICS} scan={scanSource()} />);

      await waitFor(() => {
        expect(screen.queryByText(/Unfinished Salwar order/)).not.toBeInTheDocument();
      });
      expect(JSON.parse(window.localStorage.getItem(DRAFT_KEY)!).name).toBe("Manual Customer");
    });

    it("submits without a material photo, flagged scanOrder, with the slip as a reference photo, then confirms the draft", async () => {
      const user = userEvent.setup();
      render(<NewOrderWizard fabrics={TEST_FABRICS} scan={scanSource()} />);
      // No material photo taken — optional in scan mode.
      await user.click(screen.getByText("Next: Measurements →"));
      await user.click(screen.getByText("Next: Pricing →"));
      await user.click(screen.getByText("✓ Confirm & Place Order"));

      expect(await screen.findByText("Order placed successfully!")).toBeInTheDocument();

      const [input, photos] = vi.mocked(createOrder).mock.calls[0];
      expect(input.customer).toBe("Vaishnavi");
      expect(input.phone).toBe("9876543210");
      expect(input.advance).toBe(200);
      // Customer fabric is the default now — no shop fabric cost, items only.
      expect(input.amount).toBe(800); // 2 × 400
      expect(input.material).toBe("Customer fabric (customer)");
      expect((photos as FormData).getAll("material")).toHaveLength(0);
      expect((photos as FormData).get("scanOrder")).toBe("1");
      const references = (photos as FormData).getAll("reference");
      expect(references).toHaveLength(1);
      expect(references[0]).toBeInstanceOf(File);

      expect(confirmDraft).toHaveBeenCalledWith("d1", "B2401");
    });

    // Regression: confirmDraft revalidates, so Next re-renders /admin/orders/new
    // as part of the action response — and by then the draft is confirmed. When
    // page.tsx answered that with redirect(), the admin was thrown onto the
    // order detail page a moment after the success modal appeared, before they
    // could tap "Share on WhatsApp".
    it("stays on the success modal when the re-render reports the draft as confirmed", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<NewOrderWizard fabrics={TEST_FABRICS} scan={scanSource()} />);
      await user.click(screen.getByText("Next: Measurements →"));
      await user.click(screen.getByText("Next: Pricing →"));
      await user.click(screen.getByText("✓ Confirm & Place Order"));
      expect(await screen.findByText("Order placed successfully!")).toBeInTheDocument();

      // What the revalidation re-render hands back: the draft is no longer
      // pending, it now points at the order this wizard just placed.
      rerender(<NewOrderWizard fabrics={TEST_FABRICS} staleDraftOrderId="B2401" />);

      expect(screen.getByText("Order placed successfully!")).toBeInTheDocument();
      expect(mockRouter.replace).not.toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();

      // The Done button still works and is still the only way out.
      await user.click(screen.getByText("Done"));
      expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders");
    });

    it("sends a genuinely stale ?draft= link to the order it already became", () => {
      render(<NewOrderWizard fabrics={TEST_FABRICS} staleDraftOrderId="B2401" />);
      expect(mockRouter.replace).toHaveBeenCalledWith("/admin/orders/B2401");
    });

    it("does not navigate when there is no stale draft", () => {
      render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it("still shows success when marking the draft confirmed fails", async () => {
      vi.mocked(confirmDraft).mockRejectedValue(new Error("offline"));
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} scan={scanSource()} />);
      await takeMaterialPhoto(container);
      await user.click(screen.getByText("Next: Measurements →"));
      await user.click(screen.getByText("Next: Pricing →"));
      await user.click(screen.getByText("✓ Confirm & Place Order"));

      expect(await screen.findByText("Order placed successfully!")).toBeInTheDocument();
    });
  });

  describe("advance payment method", () => {
    it("only asks how the advance was paid once an advance is entered", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await fillStep1AndAdvance(user, container);
      await user.click(screen.getByText("Next: Pricing →"));

      expect(screen.queryByText("How was the advance paid?")).not.toBeInTheDocument();

      const advanceInput = screen.getByText("Advance collected (₹)").parentElement!.querySelector("input")!;
      await user.type(advanceInput, "500");

      expect(screen.getByText("How was the advance paid?")).toBeInTheDocument();
    });

    it("records UPI when chosen", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await fillStep1AndAdvance(user, container);
      await user.click(screen.getByText("Next: Pricing →"));
      await user.type(
        screen.getByText("Advance collected (₹)").parentElement!.querySelector("input")!,
        "500"
      );
      await user.click(screen.getByText("UPI"));
      await fillDeliveryDate(user);
      await user.click(screen.getByText("✓ Confirm & Place Order"));

      const [submitted] = vi.mocked(createOrder).mock.calls[0];
      expect(submitted.advanceMethod).toBe("upi");
    });

    // No money changed hands, so there is no method to attribute.
    it("records no method when no advance was taken", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await fillStep1AndAdvance(user, container);
      await user.click(screen.getByText("Next: Pricing →"));
      await fillDeliveryDate(user);
      await user.click(screen.getByText("✓ Confirm & Place Order"));

      const [submitted] = vi.mocked(createOrder).mock.calls[0];
      expect(submitted.advance).toBe(0);
      expect(submitted.advanceMethod).toBeNull();
    });
  });


  // ── Multi-piece Blouse orders ─────────────────────────────────────────

  describe("splitting an order into several garments", () => {
    // The stepper sits in step 1 now, next to the material inputs it drives.
    async function reachPricing(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
      await fillStep1AndAdvance(user, container);
      await user.click(screen.getByText("Next: Pricing →"));
    }

    async function bumpPieces(user: ReturnType<typeof userEvent.setup>, times: number) {
      for (let i = 0; i < times; i++) {
        await user.click(screen.getByRole("button", { name: "One more piece" }));
      }
    }

    // One garment is the default, so the overwhelming majority of orders are
    // written exactly as they always were — no pieces at all.
    it("sends no pieces for a normal single-garment order", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      expect(screen.getByText("How many blouses?")).toBeInTheDocument();
      await reachPricing(user, container);

      await user.type(screen.getByLabelText("Blouse price"), "500");
      await fillDeliveryDate(user);
      await user.click(screen.getByText("✓ Confirm & Place Order"));

      expect(vi.mocked(createOrder).mock.calls[0][0]).not.toHaveProperty("pieces");
    });

    it("asks only for a count and gives every garment the order's date", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);

      // No per-garment name or date fields — the whole point of the simpler
      // form is that the common case types nothing extra.
      await bumpPieces(user, 2);
      expect(screen.queryByLabelText("Piece 1 name")).not.toBeInTheDocument();
      expect(screen.getByText(/Blouse 1–3 share this order's delivery date/)).toBeInTheDocument();

      await reachPricing(user, container);
      await user.type(screen.getByLabelText("Blouse price"), "500");
      await user.type(screen.getByLabelText("Blouse quantity"), "3");
      await fillDeliveryDate(user, "2026-07-20");
      expect(screen.getByText("3 garments")).toBeInTheDocument();

      await user.click(screen.getByText("✓ Confirm & Place Order"));

      expect(vi.mocked(createOrder).mock.calls[0][0].pieces).toEqual([
        { label: "Blouse 1", due: "2026-07-20" },
        { label: "Blouse 2", due: "2026-07-20" },
        { label: "Blouse 3", due: "2026-07-20" },
      ]);
    });

    it("drops back to a single garment when the count returns to one", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await bumpPieces(user, 1);
      await user.click(screen.getByRole("button", { name: "One less piece" }));

      await reachPricing(user, container);
      await user.type(screen.getByLabelText("Blouse price"), "500");
      await fillDeliveryDate(user);
      await user.click(screen.getByText("✓ Confirm & Place Order"));

      expect(vi.mocked(createOrder).mock.calls[0][0]).not.toHaveProperty("pieces");
    });

    // Both books take "several garments, one set of measurements" orders.
    it("is offered on a Salwar order too", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await user.click(screen.getByText("Salwar"));
      expect(screen.getByText("How many salwars?")).toBeInTheDocument();

      await bumpPieces(user, 1);
      await fillStep1AndAdvance(user, container);
      await user.click(screen.getByText("Next: Pricing →"));
      await user.type(screen.getByLabelText("Salwar price"), "900");
      await fillDeliveryDate(user, "2026-07-20");
      await user.click(screen.getByText("✓ Confirm & Place Order"));

      expect(vi.mocked(createOrder).mock.calls[0][0].pieces).toEqual([
        { label: "Salwar 1", due: "2026-07-20" },
        { label: "Salwar 2", due: "2026-07-20" },
      ]);
    });
  });

  describe("adding an item that isn't a printed row", () => {
    it("submits the added row and drops one left blank", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await fillStep1AndAdvance(user, container);
      await user.click(screen.getByText("Next: Pricing →"));

      await user.type(screen.getByLabelText("Blouse price"), "500");

      await user.click(screen.getByRole("button", { name: "Add item" }));
      await user.type(screen.getByLabelText(/name$/), "Kids frock");
      await user.type(screen.getByLabelText("Kids frock price"), "900");

      // A second added row, left entirely blank, must not reach the server.
      await user.click(screen.getByRole("button", { name: "Add item" }));

      await fillDeliveryDate(user);
      await user.click(screen.getByText("✓ Confirm & Place Order"));

      const submitted = vi.mocked(createOrder).mock.calls[0][0];
      expect(submitted.lineItems).toEqual([
        { particulars: "Blouse", qty: 1, amount: 500 },
        { particulars: "Kids frock", qty: 1, amount: 900 },
      ]);
      expect(submitted.amount).toBe(1400);
    });

    it("removes an added row again", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user);
      await fillStep1AndAdvance(user, container);
      await user.click(screen.getByText("Next: Pricing →"));

      await user.click(screen.getByRole("button", { name: "Add item" }));
      await user.type(screen.getByLabelText(/name$/), "Kids frock");
      expect(screen.getByLabelText("Kids frock price")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Remove Kids frock" }));
      expect(screen.queryByLabelText("Kids frock price")).not.toBeInTheDocument();
    });
  });

});
