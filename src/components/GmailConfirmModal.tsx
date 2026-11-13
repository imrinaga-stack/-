import React, { useState } from 'react';
import { Mail, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { OrderReceipt } from '../types';
import {
  getGmailAccessToken,
  sendReceiptViaGmailApi,
  signInWithGoogleForGmail,
} from '../lib/gmail';

interface GmailConfirmModalProps {
  receipt: OrderReceipt | null;
  onClose: () => void;
  onSent: (updatedReceipt: OrderReceipt) => void;
}

export function GmailConfirmModal({
  receipt,
  onClose,
  onSent,
}: GmailConfirmModalProps) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [hasToken, setHasToken] = useState(Boolean(getGmailAccessToken()));

  if (!receipt) return null;

  async function handleConnectGoogle() {
    setError('');
    try {
      await signInWithGoogleForGmail();
      setHasToken(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ההתחברות ל-Google בוטלה.');
    }
  }

  async function handleConfirmAndSend() {
    if (!receipt) return;
    setError('');
    setSending(true);
    try {
      if (!getGmailAccessToken()) {
        await signInWithGoogleForGmail();
        setHasToken(true);
      }

      const { gmailMessageId } = await sendReceiptViaGmailApi(receipt);

      const res = await fetch(`/api/orders/${encodeURIComponent(receipt.id)}/mark-email-sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gmailMessageId }),
      });

      const data = await res.json();
      if (res.ok && data.receipt) {
        onSent(data.receipt as OrderReceipt);
      } else {
        onSent({ ...receipt, emailStatus: 'sent_gmail', gmailMessageId });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשליחת המייל דרך Gmail.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2 font-bold text-base text-stone-900">
            <Mail className="w-5 h-5 text-[#C2410C]" />
            <span>אישור שליחת קבלה אמיתית דרך Gmail</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            aria-label="סגור"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-sm text-stone-700">
          <p>
            לפני שליחת המייל מחשבון ה-Gmail שלך, אנא אשר את הפרטים הבאים:
          </p>
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-stone-500">נמען:</span>
              <span className="font-mono-tabular font-semibold text-stone-900" dir="ltr">
                {receipt.customerEmail}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-stone-500">נושא:</span>
              <span className="font-semibold text-stone-900">
                קבלה מ-{receipt.storeName} — #{receipt.id}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-stone-500">פירוט:</span>
              <span className="text-stone-800">
                {receipt.items.length} מוצרים · סה״כ ₪{receipt.total}
              </span>
            </div>
          </div>

          {!hasToken && (
            <div className="pt-1">
              <p className="text-xs text-stone-500 mb-2">
                כדי לשלוח מייל אמיתי, חברו את חשבון Google / Gmail שלכם:
              </p>
              <button
                type="button"
                onClick={handleConnectGoogle}
                className="w-full py-2.5 px-4 border border-stone-300 bg-white hover:bg-stone-50 rounded-lg text-sm font-medium text-stone-800 flex items-center justify-center gap-3 cursor-pointer shadow-2xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>Sign in with Google (חבר Gmail)</span>
              </button>
            </div>
          )}

          {hasToken && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>חשבון Google מחובר ומוכן לשליחת מייל!</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            disabled={sending}
            onClick={handleConfirmAndSend}
            className="flex-1 py-2.5 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-60"
          >
            {sending ? 'שולח דרך Gmail...' : 'אשר ושלח קבלה למייל'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-lg cursor-pointer"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
