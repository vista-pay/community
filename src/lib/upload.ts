import { portalApi } from '@/services/portal';

/**
 * Upload an image straight from the browser to Cloudinary, using a signature
 * minted by the API. Only the resulting URL ever touches our servers.
 */
export async function uploadImage(file: File, folder: string): Promise<string> {
  const signed = await portalApi.uploadSignature(folder);

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  // Must match the signed parameters exactly or Cloudinary rejects it.
  form.append('folder', signed.folder);
  form.append('public_id', signed.publicId);

  const res = await fetch(signed.uploadUrl, { method: 'POST', body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.secure_url) {
    throw new Error(json?.error?.message ?? `Upload failed (${res.status})`);
  }
  return json.secure_url as string;
}
