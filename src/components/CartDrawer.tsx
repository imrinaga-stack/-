import React, { useEffect, useState } from 'react';
import { X, Trash2, Plus, Minus, Mail, ShoppingBag, CheckCircle2 } from 'lucide-react';
import type { CartItem, OrderReceipt, SafeUser, StoreSettings } from '../types';
import { ProductImage, ReceiptCard } from './BarcodeVisuals';
import { GmailConfirmModal } from './GmailConfirmModal';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  user: SafeUser;
  settings: StoreSettings;
  onUpdateQty: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onOrderCompleted: (receipt: OrderReceipt) => void;
  onGoToChat: () => void;
}

export function CartDrawer({
  open,
  onClose,
  items,
  user,
  settings,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOrderCompleted,
  onGoToChat,
}: CartDrawerProps) {
  const [customerEmail, setCustomerEmail] = useState(user.email || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completedReceipt, setCompletedReceipt] = useState<OrderReceipt | null>(null);
  const [gmailModalReceipt, setGmailModalReceipt] = useState<OrderReceipt | null>(null);

  useEffect(() => {
    setCustomerEmail(user.email || '');
  }, [user.email]);

  if (!open) return null;

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setError('יש להזין כתובת מייל תקינה לפני ההזמנה כדי שנוכל לשלוח את הקבלה.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          customerEmail: customerEmail.trim(),
          items,
          source: 'online',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'אירעה שגיאה בביצוע ההזמנה.');
        return;
      }
      const receipt = data.receipt as OrderReceipt;
      setCompletedReceipt(receipt);
      if (receipt.emailStatus === 'pending_gmail') {
        setGmailModalReceipt(receipt);
      }
      onClearCart();
      onOrderCompleted(receipt);
    } catch {
      setError('לא הצלחנו להתחבר לשרת. נסו שוב.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
        <div className="w-full max-w-md bg-white h-full flex flex-col border-r border-stone-200 shadow-xl">
          <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-[#C2410C]" />
              <h2 className="text-lg font-bold text-stone-900">סל הקניות שלך</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setCompletedReceipt(null);
                onClose();
              }}
              className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900 cursor-pointer"
              aria-label="סגור סל"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {completedReceipt ? (
              <div className="space-y-5">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm text-emerald-950">
                      {completedReceipt.emailStatus === 'sent_smtp'
                        ? 'ההזמנה בוצעה! הקבלה נשלחה למייל ולצ׳אט!'
                        : 'ההזמנה בוצעה והקבלה נשלחה לצ׳אט!'}
                    </div>
                    <p className="text-xs text-emerald-800 mt-1">
                      {completedReceipt.emailStatus === 'sent_smtp' ? (
                        <>
                          הקבלה נשלחה אוטומטית אל{' '}
                          <span className="font-mono-tabular font-semibold" dir="ltr">
                            {completedReceipt.customerEmail}
                          </span>{' '}
                          וגם לצ׳אט האתר.
                        </>
                      ) : (
                        <>
                          לחצו על הכפתור מתחת לקבלה כדי לאשר שליחה אמיתית למייל{' '}
                          <span className="font-mono-tabular font-semibold" dir="ltr">
                            {completedReceipt.customerEmail}
                          </span>{' '}
                          דרך Gmail.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <ReceiptCard
                  receipt={completedReceipt}
                  fallbackLogo={settings.logoDataUrl}
                  onRequestSendGmail={(r) => setGmailModalReceipt(r)}
                />

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCompletedReceipt(null);
                      onClose();
                      onGoToChat();
                    }}
                    className="flex-1 py-2.5 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    פתח בצ׳אט האתר
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCompletedReceipt(null);
                      onClose();
                    }}
                    className="py-2.5 px-4 border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    חזור לחנות
                  </button>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <ShoppingBag className="w-12 h-12 text-stone-300 mb-3" />
                <h3 className="text-base font-semibold text-stone-800 mb-1">הסל שלך ריק</h3>
                <p className="text-sm text-stone-500 max-w-xs">
                  הוסיפו משחקים, פאזלים או פינוקים מהחנות כדי להזמין ולקבל קבלה ל-Gmail ולצ׳אט.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center gap-3.5 pb-4 border-b border-stone-100"
                  >
                    <ProductImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-16 h-16 rounded-lg object-cover border border-stone-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-stone-900 truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-stone-500 font-mono-tabular mt-0.5">
                        ₪{item.price} ליחידה
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.productId, -1)}
                          className="w-7 h-7 rounded border border-stone-200 flex items-center justify-center hover:bg-stone-100 cursor-pointer"
                          aria-label="הפחת כמות"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono-tabular text-sm font-semibold w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.productId, 1)}
                          className="w-7 h-7 rounded border border-stone-200 flex items-center justify-center hover:bg-stone-100 cursor-pointer"
                          aria-label="הוסף כמות"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-left shrink-0 flex flex-col items-end gap-2">
                      <span className="font-mono-tabular font-bold text-sm text-stone-900">
                        ₪{item.price * item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.productId)}
                        className="text-stone-400 hover:text-red-600 p-1 cursor-pointer"
                        aria-label="הסר מוצר"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!completedReceipt && items.length > 0 && (
            <form onSubmit={handleCheckout} className="p-6 border-t border-stone-200 bg-stone-50 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  המייל שלך לקבלת הקבלה ב-Gmail (חובה לפני ההזמנה)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    dir="ltr"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full pr-9 pl-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C]"
                  />
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between text-base font-bold text-stone-900">
                <span>סה״כ לתשלום</span>
                <span className="font-mono-tabular text-xl text-[#C2410C]">₪{total}</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'יוצר קבלה...' : 'בצע הזמנה ושלח קבלה'}
              </button>
            </form>
          )}
        </div>
      </div>

      <GmailConfirmModal
        receipt={gmailModalReceipt}
        onClose={() => setGmailModalReceipt(null)}
        onSent={(updated) => {
          setCompletedReceipt(updated);
          onOrderCompleted(updated);
        }}
      />
    </>
  );
}
