import { createClient } from "@/lib/supabase/client";

const MAX_SIDE = 1600; // enough for a 1080x1920 Reel card, small enough for mobile data

/** Shrink a phone photo to a JPEG (≤1600 px) in the browser. Throws a seller-friendly Error. */
async function toJpeg(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This photo format isn't supported. Please choose a JPG or PNG.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("We couldn't read this photo."))), "image/jpeg", 0.85),
  );
}

/** Upload to the private seller-photos bucket under the seller's own folder. Returns the storage path. */
export async function uploadSellerPhoto(file: File): Promise<{ path: string; preview: string }> {
  const blob = await toJpeg(file);
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("Please sign in to continue.");
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("seller-photos").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("We couldn't upload this photo. Please try again.");
  return { path, preview: URL.createObjectURL(blob) };
}

export async function deleteSellerPhoto(path: string): Promise<void> {
  await createClient().storage.from("seller-photos").remove([path]);
}
