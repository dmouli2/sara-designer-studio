import { getSupabaseClient } from "../../supabase/client";
import type { ImageStorage } from "../types";

const BUCKET = "order-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // regenerated fresh on every read, so expiry is a non-issue

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL");
  const [, contentType, base64] = match;
  return { buffer: Buffer.from(base64, "base64"), contentType };
}

export function createSupabaseImageStorage(): ImageStorage {
  return {
    async upload(path: string, dataUrl: string) {
      const { buffer, contentType } = parseDataUrl(dataUrl);
      const { error } = await getSupabaseClient()
        .storage.from(BUCKET)
        .upload(path, buffer, { contentType, upsert: true });
      if (error) throw new Error(error.message);
    },

    async getSignedUrl(path: string) {
      const { data, error } = await getSupabaseClient()
        .storage.from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (error) return null;
      return data?.signedUrl ?? null;
    },

    async delete(path: string) {
      // Best-effort cleanup — a failed delete shouldn't block deleting the order itself.
      await getSupabaseClient().storage.from(BUCKET).remove([path]);
    },
  };
}
