import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MeasurementGrid from "./MeasurementGrid";
import type { BlouseMeasurements, SalwarMeasurements, GenericMeasurements, DualMeas } from "@/types";

const d = (lb: string, ob: string): DualMeas => ({ lb, ob });

describe("MeasurementGrid", () => {
  it("renders dual and single fields for a blouse, hiding empty ones", () => {
    const m: BlouseMeasurements = {
      type: "blouse",
      length: d("52", "52"),
      shoulder: d("14", ""),
      hs: d("", "7"),
      sl: d("", ""),
      mlos: d("14", "14"),
      tlos: d("24", "24"),
      ahs: d("15", "15"),
      bust: d("36", "38"),
      ub: d("32", "32"),
      waist: d("30", "30"),
      fnNr: d("8", "9"),
      bn: d("6", "7"),
      dart: "11",
      dbd: "",
      p: "3",
      sareeFall: "",
      piko: "",
    };
    render(<MeasurementGrid measurements={m} />);

    expect(screen.getByText("Length")).toBeInTheDocument();
    expect(screen.getAllByText("52")).toHaveLength(2);
    expect(screen.getByText("Shoulder")).toBeInTheDocument();
    expect(screen.getByText("Dart")).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "11 in")
    ).toBeInTheDocument();
    expect(screen.queryByText("Dist. Btwn Darts")).not.toBeInTheDocument();
    expect(screen.queryByText("Sleeve Length")).not.toBeInTheDocument();
  });

  it("renders top and pant fields for a salwar, plus shawl when present", () => {
    const m: SalwarMeasurements = {
      type: "salwar",
      top: {
        oShalwar: "46", lShalwar: "44", length: "50", shoulder: "14",
        hs: "7", sl: "22", tlcs: "20", ah: "16",
        bust: "36", ub: "32", waist: "30", hip: "38",
        fnNr: "7", bn: "5", height: "160",
      },
      pant: { hip: "38", waist: "30", kl: "56", tl: "48", fullLength: "100", yoke: "12" },
      shawl: "Given",
    };
    render(<MeasurementGrid measurements={m} />);

    expect(screen.getByText("M. Top")).toBeInTheDocument();
    expect(screen.getByText("Outer Shalwar")).toBeInTheDocument();
    expect(screen.getByText("M. Pant")).toBeInTheDocument();
    expect(screen.getByText("Knee Length")).toBeInTheDocument();
    expect(screen.getByText("Shawl")).toBeInTheDocument();
    expect(screen.getByText("Given")).toBeInTheDocument();
  });

  it("omits the shawl section when empty", () => {
    const m: SalwarMeasurements = {
      type: "salwar",
      top: {
        oShalwar: "", lShalwar: "", length: "", shoulder: "",
        hs: "", sl: "", tlcs: "", ah: "", bust: "", ub: "",
        waist: "", hip: "", fnNr: "", bn: "", height: "",
      },
      pant: { hip: "", waist: "", kl: "", tl: "", fullLength: "", yoke: "" },
      shawl: "",
    };
    render(<MeasurementGrid measurements={m} />);
    expect(screen.queryByText("Shawl")).not.toBeInTheDocument();
  });

  it("renders only populated fields for generic garments", () => {
    const m: GenericMeasurements = {
      type: "generic",
      bust: "34",
      waist: "",
      hip: "36",
      length: "",
      shoulder: "",
      sleeve: "",
      neckDepth: "",
      armRound: "",
    };
    render(<MeasurementGrid measurements={m} />);
    expect(screen.getByText("34 in")).toBeInTheDocument();
    expect(screen.getByText("36 in")).toBeInTheDocument();
    expect(screen.queryByText("waist", { exact: false })).not.toBeInTheDocument();
  });
});
