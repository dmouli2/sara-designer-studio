import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createGeminiSlipExtractor, coerceExtraction } from "./slipExtractor";

const DATA_URL = "data:image/jpeg;base64,c2Nhbg==";

const goodExtraction = {
  bookType: "Blouse",
  bookTypeConfidence: "high",
  billNo: "2392",
  date: "25/6",
  dueDate: "30/6",
  customerName: "Vaishnavi",
  customerNameConfidence: "high",
  phone: "98765 43210",
  phoneConfidence: "high",
  measurements: [{ key: "length", value: "14", confidence: "high" }],
  lineItems: [{ particulars: "Blouse", qty: 1, amount: 400, confidence: "high" }],
  advance: "200",
  advanceConfidence: "high",
  writtenTotal: "400",
  writtenTotalConfidence: "high",
  extraNotes: ["L.B: ✓"],
};

function geminiResponse(payload: unknown, init?: { status?: number }) {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    { status: init?.status ?? 200 }
  );
}

describe("createGeminiSlipExtractor", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.GEMINI_MODEL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
  });

  it("sends the image and prompt with structured-output config and maps the result", async () => {
    fetchMock.mockResolvedValue(geminiResponse(goodExtraction));
    const extractor = createGeminiSlipExtractor({ retryDelayMs: 0 });

    const result = await extractor.extract(DATA_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("gemini-2.5-flash:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0].inlineData).toEqual({ mimeType: "image/jpeg", data: "c2Nhbg==" });
    expect(body.contents[0].parts[1].text).toContain("BLOUSE ORDER FORM");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.temperature).toBe(0);
    expect(body.generationConfig.maxOutputTokens).toBe(32768);
    expect(body.generationConfig.responseSchema.properties.bookType.enum).toEqual([
      "Blouse", "Salwar", "unknown",
    ]);
    expect(body.contents[0].parts[1].text).toContain("STEP 0");
    expect(body.generationConfig.responseSchema.properties.imageProblem).toEqual({
      type: "STRING",
      enum: ["ok", "not_a_slip", "unreadable"], // Gemini rejects "" in enums
    });

    expect(result.bookType).toBe("Blouse");
    expect(result.customerName).toBe("Vaishnavi");
    expect(result.phone).toBe("9876543210"); // non-digits stripped
  });

  it("honours the GEMINI_MODEL override", async () => {
    process.env.GEMINI_MODEL = "gemini-custom";
    fetchMock.mockResolvedValue(geminiResponse(goodExtraction));

    await createGeminiSlipExtractor({ retryDelayMs: 0 }).extract(DATA_URL);

    expect(fetchMock.mock.calls[0][0]).toContain("gemini-custom:generateContent");
  });

  it("throws a setup error when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(createGeminiSlipExtractor().extract(DATA_URL)).rejects.toThrow("GEMINI_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-data-URL image", async () => {
    await expect(createGeminiSlipExtractor().extract("https://example.com/x.jpg")).rejects.toThrow(
      "Invalid scan image data URL"
    );
  });

  it("retries on 429 and succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(geminiResponse(goodExtraction));

    const result = await createGeminiSlipExtractor({ retryDelayMs: 0 }).extract(DATA_URL);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.bookType).toBe("Blouse");
  });

  it("retries up to 3 attempts on repeated 503s then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(geminiResponse(goodExtraction));

    const result = await createGeminiSlipExtractor({ retryDelayMs: 0 }).extract(DATA_URL);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.bookType).toBe("Blouse");
  });

  it("surfaces a friendly quota message when all 3 attempts hit 429", async () => {
    fetchMock.mockResolvedValue(new Response("busy", { status: 429 }));
    await expect(createGeminiSlipExtractor({ retryDelayMs: 0 }).extract(DATA_URL)).rejects.toThrow(
      "free scanning quota"
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("surfaces a busy-service message when all 3 attempts hit 503", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 503 }));
    await expect(createGeminiSlipExtractor({ retryDelayMs: 0 }).extract(DATA_URL)).rejects.toThrow(
      "Google's free AI service is busy right now"
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports the status when a non-503 5xx persists across all attempts", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(createGeminiSlipExtractor({ retryDelayMs: 0 }).extract(DATA_URL)).rejects.toThrow(
      "Google's free AI service is busy right now"
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry on a 4xx client error", async () => {
    fetchMock.mockResolvedValue(new Response("bad", { status: 400 }));
    await expect(createGeminiSlipExtractor({ retryDelayMs: 0 }).extract(DATA_URL)).rejects.toThrow(
      "HTTP 400"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws the retake message when the response has no text or bad JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [] }), { status: 200 }));
    await expect(createGeminiSlipExtractor({ retryDelayMs: 0 }).extract(DATA_URL)).rejects.toThrow(
      "retake the photo"
    );

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }),
        { status: 200 }
      )
    );
    await expect(createGeminiSlipExtractor({ retryDelayMs: 0 }).extract(DATA_URL)).rejects.toThrow(
      "retake the photo"
    );
  });
});

