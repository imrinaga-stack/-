import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Store, Mail, CheckCircle2, FileDown, Clock } from 'lucide-react';
import type { OrderReceipt } from '../types';
import { downloadElementAsA4Pdf } from '../lib/pdf';

export function StoreLogo({
  logoDataUrl,
  storeName,
  size = 'md',
}: {
  logoDataUrl: string | null;
  storeName: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dims =
    size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';

  if (logoDataUrl) {
    return (
      <img
        src={logoDataUrl}
        alt={`לוגו ${storeName}`}
        referrerPolicy="no-referrer"
        className={`${dims} rounded-lg object-cover border border-stone-200 bg-white shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${dims} rounded-lg bg-[#C2410C] text-white flex items-center justify-center shrink-0 shadow-xs`}
      aria-hidden="true"
    >
      <Store className={size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'} />
    </div>
  );
}

/**
 * Pure 1D linear barcode bars only (no QR code, no inline digits) matching the reference barcode style.
 */
export function BarcodeSvg({
  value,
  height = 44,
  width = 1.7,
  className = '',
}: {
  value: string;
  height?: number;
  width?: number;
  fontSize?: number;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        displayValue: false,
        height,
        width,
        margin: 2,
        background: 'transparent',
        lineColor: '#000000',
      });
    } catch {
      try {
        JsBarcode(svgRef.current, '7290010000000', {
          format: 'CODE128',
          displayValue: false,
          height,
          width,
          margin: 2,
        });
      } catch {
        // Ignore
      }
    }
  }, [value, height, width]);

  return (
    <div dir="ltr" className="w-full flex justify-center">
      <svg
        ref={svgRef}
        className={`max-w-full h-auto block mx-auto ${className}`}
        aria-label={`ברקוד ${value}`}
      />
    </div>
  );
}

export function ProductImage({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`bg-gradient-to-br from-stone-100 to-stone-200 flex flex-col items-center justify-center text-stone-500 p-4 text-center ${className}`}
      >
        <Store className="w-8 h-8 mb-2 opacity-50" />
        <span className="text-xs font-medium line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function ReceiptCard({
  receipt,
  fallbackLogo,
  onRequestSendGmail,
}: {
  receipt: OrderReceipt;
  fallbackLogo?: string | null;
  onRequestSendGmail?: (receipt: OrderReceipt) => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const logo = receipt.logoSnapshot ?? fallbackLogo ?? null;
  const dateStr = new Date(receipt.createdAt).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  async function handleDownloadReceiptPdf() {
    if (!cardRef.current) return;
    setExportingPdf(true);
    try {
      await downloadElementAsA4Pdf(cardRef.current, `receipt-${receipt.id}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  }

  const isSent = receipt.emailStatus === 'sent_gmail' || receipt.emailStatus === 'sent_smtp';

  return (
    <div className="max-w-md w-full space-y-2">
      <div
        ref={cardRef}
        className="bg-white border border-stone-200 rounded-xl p-5 text-right shadow-xs w-full"
      >
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <StoreLogo logoDataUrl={logo} storeName={receipt.storeName} size="md" />
            <div>
              <div className="font-bold text-base text-stone-900">{receipt.storeName}</div>
              <div className="text-xs text-stone-500">
                קבלה רשמית ·{' '}
                {receipt.source === 'in_store' ? 'קנייה בחנות הביתית' : 'הזמנה אונליין'}
              </div>
            </div>
          </div>
          <div className="text-left">
            <div className="font-mono-tabular text-xs font-semibold text-stone-800">
              #{receipt.id}
            </div>
            <div className="text-[11px] text-stone-500 font-mono-tabular">{dateStr}</div>
          </div>
        </div>

        <div className="py-3 border-b border-stone-100 text-xs text-stone-600 flex items-center justify-between gap-2">
          <span>
            לקוח: <strong className="text-stone-900">{receipt.customerName}</strong>
          </span>
          <span className="font-mono-tabular truncate max-w-[190px]" dir="ltr">
            {receipt.customerEmail}
          </span>
        </div>

        <div className="py-3 space-y-2 border-b border-stone-200">
          {receipt.items.map((item, idx) => (
            <div
              key={`${item.productId}-${idx}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="text-stone-800 truncate">
                {item.name}{' '}
                <span className="text-stone-400 font-mono-tabular">×{item.quantity}</span>
              </div>
              <div className="font-mono-tabular font-medium text-stone-900 shrink-0">
                ₪{(item.price * item.quantity).toFixed(0)}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-700">סה״כ לתשלום</span>
          <span className="text-lg font-bold text-[#C2410C] font-mono-tabular">
            ₪{receipt.total}
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
          {isSent ? (
            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <Mail className="w-3.5 h-3.5" />
              נשלח למייל בהצלחה
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-700">
              <Clock className="w-3.5 h-3.5" />
              לחצו לשליחה דרך Gmail
            </span>
          )}
          <span className="flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            הועבר לצ׳אט האתר
          </span>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2">
        {onRequestSendGmail && (
          <button
            type="button"
            onClick={() => onRequestSendGmail(receipt)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ${
              isSent
                ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                : 'bg-[#C2410C] hover:bg-[#9A3412] text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{isSent ? 'שלח שוב ב-Gmail' : 'שלח למייל (Gmail בחינם)'}</span>
          </button>
        )}
        <button
          type="button"
          disabled={exportingPdf}
          onClick={handleDownloadReceiptPdf}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-stone-200 hover:bg-stone-50 text-stone-800 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          <FileDown className="w-3.5 h-3.5" />
          <span>{exportingPdf ? 'מייצר PDF...' : 'הורד קבלה כ-PDF'}</span>
        </button>
      </div>
    </div>
  );
}
