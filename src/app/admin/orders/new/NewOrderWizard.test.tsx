import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewOrderWizard from "./NewOrderWizard";
import { createOrder } from "@/app/actions/orders";
import { mockRouter } from "../../../../../vitest.setup";

vi.mock("@/app/actions/orders", () => ({
  createOrder: vi.fn(),
}));

async function fillStep1AndAdvance(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Full name *"), "Test Customer");
  await user.type(screen.getByPlaceholderText("Phone / WhatsApp *"), "9999999999");
  await user.click(screen.getByText("Next: Measurements →"));
}

async function fillDeliveryDate(user: ReturnType<typeof userEvent.setup>, value = "2026-07-20") {
  const deliveryInput = screen.getByText("Delivery date *").parentElement!.querySelector("input")!;
  await user.type(deliveryInput, value);
}

describe("NewOrderWizard", () => {
  beforeEach(() => {
    vi.mocked(createOrder).mockReset();
    vi.mocked(createOrder).mockResolvedValue({ publicToken: "tok-abc123" } as never);
  });

  it("shows step 1 with the Next button disabled until name and phone are filled", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard />);

    expect(screen.getByText("New Order · Step 1/3")).toBeInTheDocument();
    const nextBtn = screen.getByText("Next: Measurements →");
    expect(nextBtn).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Full name *"), "Test Customer");
    expect(nextBtn).toBeDisabled();
    await user.type(screen.getByPlaceholderText("Phone / WhatsApp *"), "9999999999");
    expect(nextBtn).not.toBeDisabled();
  });

  it("rejects an invalid phone number and blocks advancing to step 2", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard />);
    const nextBtn = screen.getByText("Next: Measurements →");

    await user.type(screen.getByPlaceholderText("Full name *"), "Test Customer");
    await user.type(screen.getByPlaceholderText("Phone / WhatsApp *"), "12345");

    expect(screen.getByText("Enter a valid 10-digit Indian mobile number.")).toBeInTheDocument();
    expect(nextBtn).toBeDisabled();
  });

  it("accepts a phone number with a +91 prefix", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard />);
    await user.type(screen.getByPlaceholderText("Full name *"), "Test Customer");
    await user.type(screen.getByPlaceholderText("Phone / WhatsApp *"), "+919876543210");

    expect(screen.queryByText("Enter a valid 10-digit Indian mobile number.")).not.toBeInTheDocument();
    expect(screen.getByText("Next: Measurements →")).not.toBeDisabled();
  });

  it("shows the shop fabric picker by default and computes fabric cost", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard />);
    expect(screen.getByText("Select fabric")).toBeInTheDocument();
    await user.click(screen.getByText("Silk"));
    expect(screen.getByText(/Fabric cost:/)).toHaveTextContent("₹700"); // 350 * 2m default
  });

  it("recomputes fabric cost when the metres field changes", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard />);
    const metresInput = screen.getByPlaceholderText("Metres required");
    await user.clear(metresInput);
    await user.type(metresInput, "3");
    expect(screen.getByText(/Fabric cost:/)).toHaveTextContent("₹360"); // Cotton 120 * 3m
  });

  it("updates the style notes field", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard />);
    const notesInput = screen.getByPlaceholderText("Embroidery, piping, closures, special requests…");
    await user.type(notesInput, "Special request");
    expect(notesInput).toHaveValue("Special request");
  });

  it("switches to customer-supplied fabric details", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard />);
    await user.click(screen.getByText("Customer brings"));
    expect(screen.getByText("Customer fabric details")).toBeInTheDocument();
    expect(screen.queryByText("Select fabric")).not.toBeInTheDocument();
  });

  it("goes back to the orders list when back is clicked on step 1", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard />);
    await user.click(container.querySelector(".rounded-full")!);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("advances to the measurements step and back button goes to step 1 instead of router.back", async () => {
    const user = userEvent.setup();
    const { container } = render(<NewOrderWizard />);
    await fillStep1AndAdvance(user);

    expect(screen.getByText("New Order · Step 2/3")).toBeInTheDocument();
    expect(screen.getByText("L.B")).toBeInTheDocument(); // blouse form dual header

    await user.click(container.querySelector(".rounded-full")!);
    expect(screen.getByText("New Order · Step 1/3")).toBeInTheDocument();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it("switches the measurement form when the dress type changes to Salwar", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard />);
    await user.selectOptions(screen.getByDisplayValue("Blouse"), "Salwar");
    await user.type(screen.getByPlaceholderText("Full name *"), "Test Customer");
    await user.type(screen.getByPlaceholderText("Phone / WhatsApp *"), "9999999999");
    await user.click(screen.getByText("Next: Measurements →"));

    expect(screen.getByText("Outer Shalwar")).toBeInTheDocument();
  });

  it("moves from measurements to pricing", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard />);
    await fillStep1AndAdvance(user);
    await user.click(screen.getByText("Next: Pricing →"));

    expect(screen.getByText("New Order · Step 3/3")).toBeInTheDocument();
    expect(screen.getByText("Order items")).toBeInTheDocument();
  });

  it("submits the order with computed totals and navigates to the orders list", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard />);
    await fillStep1AndAdvance(user);
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
    expect(submitted.id).toMatch(/^SDS-\d+$/);
    expect(submitted.customer).toBe("Test Customer");
    expect(submitted.phone).toBe("9999999999");
    expect(submitted.status).toBe("new");
    expect(submitted.material).toMatch(/\(shop\)$/);
    expect(submitted.amount).toBeGreaterThan(0);
    expect(submitted.advance).toBe(500);
    expect(submitted.masterId).toBeNull();
    expect(submitted.tailorId).toBeNull();
    expect(submitted.lineItems.length).toBeGreaterThan(0);

    expect(screen.getByText("Order placed successfully!")).toBeInTheDocument();
    expect(screen.getByText(submitted.id, { exact: false })).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalledWith("/admin/orders");

    await user.click(screen.getByText("Done"));
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders");
  });

  it("opens a WhatsApp share link with the order details when sharing", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    render(<NewOrderWizard />);
    await fillStep1AndAdvance(user);
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
    const user = userEvent.setup();
    render(<NewOrderWizard />);
    await fillStep1AndAdvance(user);
    await user.click(screen.getByText("Next: Pricing →"));
    await fillDeliveryDate(user);

    await user.click(screen.getByText("✓ Confirm & Place Order"));

    expect(screen.getByText("Placing order…")).toBeDisabled();
    expect(createOrder).toHaveBeenCalledTimes(1);
  });

  it("disables the submit button and shows a message until a delivery date is set", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard />);
    await fillStep1AndAdvance(user);
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
    render(<NewOrderWizard />);
    await user.click(screen.getByText("Customer brings"));
    await user.type(screen.getByPlaceholderText("e.g. Blue silk, floral print"), "Blue silk");
    await fillStep1AndAdvance(user);
    await user.click(screen.getByText("Next: Pricing →"));
    await fillDeliveryDate(user);
    await user.click(screen.getByText("✓ Confirm & Place Order"));

    const submitted = vi.mocked(createOrder).mock.calls[0][0];
    expect(submitted.material).toBe("Blue silk (customer)");
  });

  it("falls back to a generic label when customer fabric details are left blank", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard />);
    await user.click(screen.getByText("Customer brings"));
    await fillStep1AndAdvance(user);
    await user.click(screen.getByText("Next: Pricing →"));
    await fillDeliveryDate(user);
    await user.click(screen.getByText("✓ Confirm & Place Order"));

    const submitted = vi.mocked(createOrder).mock.calls[0][0];
    expect(submitted.material).toBe("Customer fabric (customer)");
  });

  it("treats a cleared quantity or amount field as zero", async () => {
    const user = userEvent.setup();
    render(<NewOrderWizard />);
    await fillStep1AndAdvance(user);
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
});
