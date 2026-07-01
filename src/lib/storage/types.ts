// Stores an image given as a data URL (e.g. "data:image/png;base64,...") at a
// path, and resolves stored paths back to a fetchable URL. Vendor-agnostic:
// implementations live under ./supabase, swappable behind this interface.
export interface ImageStorage {
  upload(path: string, dataUrl: string): Promise<void>;
  getSignedUrl(path: string): Promise<string | null>;
  delete(path: string): Promise<void>;
}
