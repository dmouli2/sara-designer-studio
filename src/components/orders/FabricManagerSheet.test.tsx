import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FabricManagerSheet from "./FabricManagerSheet";
import { createFabric, updateFabric, deleteFabric } from "@/app/actions/fabrics";
import type { Fabric } from "@/lib/db/types";

vi.mock("@/app/actions/fabrics", () => ({
  createFabric: vi.fn(),
  updateFabric: vi.fn(),
  deleteFabric: vi.fn(),
}));

const FABRICS: Fabric[] = [
  { id: "f1", name: "Cotton", price: 120 },
  { id: "f2", name: "Silk", price: 350 },
];

describe("FabricManagerSheet", () => {
  const onChange = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    onChange.mockReset();
    onClose.mockReset();
    vi.mocked(createFabric).mockReset();
    vi.mocked(updateFabric).mockReset();
    vi.mocked(deleteFabric).mockReset();
  });

  function renderSheet(fabrics: Fabric[] = FABRICS, open = true) {
    return render(<FabricManagerSheet open={open} fabrics={fabrics} onChange={onChange} onClose={onClose} />);
  }

  it("renders nothing when closed", () => {
    const { container } = renderSheet(FABRICS, false);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists the fabrics with their per-metre price", () => {
    renderSheet();
    expect(screen.getByText("Cotton")).toBeInTheDocument();
    expect(screen.getByText("₹120/m")).toBeInTheDocument();
    expect(screen.getByText("Silk")).toBeInTheDocument();
    expect(screen.getByText("₹350/m")).toBeInTheDocument();
  });

  it("shows an empty state when there are no fabrics", () => {
    renderSheet([]);
    expect(screen.getByText(/No fabrics yet/)).toBeInTheDocument();
  });

  it("adds a fabric, reports the sorted list, and clears the form", async () => {
    vi.mocked(createFabric).mockResolvedValue({ fabric: { id: "f9", name: "Organza", price: 260 } });
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Fabric name"), "Organza");
    await user.type(screen.getByLabelText("Price per metre"), "260");
    await user.click(screen.getByText("Add", { selector: "button" }));

    expect(createFabric).toHaveBeenCalledWith({ name: "Organza", price: 260 });
    expect(onChange).toHaveBeenCalledWith([
      { id: "f1", name: "Cotton", price: 120 },
      { id: "f9", name: "Organza", price: 260 },
      { id: "f2", name: "Silk", price: 350 },
    ]);
    expect(screen.getByLabelText("Fabric name")).toHaveValue("");
    expect(screen.getByLabelText("Price per metre")).toHaveValue(null);
  });

  it("disables Add until a name and price are entered", async () => {
    const user = userEvent.setup();
    renderSheet();
    const addButton = screen.getByText("Add", { selector: "button" });

    expect(addButton).toBeDisabled();
    await user.type(screen.getByLabelText("Fabric name"), "Organza");
    expect(addButton).toBeDisabled();
    await user.type(screen.getByLabelText("Price per metre"), "260");
    expect(addButton).not.toBeDisabled();
  });

  it("shows the server error (e.g. duplicate name) and keeps the form values", async () => {
    vi.mocked(createFabric).mockResolvedValue({ error: "A fabric with this name already exists." });
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Fabric name"), "Silk");
    await user.type(screen.getByLabelText("Price per metre"), "350");
    await user.click(screen.getByText("Add", { selector: "button" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A fabric with this name already exists.");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Fabric name")).toHaveValue("Silk");
  });

  it("edits a fabric's price inline and reports the updated list", async () => {
    vi.mocked(updateFabric).mockResolvedValue({ fabric: { id: "f2", name: "Silk", price: 380 } });
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByLabelText("Edit Silk"));
    const priceInput = screen.getByLabelText("Edit price for Silk");
    await user.clear(priceInput);
    await user.type(priceInput, "380");
    await user.click(screen.getByLabelText("Save Silk"));

    expect(updateFabric).toHaveBeenCalledWith("f2", { name: "Silk", price: 380 });
    expect(onChange).toHaveBeenCalledWith([
      { id: "f1", name: "Cotton", price: 120 },
      { id: "f2", name: "Silk", price: 380 },
    ]);
  });

  it("can cancel an edit without saving", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByLabelText("Edit Silk"));
    await user.click(screen.getByLabelText("Cancel editing Silk"));

    expect(updateFabric).not.toHaveBeenCalled();
    expect(screen.getByText("₹350/m")).toBeInTheDocument();
  });

  it("shows the server error when an edit fails", async () => {
    vi.mocked(updateFabric).mockResolvedValue({ error: "Couldn't save the fabric. Check your connection and try again." });
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByLabelText("Edit Silk"));
    await user.click(screen.getByLabelText("Save Silk"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the fabric");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("deletes a fabric after confirmation and reports the shrunken list", async () => {
    vi.mocked(deleteFabric).mockResolvedValue({});
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByLabelText("Delete Cotton"));
    expect(screen.getByText("Delete Cotton?")).toBeInTheDocument();

    await user.click(screen.getByText("Delete fabric"));

    expect(deleteFabric).toHaveBeenCalledWith("f1");
    expect(onChange).toHaveBeenCalledWith([{ id: "f2", name: "Silk", price: 350 }]);
  });

  it("keeps the fabric and shows the error when deletion fails", async () => {
    vi.mocked(deleteFabric).mockResolvedValue({ error: "Couldn't delete the fabric. Check your connection and try again." });
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByLabelText("Delete Cotton"));
    await user.click(screen.getByText("Delete fabric"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't delete the fabric");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("can abort a delete from the confirmation dialog", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByLabelText("Delete Cotton"));
    await user.click(screen.getByText("Cancel", { selector: "button" }));

    expect(deleteFabric).not.toHaveBeenCalled();
  });

  it("closes via the header X and the Done button", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByLabelText("Close fabric manager"));
    await user.click(screen.getByText("Done", { selector: "button" }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
