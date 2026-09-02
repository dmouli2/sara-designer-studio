import type { SlipExtraction } from "@/types";
import { UserFacingError } from "@/lib/errors";
import type { SlipExtractor } from "../types";
import { SLIP_EXTRACTION_PROMPT, SLIP_RESPONSE_SCHEMA } from "../prompts";

// Gemini adapter for the SlipExtractor port. Plain fetch against the
// generateContent REST endpoint — no SDK dependency. Uses the free-tier API
// key from GEMINI_API_KEY (https://aistudio.google.com); GEMINI_MODEL
// overrides the default model. Free-tier requests get rate-limited (429)
// and hit transient "high demand" 503s under load, so a bounded, backing-off
// retry (up to 3 attempts total) is built in.

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_RETRY_DELAY_MS = 1500;

function endpointFor(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fill in anything a malformed/partial model response left out, so the rest
// of the app can rely on the SlipExtraction shape unconditionally.
export function coerceExtraction(raw: unknown): SlipExtraction {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const conf = (v: unknown) => (v === "high" ? "high" : "low") as "high" | "low";
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

  const bookType =
    r.bookType === "Blouse" || r.bookType === "Salwar" ? r.bookType : ("unknown" as const);

  const measurements = (Array.isArray(r.measurements) ? r.measurements : [])
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .map((m) => ({
      key: str(m.key),
      value: str(m.value),
      ...(str(m.note) ? { note: str(m.note) } : {}),
      confidence: conf(m.confidence),
    }))
    .filter((m) => m.key && (m.value || m.note));

  const lineItems = (Array.isArray(r.lineItems) ? r.lineItems : [])
    .filter((li): li is Record<string, unknown> => !!li && typeof li === "object")
    .map((li) => ({
      particulars: str(li.particulars),
      qty: num(li.qty),
      amount: num(li.amount),
      ...(str(li.note) ? { note: str(li.note) } : {}),
      confidence: conf(li.confidence),
    }))
    .filter((li) => li.particulars);

  return {
    bookType,
    bookTypeConfidence: conf(r.bookTypeConfidence),
    billNo: str(r.billNo),
    date: str(r.date),
    dueDate: str(r.dueDate),
    customerName: str(r.customerName),
    customerNameConfidence: conf(r.customerNameConfidence),
    phone: str(r.phone).replace(/\D/g, ""),
    phoneConfidence: conf(r.phoneConfidence),
    measurements,
    lineItems,
    advance: str(r.advance),
    advanceConfidence: conf(r.advanceConfidence),
    // Only carried through when the model actually answered it. Left absent
    // otherwise so normalizeExtraction can tell "the model said the box is
    // blank" apart from "this response predates the field".
    ...(typeof r.advanceBoxFilled === "boolean" ? { advanceBoxFilled: r.advanceBoxFilled } : {}),
    // Absent (an older model response, or one that skipped the field) reads
    // as "not marked" downstream — never as true.
    ...(typeof r.sampleGarment === "boolean" ? { sampleGarment: r.sampleGarment } : {}),
    writtenTotal: str(r.writtenTotal),
    writtenTotalConfidence: conf(r.writtenTotalConfidence),
    extraNotes: (Array.isArray(r.extraNotes) ? r.extraNotes : []).filter(
      (n): n is string => typeof n === "string" && n.trim().length > 0
    ),
    ...(r.imageProblem === "not_a_slip" || r.imageProblem === "unreadable"
      ? { imageProblem: r.imageProblem }
      : {}),
  };
}

export function createGeminiSlipExtractor(options?: { retryDelayMs?: number }): SlipExtractor {
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  async function callGemini(imageDataUrl: string): Promise<Response> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new UserFacingError("GEMINI_API_KEY is not configured — add it to .env.local (free key from aistudio.google.com).");
    }
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new UserFacingError("Invalid scan image data URL");
    const [, mimeType, data] = match;

    return fetch(endpointFor(model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ inlineData: { mimeType, data } }, { text: SLIP_EXTRACTION_PROMPT }],
          },
        ],
        generationConfig: {
          temperature: 0,
          // 2.5-class models spend "thinking" tokens from the same output
          // budget; the API default is small enough that a full slip's JSON
          // gets truncated mid-string. Raise it explicitly.
          maxOutputTokens: 32768,
          responseMimeType: "application/json",
          responseSchema: SLIP_RESPONSE_SCHEMA,
        },
      }),
    });
  }

  return {
    async extract(imageDataUrl: string): Promise<SlipExtraction> {
      let res = await callGemini(imageDataUrl);
      let attempt = 1;
      // Up to 3 total attempts against Google's free-tier rate limiting
      // (429) and its "high demand" 503s, which are common on the free
      // tier. Backs off harder on the second retry (3x the base delay)
      // since a transient 503 needs longer to clear than a 429.
      while ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await delay(attempt === 1 ? retryDelayMs : retryDelayMs * 3);
        res = await callGemini(imageDataUrl);
        attempt++;
      }
      if (res.status === 429) {
        throw new UserFacingError("The free scanning quota is busy right now — wait a minute and try again.");
      }
      if (res.status >= 500) {
        throw new UserFacingError(
          "Google's free AI service is busy right now — your photo is kept, try Read slip again in a minute."
        );
      }
      if (!res.ok) {
        throw new UserFacingError(`Slip reading failed (HTTP ${res.status}). Try again.`);
      }

      const payload = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new UserFacingError("The scan could not be read — retake the photo with the full page in frame.");
      }
      try {
        return coerceExtraction(JSON.parse(text));
      } catch {
        throw new UserFacingError("The scan could not be read — retake the photo with the full page in frame.");
      }
    },
  };
}
