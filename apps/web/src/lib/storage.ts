import { StoragePurpose } from '@amplyra/shared';
import { apiFetch } from './api';

interface UploadSessionResponse {
  file: {
    id: string;
    bucket: string;
    objectPath: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  };
  upload: {
    signedUrl: string;
    token: string;
    path: string;
    bucket: string;
    method: 'PUT';
    maxBytes: number;
  };
  publicUrl: string | null;
}

interface ConfirmUploadResponse {
  file: {
    id: string;
    bucket: string;
    objectPath: string;
    originalName: string;
    status: string;
  };
  url: string;
  isPublic: boolean;
}

export interface UploadedStorageAsset {
  fileId: string;
  url: string;
  originalName: string;
  bucket: string;
}

/**
 * Requests a server-authorized Supabase Storage signed upload URL,
 * uploads directly from the browser, and confirms the object with the API.
 */
export async function uploadToSupabaseStorage(params: {
  file: File;
  purpose: StoragePurpose;
  campaignId?: string;
}): Promise<UploadedStorageAsset> {
  const session = await apiFetch<UploadSessionResponse>('/storage/upload-url', {
    method: 'POST',
    body: JSON.stringify({
      purpose: params.purpose,
      fileName: params.file.name,
      mimeType: params.file.type || 'application/octet-stream',
      sizeBytes: params.file.size,
      campaignId: params.campaignId,
    }),
  });

  const formData = new FormData();
  formData.append('cacheControl', '3600');
  formData.append('', params.file);

  const uploadRes = await fetch(session.upload.signedUrl, {
    method: session.upload.method,
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(
      `Direct upload to Supabase Storage failed (status ${uploadRes.status})`,
    );
  }

  const confirmed = await apiFetch<ConfirmUploadResponse>(
    `/storage/files/${session.file.id}/confirm`,
    { method: 'POST' },
  );

  return {
    fileId: confirmed.file.id,
    url: confirmed.url,
    originalName: confirmed.file.originalName,
    bucket: confirmed.file.bucket,
  };
}

export async function fetchAuthorizedFileUrl(fileId: string): Promise<string> {
  const res = await apiFetch<{ url: string }>(`/storage/files/${fileId}/signed-url`);
  return res.url;
}
