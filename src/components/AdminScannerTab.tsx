import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  ScanLine,
  Camera,
  CameraOff,
  AlertCircle,
  CheckCircle2,
  Plus,
  Send,
  Upload,
} from 'lucide-react';
import type { CartItem, OrderReceipt, Product, SafeUser, StoreSettings } from '../types';
import { BarcodeSvg, ProductImage, ReceiptCard } from './BarcodeVisuals';
import { GmailConfirmModal } from './GmailConfirmModal';

interface AdminScannerTabProps {
  products: Product[];
  users: SafeUser[];
  settings: StoreSettings;
  onReceiptCreated: (receipt: OrderReceipt) => void;
}

export function AdminScannerTab({
  products,
  users,
  settings,
  onReceiptCreated,
}: AdminScannerTabProps) {
  const selectableUsers = users.filter((u) => u.role === 'family').length > 0
    ? users.filter((u) => u.role === 'family')
    : users;
  const [scanInput, setScanInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanResult, setScanResult] = useState<{
    status: 'idle' | 'found' | 'not_found';
    code?: string;
    product?: Product;
    message?: string;
  }>({ status: 'idle' });

  const [bag, setBag] = useState<CartItem[]>([]);
  const [selectedUsername, setSelectedUsername] = useState(selectableUsers[0]?.username || 'admin');
  const [customerEmail, setCustomerEmail] = useState(selectableUsers[0]?.email || '');
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [issuedReceipt, setIssuedReceipt] = useState<OrderReceipt | null>(null);
  const [gmailModalReceipt, setGmailModalReceipt] = useState<OrderReceipt | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = 'admin-barcode-reader';

  useEffect(() => {
    const u = selectableUsers.find((f) => f.username === selectedUsername);
    if (u && u.email) setCustomerEmail(u.email);
  }, [selectedUsername]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  async function lookupCode(code: string) {
    const clean = code.trim();
    if (!clean) return;
    setScanInput(clean);
    try {
      const res = await fetch(`/api/scan/${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok || !data.found) {
        setScanResult({
          status: 'not_found',
          code: clean,
          message: data.message || 'הברקוד לא נמצא במערכת.',
        });
        return;
      }
      setScanResult({
        status: 'found',
        code: clean,
        product: data.product as Product,
      });
    } catch {
      setScanResult({
        status: 'not_found',
        code: clean,
        message: 'שגיאה בבדיקת הברקוד.',
      });
    }
  }

  async function startCamera() {
    setCameraError('');
    try {
      const html5Qr = new Html5Qrcode(readerId);
      scannerRef.current = html5Qr;
      setCameraActive(true);
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 180 } },
        (decodedText) => {
          lookupCode(decodedText);
        },
        () => {}
      );
    } catch {
      setCameraActive(false);
      setCameraError('לא ניתן לפתוח מצלמה בדפדפן זה — אפשר לסרוק גם מתמונה או בהזנת ברקוד ידנית.');
    }
  }

  async function stopCamera() {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setCameraActive(false);
  }

  async function handleFileScan(file: File | null) {
    if (!file) return;
    setCameraError('');
    try {
      const html5Qr = new Html5Qrcode('admin-barcode-file-temp');
      const decoded = await html5Qr.scanFile(file, true);
      await lookupCode(decoded);
    } catch {
      setScanResult({
        status: 'not_found',
        code: file.name,
        message: 'לא זוהה ברקוד תקין בתמונה זו (או שהברקוד לא שייך לחנות).',
      });
    }
  }

  function addScannedToBag(product: Product) {
    setIssuedReceipt(null);
    setBag((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          imageUrl: product.imageUrl,
          barcode: product.barcode,
        },
      ];
    });
  }

  async function handleCompleteInStoreSale() {
    if (bag.length === 0 || !customerEmail.includes('@')) return;
    setSendingReceipt(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: selectedUsername,
          customerEmail: customerEmail.trim(),
          items: bag,
          source: 'in_store',
        }),
      });
      const data = await res.json();
      if (res.ok && data.receipt) {
        const receipt = data.receipt as OrderReceipt;
        setIssuedReceipt(receipt);
        if (receipt.emailStatus === 'pending_gmail') {
          setGmailModalReceipt(receipt);
        }
        setBag([]);
        onReceiptCreated(receipt);
      }
    } finally {
      setSendingReceipt(false);
    }
  }

  const bagTotal = bag.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-[#C2410C]" />
          <span>סורק ברקוד בחנות הביתית</span>
        </h2>
        <p className="text-sm text-stone-600 mt-1">
          סרקו ברקוד מוצר מהמדף באמצעות מצלמה, תמונה או הזנת קוד. אם הברקוד לא קיים בחנות — המערכת תודיע שהוא לא נמצא.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner Controls */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookupCode(scanInput);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              dir="ltr"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="הקלידו או סרקו ברקוד (למשל 7290010010018)"
              className="flex-1 px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-tabular text-left"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            >
              בדוק ברקוד
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>הפעל מצלמת סורק</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <CameraOff className="w-4 h-4" />
                <span>עצור מצלמה</span>
              </button>
            )}

            <label className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>סרוק מתמונת ברקוד</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleFileScan(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="pt-2 border-t border-stone-100 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-stone-500">בדיקות מהירות:</span>
            {products[0] && (
              <button
                type="button"
                onClick={() => lookupCode(products[0].barcode)}
                className="px-2.5 py-1 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md font-mono-tabular cursor-pointer"
              >
                סרוק מוצר תקין ({products[0].barcode})
              </button>
            )}
            <button
              type="button"
              onClick={() => lookupCode('9998887776661')}
              className="px-2.5 py-1 text-xs bg-red-50 border border-red-200 text-red-700 rounded-md font-mono-tabular cursor-pointer"
            >
              סרוק ברקוד זר (לא קיים)
            </button>
          </div>

          <div
            id={readerId}
            className={`rounded-xl overflow-hidden bg-stone-900 ${
              cameraActive ? 'min-h-[240px]' : 'hidden'
            }`}
          />
          <div id="admin-barcode-file-temp" className="hidden" />

          {cameraError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              {cameraError}
            </div>
          )}

          {scanResult.status === 'not_found' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-red-900">הברקוד לא נמצא במערכת</div>
                <p className="text-xs text-red-700 mt-0.5">
                  הקוד{' '}
                  <span className="font-mono-tabular font-semibold" dir="ltr">
                    {scanResult.code}
                  </span>{' '}
                  אינו שייך לאף מוצר בחנות {settings.storeName}.
                </p>
              </div>
            </div>
          )}

          {scanResult.status === 'found' && scanResult.product && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                <span>מוצר זוהה בהצלחה!</span>
              </div>
              <div className="flex items-center gap-4">
                <ProductImage
                  src={scanResult.product.imageUrl}
                  alt={scanResult.product.name}
                  className="w-16 h-16 rounded-lg object-cover border border-stone-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base text-stone-900 truncate">
                    {scanResult.product.name}
                  </div>
                  <div className="text-xs text-stone-600">{scanResult.product.category}</div>
                  <div className="font-mono-tabular font-bold text-[#C2410C] mt-1">
                    ₪{scanResult.product.price}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => addScannedToBag(scanResult.product!)}
                  className="px-3.5 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>הוסף לחשבון</span>
                </button>
              </div>
              <div className="bg-white rounded-lg p-2 border border-stone-200">
                <BarcodeSvg value={scanResult.product.barcode} height={32} width={1.3} />
              </div>
            </div>
          )}
        </div>

        {/* In-store Cash Register / Receipt Sender */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-base text-stone-900">
            קופת החנות הביתית ושליחת קבלה ב-Gmail
          </h3>

          {issuedReceipt ? (
            <div className="space-y-4">
              <ReceiptCard
                receipt={issuedReceipt}
                fallbackLogo={settings.logoDataUrl}
                onRequestSendGmail={(r) => setGmailModalReceipt(r)}
              />
              <button
                type="button"
                onClick={() => setIssuedReceipt(null)}
                className="px-4 py-2 text-xs font-medium bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
              >
                התחל סריקה חדשה
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    בן משפחה קונה
                  </label>
                  <select
                    value={selectedUsername}
                    onChange={(e) => setSelectedUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm"
                  >
                    {selectableUsers.map((u) => (
                      <option key={u.username} value={u.username}>
                        {u.displayName} ({u.username})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    מייל לקבלת הקבלה
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-left"
                  />
                </div>
              </div>

              {bag.length === 0 ? (
                <div className="py-10 text-center text-sm text-stone-500 border border-dashed border-stone-200 rounded-xl">
                  סרקו מוצר משמאל ולחצו &ldquo;הוסף לחשבון&rdquo; כדי לבנות קבלה.
                </div>
              ) : (
                <div className="space-y-2 border-t border-stone-100 pt-3">
                  {bag.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between text-sm py-1.5"
                    >
                      <span>
                        {item.name}{' '}
                        <span className="font-mono-tabular text-stone-400">×{item.quantity}</span>
                      </span>
                      <span className="font-mono-tabular font-bold">
                        ₪{item.price * item.quantity}
                      </span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-stone-200 flex items-center justify-between font-bold text-base">
                    <span>סה״כ</span>
                    <span className="font-mono-tabular text-[#C2410C]">₪{bagTotal}</span>
                  </div>
                  <button
                    type="button"
                    disabled={sendingReceipt}
                    onClick={handleCompleteInStoreSale}
                    className="w-full mt-2 py-2.5 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    <span>{sendingReceipt ? 'מפיק קבלה...' : 'הפק קבלה ושלח ל-Gmail + צ׳אט'}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <GmailConfirmModal
        receipt={gmailModalReceipt}
        onClose={() => setGmailModalReceipt(null)}
        onSent={(updated) => {
          setIssuedReceipt(updated);
          onReceiptCreated(updated);
        }}
      />
    </div>
  );
}