describe("coerceExtraction", () => {
  it("fills a complete default shape from garbage input", () => {
    const result = coerceExtraction(null);
    expect(result).toEqual({
      bookType: "unknown",
      bookTypeConfidence: "low",
      billNo: "",
      date: "",
      dueDate: "",
      customerName: "",
      customerNameConfidence: "low",
      phone: "",
      phoneConfidence: "low",
      measurements: [],
      lineItems: [],
      advance: "",
      advanceConfidence: "low",
      writtenTotal: "",
      writtenTotalConfidence: "low",
      extraNotes: [],
    });
  });

  it("drops empty/invalid measurement and line-item entries and keeps notes", () => {
    const result = coerceExtraction({
      bookType: "Salwar",
      measurements: [
        { key: "top.length", value: "42", note: "loose", confidence: "high" },
        { key: "", value: "9", confidence: "high" }, // no key → dropped
        { key: "top.hip", value: "", confidence: "low" }, // no value & no note → dropped
        "junk",
      ],
      lineItems: [
        { particulars: "Salwar", qty: 1, amount: 600, note: " ", confidence: "weird" },
        { particulars: "", qty: 1, amount: 1, confidence: "high" }, // no name → dropped
        { particulars: "Maxi", qty: -2, amount: Infinity, confidence: "high" }, // numbers sanitised
      ],
      extraNotes: ["ok", "", 42],
    });
    expect(result.measurements).toEqual([
      { key: "top.length", value: "42", note: "loose", confidence: "high" },
    ]);
    expect(result.lineItems).toEqual([
      { particulars: "Salwar", qty: 1, amount: 600, confidence: "low" },
      { particulars: "Maxi", qty: 0, amount: 0, confidence: "high" },
    ]);
    expect(result.extraNotes).toEqual(["ok"]);
  });

  it("omits imageProblem when absent, ok, empty, or garbage", () => {
    expect(coerceExtraction(null)).not.toHaveProperty("imageProblem");
    expect(coerceExtraction({ imageProblem: "ok" })).not.toHaveProperty("imageProblem");
    expect(coerceExtraction({ imageProblem: "" })).not.toHaveProperty("imageProblem");
    expect(coerceExtraction({ imageProblem: "blurry-ish" })).not.toHaveProperty("imageProblem");
  });

  it("keeps imageProblem when the model flags the photo as unusable", () => {
    expect(coerceExtraction({ imageProblem: "not_a_slip" })).toHaveProperty(
      "imageProblem", "not_a_slip"
    );
    expect(coerceExtraction({ imageProblem: "unreadable" })).toHaveProperty(
      "imageProblem", "unreadable"
    );
  });
});

describe("coerceExtraction — the advance box signal", () => {
  // Absent means "this response predates the field", which normalizeExtraction
  // has to be able to tell apart from "the model said the box is blank".
  it("omits the flag when the model didn't answer it", () => {
    expect(coerceExtraction({})).not.toHaveProperty("advanceBoxFilled");
    expect(coerceExtraction({ advanceBoxFilled: "yes" })).not.toHaveProperty("advanceBoxFilled");
  });

  it("carries a real boolean through in both directions", () => {
    expect(coerceExtraction({ advanceBoxFilled: true }).advanceBoxFilled).toBe(true);
    expect(coerceExtraction({ advanceBoxFilled: false }).advanceBoxFilled).toBe(false);
  });
});

describe("coerceExtraction — the measurement-garment mark", () => {
  // Same rule as the advance box: absent is "the response predates the
  // field", and normalizeExtraction must be able to tell that apart from a
  // model that looked and saw no such note.
  it("omits the flag when the model didn't answer it, or answered with junk", () => {
    expect(coerceExtraction({})).not.toHaveProperty("sampleGarment");
    expect(coerceExtraction({ sampleGarment: "yes" })).not.toHaveProperty("sampleGarment");
    expect(coerceExtraction({ sampleGarment: 1 })).not.toHaveProperty("sampleGarment");
  });

  it("carries a real boolean through in both directions", () => {
    expect(coerceExtraction({ sampleGarment: true }).sampleGarment).toBe(true);
    expect(coerceExtraction({ sampleGarment: false }).sampleGarment).toBe(false);
  });
});
