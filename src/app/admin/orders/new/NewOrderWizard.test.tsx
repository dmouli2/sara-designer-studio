import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewOrderWizard, { DRAFT_KEY, MAX_PHOTO_PAYLOAD_BYTES } from "./NewOrderWizard";
import { createOrder } from "@/app/actions/orders";
import { createFabric } from "@/app/actions/fabrics";
import { compressImageToDataUrl } from "@/lib/image";
import { mockRouter } from "../../../../../vitest.setup";
import type { Fabric } from "@/lib/db/types";

vi.mock("@/app/actions/orders", () => ({
  createOrder: vi.fn(),
}));

vi.mock("@/app/actions/fabrics", () => ({
  createFabric: vi.fn(),
  updateFabric: vi.fn(),
  deleteFabric: vi.fn(),
}));

vi.mock("@/lib/image", () => ({
  compressImageToDataUrl: vi.fn(),
  // Real implementation atob-decodes potentially huge strings — a cheap fake
  // keeps the oversized-payload test fast while preserving the File shape
  // the wizard sends to createOrder.
  dataUrlToFile: vi.fn(
    (dataUrl: string, filename: string) => new File(["decoded"], filename, { type: "image/jpeg" })
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
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await user.click(container.querySelector(".rounded-full")!);
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
      const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
      await chooseOrderType(user, "Blouse");
      await user.click(container.querySelector(".rounded-full")!);

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

      expect(screen.getByText("O.Shalwar")).toBeInTheDocument();
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

    const fabricSection = screen.getByText("Select fabric");
    const photosSection = screen.getByText("Material photos");
    expect(
      fabricSection.compareDocumentPosition(photosSection) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // Same ordering when the customer brings their own fabric
    await user.click(screen.getByText("Customer brings"));
    const custFabricSection = screen.getByText("Customer fabric details");
    expect(
      custFabricSection.compareDocumentPosition(screen.getByText("Material photos")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("shows the shop fabric picker by default and computes fabric cost", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    expect(screen.getByText("Select fabric")).toBeInTheDocument();
    await user.click(screen.getByText("Silk"));
    expect(screen.getByText(/Fabric cost:/)).toHaveTextContent("₹700"); // 350 * 2m default
  });

  it("recomputes fabric cost when the metres field changes", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
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

  it("switches to customer-supplied fabric details", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await user.click(screen.getByText("Customer brings"));
    expect(screen.getByText("Customer fabric details")).toBeInTheDocument();
    expect(screen.queryByText("Select fabric")).not.toBeInTheDocument();
  });

  it("advances to the measurements step and back button goes to step 1 instead of router.back", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard fabrics={TEST_FABRICS} />);
    await chooseOrderType(user);
    await fillStep1AndAdvance(user, container);

    expect(screen.getByText("New Order · Step 2/3")).toBeInTheDocument();
    expect(screen.getByText("L.B")).toBeInTheDocument(); // blouse form column header

    await user.click(container.querySelector(".rounded-full")!);
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
    await fillStep1AndAdvance(user, container);
    await user.click(screen.getByText("Next: Pricing →"));

    const amountInputs = screen.getAllByPlaceholderText("0");
    // Second row is "Lining Blouse" (qty 0 by default); bump its quantity too.
    await user.type(amountInputs[2], "2");
    // First row is the default "Blouse" line item (qty already 1); set its amount.
    await user.type(amountInputs[1], "1500");
    const advanceInput = screen.getByText("Advance collected (₹)").parentElement!.querySelector("input")!;
    await user.type(advanceInput, "500");
    await fillDeliveryDate(user);

    await user.click(screen.getByText("✓ Confirm & Place Order"));

    expect(createOrder).toHaveBeenCalledTimes(1);
    const submitted = vi.mocked(createOrder).mock.calls[0][0];
    expect(submitted).not.toHaveProperty("id"); // server allocates the id, not the client
    expect(submitted.dress).toBe("Blouse");
    expect(submitted.customer).toBe("Test Customer");
    expect(submitted.phone).toBe("9999999999");
    expect(submitted.status).toBe("new");
    expect(submitted.material).toMatch(/\(shop\)$/);
    expect(submitted.amount).toBeGreaterThan(0);
    expect(submitted.advance).toBe(500);
    expect(submitted.masterId).toBeNull();
    expect(submitted.tailorId).toBeNull();
    expect(submitted.lineItems.length).toBeGreaterThan(0);
    // Photos never ride inside the arguments (React caps base64 strings in
    // nested arrays at 1e6 chars) — they go as multipart Files instead.
    expect(submitted).not.toHaveProperty("materialImageUrls");
    expect(submitted).not.toHaveProperty("referenceImageUrls");
    expect(submitted).not.toHaveProperty("sketchDataUrl");
    const photos = vi.mocked(createOrder).mock.calls[0][1] as FormData;
    expect(photos).toBeInstanceOf(FormData);
    expect(photos.getAll("material")).toHaveLength(1);
    expect(photos.getAll("material")[0]).toBeInstanceOf(File);

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
    await user.click(screen.getByText("Customer brings"));
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
    await user.click(screen.getByText("Customer brings"));
    await fillStep1AndAdvance(user, container);
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

      await user.type(screen.getByPlaceholderText("Full name *"), "Test Customer");
      await user.type(screen.getByPlaceholderText("Phone / WhatsApp *"), "9999999999");

      expect(screen.getByText("Add at least one fabric to continue.")).toBeInTheDocument();
      expect(screen.getByText("Next: Measurements →")).toBeDisabled();
    });

    it("still allows customer-supplied fabric when the shop list is empty", async () => {
      const user = userEvent.setup();
      const { container } = render(<NewOrderWizard fabrics={[]} />);
      await chooseOrderType(user);

      await user.click(screen.getByText("Customer brings"));
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

      await user.click(screen.getByText("Manage"));
      expect(screen.getByText("Manage fabrics")).toBeInTheDocument();
    });
  });
});
