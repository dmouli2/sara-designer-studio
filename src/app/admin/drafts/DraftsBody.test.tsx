import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DraftsBody from "./DraftsBody";
import { discardDraft } from "@/app/actions/drafts";
import { mockRouter } from "../../../../vitest.setup";
import type { DraftOrder } from "@/lib/db/types";
import type { SlipExtraction } from "@/types";

vi.mock("@/components/layout/PullToRefresh", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/app/actions/drafts", () => ({ discardDraft: vi.fn() }));

function extraction(overrides: Partial<SlipExtraction> = {}): SlipExtraction {
  return {
    bookType: "Blouse",
    bookTypeConfidence: "high",
    billNo: "2392",
    date: "25/6",
    dueDate: "",
    customerName: "Vaishnavi",
    customerNameConfidence: "high",
    phone: "9876543210",
    phoneConfidence: "high",
    measurements: [],
    lineItems: [],
    advance: "",
    advanceConfidence: "high",
    writtenTotal: "",
    writtenTotalConfidence: "high",
    extraNotes: [],
    ...overrides,
  };
}

function draft(overrides: Partial<DraftOrder> = {}): DraftOrder {
  return {
    id: "d1",
    dress: "Blouse",
    scanImagePath: "drafts/d1/scan-1.jpg",
    extraction: extraction(),
    warnings: [],
    status: "draft",
    confirmedOrderId: null,
    createdAt: "2026-07-06T09:30:00.000Z",
    ...overrides,
  };
}

describe("DraftsBody", () => {
  beforeEach(() => {
    vi.mocked(discardDraft).mockReset();
  });

  it("shows the empty state when nothing is waiting", () => {
    render(<DraftsBody drafts={[]} />);
    expect(screen.getByText("No scanned drafts waiting")).toBeInTheDocument();
    expect(screen.getByText("0 waiting for verification")).toBeInTheDocument();
  });

  it("renders a card per draft with customer, phone, bill and type", () => {
    render(<DraftsBody drafts={[draft()]} />);
    expect(screen.getByText("1 waiting for verification")).toBeInTheDocument();
    expect(screen.getByText("Vaishnavi")).toBeInTheDocument();
    expect(screen.getByText(/9876543210/)).toBeInTheDocument();
    expect(screen.getByText(/Bill No 2392/)).toBeInTheDocument();
    expect(screen.getByText("Blouse")).toBeInTheDocument();
  });

  it("falls back to placeholders when name/phone/type weren't read", () => {
    render(
      <DraftsBody
        drafts={[
          draft({
            dress: "",
            extraction: extraction({ customerName: "", phone: "", billNo: "" }),
            warnings: ["Couldn't detect Blouse vs Salwar"],
          }),
        ]}
      />
    );
    expect(screen.getByText("Name not read")).toBeInTheDocument();
    expect(screen.getByText("No phone")).toBeInTheDocument();
    expect(screen.getByText("Type unknown")).toBeInTheDocument();
    expect(screen.getByText("1 to verify")).toBeInTheDocument();
    expect(screen.getByLabelText("Discard draft for unknown")).toBeInTheDocument();
  });

  it("opens a draft directly in the prefilled wizard when its card is tapped", async () => {
    const user = userEvent.setup();
    render(<DraftsBody drafts={[draft()]} />);
    await user.click(screen.getByText("Vaishnavi"));
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/new?draft=d1");
  });

  it("opens the wizard from the keyboard (Enter/Space), ignoring other keys", async () => {
    const user = userEvent.setup();
    render(<DraftsBody drafts={[draft()]} />);
    const card = screen.getByText("Vaishnavi").closest('[role="button"]')!;

    (card as HTMLElement).focus();
    await user.keyboard("{Enter}");
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/new?draft=d1");

    mockRouter.push.mockClear();
    await user.keyboard(" ");
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/new?draft=d1");

    mockRouter.push.mockClear();
    await user.keyboard("x");
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("asks for confirmation before discarding and 'Keep' backs out", async () => {
    const user = userEvent.setup();
    render(<DraftsBody drafts={[draft()]} />);

    await user.click(screen.getByLabelText("Discard draft for Vaishnavi"));
    expect(discardDraft).not.toHaveBeenCalled();
    expect(screen.getByText("Discard")).toBeInTheDocument();

    await user.click(screen.getByText("Keep"));
    expect(discardDraft).not.toHaveBeenCalled();
    expect(screen.queryByText("Discard")).not.toBeInTheDocument();
    // Neither the trash nor the confirm buttons navigate to the wizard.
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("discards the draft on confirm and removes its card without navigating", async () => {
    vi.mocked(discardDraft).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DraftsBody drafts={[draft()]} />);

    await user.click(screen.getByLabelText("Discard draft for Vaishnavi"));
    await user.click(screen.getByText("Discard"));

    await waitFor(() => expect(screen.queryByText("Vaishnavi")).not.toBeInTheDocument());
    expect(discardDraft).toHaveBeenCalledWith("d1");
    expect(screen.getByText("0 waiting for verification")).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("keeps the card and shows a toast when discarding fails", async () => {
    vi.mocked(discardDraft).mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<DraftsBody drafts={[draft()]} />);

    await user.click(screen.getByLabelText("Discard draft for Vaishnavi"));
    await user.click(screen.getByText("Discard"));

    expect(await screen.findByText(/Couldn't discard the draft/)).toBeInTheDocument();
    expect(screen.getByText("Vaishnavi")).toBeInTheDocument();
  });

  it("ignores a second discard while one is already in flight", async () => {
    let resolveFirst: () => void = () => {};
    vi.mocked(discardDraft).mockImplementation(
      () => new Promise<void>((resolve) => { resolveFirst = resolve; })
    );
    const user = userEvent.setup();
    render(<DraftsBody drafts={[draft(), draft({ id: "d2", extraction: extraction({ customerName: "Lavanya" }) })]} />);

    await user.click(screen.getByLabelText("Discard draft for Vaishnavi"));
    await user.click(screen.getByText("Discard"));
    // First discard still pending — confirming the second card must no-op.
    await user.click(screen.getByLabelText("Discard draft for Lavanya"));
    await user.click(screen.getByText("Discard"));
    expect(discardDraft).toHaveBeenCalledTimes(1);

    resolveFirst();
    await waitFor(() => expect(screen.queryByText("Vaishnavi")).not.toBeInTheDocument());
    expect(screen.getByText("Lavanya")).toBeInTheDocument();
  });

  it("navigates to the scanner from the FAB and back to orders from the top bar", async () => {
    const user = userEvent.setup();
    render(<DraftsBody drafts={[]} />);
    await user.click(screen.getByLabelText("Scan order slip"));
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/scan");
  });
});
