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

export interface UploadedFile {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
}

/** 10MB. Large enough for a scanned statement, small enough to arrive. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * The same upload, for a file that is not necessarily an image.
 *
 * Returns the metadata a message needs to render a sensible row — a name to
 * show, a type to decide image-or-document by, and a size — rather than just
 * the URL, which tells a reader nothing about what they are being sent.
 */
export async function uploadFile(file: File, folder: string): Promise<UploadedFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name} is larger than 10MB.`);
  }
  const fileUrl = await uploadImage(file, folder);
  return {
    fileName: file.name,
    fileUrl,
    // Some browsers leave this empty; a generic beats a blank, because the
    // renderer decides image-or-document from it.
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  };
}
