import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QrImage({ value, size = 240, className = '' }: { value: string; size?: number; className?: string }) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (!cancelled) { setDataUrl(url); setError(null); } })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [value, size]);

  if (error) return <div className="text-xs text-red-600">QR error: {error}</div>;
  if (!dataUrl) return <div style={{ width: size, height: size }} className={`bg-neutral-100 animate-pulse rounded ${className}`} />;
  return <img src={dataUrl} alt="QR code" width={size} height={size} className={`rounded ${className}`} />;
}
