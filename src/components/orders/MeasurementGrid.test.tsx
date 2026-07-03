import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MeasurementGrid from "./MeasurementGrid";
import type { BlouseMeasurements, SalwarMeasurements, GenericMeasurements } from "@/types";

describe("MeasurementGrid", () => {
  it("renders blouse fields with the physical-order-form abbreviations, hiding empty ones", () => {
    const m: BlouseMeasurements = {
      type: "blouse",
      length: "52",
      shoulder: "14",
      hs: "",
      sl: "",
      mlos: "14",
      tlos: "24",
      ahs: "15",
      bust: "36",
      ub: "32",
      waist: "30",
      fnNr: "8",
      bn: "6",
      dart: "11",
      dbd: "",
      p: "3",
      sareeFall: "",
      piko: "",
    };
    render(<MeasurementGrid measurements={m} />);

    expect(screen.getByText("Length")).toBeInTheDocument();
    expect(screen.getByText("52 in")).toBeInTheDocument();
    expect(screen.getByText("UB")).toBeInTheDocument();
    expect(screen.getByText("32 in")).toBeInTheDocument();
    expect(screen.getByText("MLOS")).toBeInTheDocument();
    expect(screen.getByText("TLOS")).toBeInTheDocument();
    expect(screen.getByText("AHS")).toBeInTheDocument();
    expect(screen.getByText("FN / NR")).toBeInTheDocument();
    expect(screen.getByText("BN")).toBeInTheDocument();
    expect(screen.getByText("Dart")).toBeInTheDocument();
    expect(screen.getByText("11 in")).toBeInTheDocument();
    expect(screen.getByText("P")).toBeInTheDocument();
    expect(screen.queryByText("HS")).not.toBeInTheDocument();
    expect(screen.queryByText("S.L")).not.toBeInTheDocument();
    expect(screen.queryByText("DBD")).not.toBeInTheDocument();
  });

  it("renders top and pant fields for a salwar, plus shawl when present", () => {
    const m: SalwarMeasurements = {
      type: "salwar",
      top: {
        oShalwar: "46", lShalwar: "44", length: "50", shoulder: "14",
        hs: "7", sl: "22", tlcs: "20", ah: "16",
        bust: "36", ub: "32", waist: "30", hip: "38",
        fnNr: "7", bn: "5",
      },
      pant: { height: "160", hip: "38", waist: "30", kl: "56", tl: "48", fullLength: "100", yoke: "12" },
      shawl: "Given",
    };
    render(<MeasurementGrid measurements={m} />);

    expect(screen.getByText("M. Top")).toBeInTheDocument();
    expect(screen.getByText("O.Shalwar")).toBeInTheDocument();
    expect(screen.getByText("L.Shalwar")).toBeInTheDocument();
    expect(screen.getByText("AH")).toBeInTheDocument();
    expect(screen.getByText("TLCS")).toBeInTheDocument();
    expect(screen.getByText("M. Pant")).toBeInTheDocument();
    expect(screen.getByText("KL")).toBeInTheDocument();
    expect(screen.getByText("TL")).toBeInTheDocument();
    expect(screen.getByText("Shawl")).toBeInTheDocument();
    expect(screen.getByText("Given")).toBeInTheDocument();
  });

  it("renders Height under M. Pant, not M. Top", () => {
    const m: SalwarMeasurements = {
      type: "salwar",
      top: {
        oShalwar: "", lShalwar: "", length: "", shoulder: "",
        hs: "", sl: "", tlcs: "", ah: "", bust: "", ub: "",
        waist: "", hip: "", fnNr: "", bn: "",
      },
      pant: { height: "160", hip: "38", waist: "30", kl: "56", tl: "48", fullLength: "100", yoke: "12" },
      shawl: "",
    };
    render(<MeasurementGrid measurements={m} />);
    const pantGrid = screen.getByText("M. Pant").nextElementSibling!;
    expect(pantGrid).toHaveTextContent("Height");
    expect(pantGrid).toHaveTextContent("160 in");
    const topGrid = screen.getByText("M. Top").nextElementSibling!;
    expect(topGrid).not.toHaveTextContent("Height");
  });

  it("omits the shawl section when empty", () => {
    const m: SalwarMeasurements = {
      type: "salwar",
      top: {
        oShalwar: "", lShalwar: "", length: "", shoulder: "",
        hs: "", sl: "", tlcs: "", ah: "", bust: "", ub: "",
        waist: "", hip: "", fnNr: "", bn: "",
      },
      pant: { height: "", hip: "", waist: "", kl: "", tl: "", fullLength: "", yoke: "" },
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
