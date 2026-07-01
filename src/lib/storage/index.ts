import type { ImageStorage } from "./types";
import { createSupabaseImageStorage } from "./supabase/imageStorage";

export * from "./types";

let storage: ImageStorage | null = null;

export function getImageStorage(): ImageStorage {
  if (!storage) storage = createSupabaseImageStorage();
  return storage;
}

export function resetImageStorageForTests(): void {
  storage = null;
}
