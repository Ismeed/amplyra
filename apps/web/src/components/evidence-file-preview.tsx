'use client';

import { useState } from 'react';
import { fetchAuthorizedFileUrl } from '@/lib/storage';

interface EvidenceFilePreviewProps {
  fileId: string;
  originalName: string;
  mimeType?: string;
}

export function EvidenceFilePreview({
  fileId,
  originalName,
  mimeType,
}: EvidenceFilePreviewProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSignedPreview() {
    setLoading(true);
    setError(null);
    try {
      const url = await fetchAuthorizedFileUrl(fileId);
      setSignedUrl(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={loadSignedPreview}
          disabled={loading}
          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-medium cursor-pointer"
        >
          {loading
            ? 'Loading secure preview...'
            : signedUrl
              ? `Refresh Screenshot (${originalName})`
              : `View Evidence (${originalName})`}
        </button>
        {signedUrl && (
          <a
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-emerald-700 hover:underline font-medium"
          >
            Open in New Tab
          </a>
        )}
      </div>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
      {signedUrl && (!mimeType || mimeType.startsWith('image/')) && (
        <img
          src={signedUrl}
          alt={originalName}
          className="max-h-48 rounded-lg border border-slate-200 object-contain bg-slate-50"
        />
      )}
    </div>
  );
}
