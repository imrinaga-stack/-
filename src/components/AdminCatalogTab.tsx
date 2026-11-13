import React, { useState } from 'react';
import {
  Camera,
  Sparkles,
  Plus,
  Trash2,
  Wrench,
  CheckCircle2,
  Upload,
} from 'lucide-react';
import type { Product } from '../types';
import { BarcodeSvg, ProductImage } from './BarcodeVisuals';

interface AdminCatalogTabProps {
  products: Product[];
  onRefreshStore: () => Promise<void>;
}

type AngleKey = 'top' | 'side' | 'bottom' | 'otherSide';

const ANGLE_SLOTS: Array<{ key: AngleKey; label: string }> = [
  { key: 'top', label: '1. מלמעלה' },
  { key: 'side', label: '2. מהצד' },
  { key: 'bottom', label: '3. מלמטה' },
  { key: 'otherSide', label: '4. מהצד השני' },
];

export function AdminCatalogTab({ products, onRefreshStore }: AdminCatalogTabProps) {
  const [angles, setAngles] = useState<Partial<Record<AngleKey, string>>>({});
  const [name, setName] = useState('');
  const [category, setCategory] = useState('משחקי קופסה');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<string>('45');
  const [barcode, setBarcode] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // AI Barcode Assistant state
  const [barcodePrompt, setBarcodePrompt] = useState('');
  const [selectedProdId, setSelectedProdId] = useState<string>(products[0]?.id || '');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeReply, setBarcodeReply] = useState<{
    text: string;
    barcode: string;
    productName: string;
  } | null>(null);

  function handleAngleFile(key: AngleKey, file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAngles((prev) => ({ ...prev, [key]: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleAnalyze4Angles() {
    setErrorMsg('');
    setStatusMsg('');
    const uploaded = ANGLE_SLOTS.filter((s) => Boolean(angles[s.key])).map((s) => ({
      label: s.label,
      dataUrl: angles[s.key] as string,
    }));

    if (uploaded.length === 0) {
      setErrorMsg('העלו לפחות תמונה אחת (מומלץ 4 זוויות) כדי ש-AI יוכל לנתח ולקבוע מחיר וברקוד.');
      return;
    }

    setAnalyzing(true);
    try {
      const res = await fetch('/api/ai/analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: uploaded, hintName: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'שגיאה בניתוח ה-AI.');
        return;
      }
      const a = data.analysis;
      setName(a.suggestedName || name);
      setCategory(a.category || 'משחקי קופסה');
      setDescription(a.description || '');
      setPrice(String(a.suggestedPrice || 40));
      setBarcode(a.generatedBarcode || '');
      setAiNotes(a.visualNotes || '');
      setStatusMsg('AI סיים לנתח את הזוויות, קבע מחיר סביר והמציא ברקוד ייחודי לחנות!');
    } catch {
      setErrorMsg('שגיאה בתקשורת עם שרת ה-AI.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    if (!name.trim()) {
      setErrorMsg('יש להזין שם מוצר.');
      return;
    }
    setSaving(true);
    try {
      const primaryImg =
        angles.top ||
        angles.side ||
        angles.bottom ||
        angles.otherSide ||
        '/src/assets/images/product_board_game_1794587710970.jpg';

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          description: description.trim() || 'מוצר חדש בחנות המשפחתית קטן ושווה.',
          price: Number(price) || 35,
          imageUrl: primaryImg,
          angles,
          barcode: barcode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'לא ניתן לשמור מוצר.');
        return;
      }
      setStatusMsg(`המוצר "${data.product.name}" נשמר בחנות עם ברקוד ${data.product.barcode}!`);
      setName('');
      setDescription('');
      setPrice('45');
      setBarcode('');
      setAiNotes('');
      setAngles({});
      await onRefreshStore();
    } catch {
      setErrorMsg('שגיאה בשמירת המוצר.');
    } finally {
      setSaving(false);
    }
  }

  async function runBarcodePrompt(customPrompt?: string, prodId?: string) {
    const promptToSend = customPrompt || barcodePrompt;
    if (!promptToSend.trim()) return;
    setBarcodeLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/ai/barcode-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend,
          targetProductId: prodId || selectedProdId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'שגיאה בעוזר הברקודים.');
        return;
      }
      setBarcodeReply({
        text: data.result.replyText,
        barcode: data.result.barcode,
        productName: data.result.productName,
      });
      await onRefreshStore();
    } catch {
      setErrorMsg('שגיאת תקשורת מול עוזר הברקודים.');
    } finally {
      setBarcodeLoading(false);
    }
  }

  async function handleDeleteProduct(id: string) {
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    await onRefreshStore();
  }

  return (
    <div className="space-y-8">
      {/* 4-Angle AI Product Creator */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#C2410C]" />
            <span>הוספת מוצר וניתוח AI מ-4 זוויות צילום</span>
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            צלמו או העלו תמונות של המוצר מ-4 זוויות (מלמעלה, מהצד, מלמטה ומהצד השני), כתבו את שם המוצר (או תנו ל-AI לזהות) וה-AI יקבע מחיר סביר וייצור ברקוד ייעודי לחנות.
          </p>
        </div>

        {/* 4 Photo Upload Slots */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {ANGLE_SLOTS.map((slot) => {
            const img = angles[slot.key];
            return (
              <label
                key={slot.key}
                className="border border-dashed border-stone-300 hover:border-[#C2410C] rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer bg-stone-50 min-h-[148px] transition-colors relative overflow-hidden"
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => handleAngleFile(slot.key, e.target.files?.[0] || null)}
                />
                {img ? (
                  <>
                    <img
                      src={img}
                      alt={slot.label}
                      className="w-full h-24 object-cover rounded-lg mb-2"
                    />
                    <span className="text-xs font-semibold text-stone-800">{slot.label}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-stone-400 mb-2" />
                    <span className="text-xs font-semibold text-stone-700">{slot.label}</span>
                    <span className="text-[11px] text-stone-400 mt-0.5">צלם או העלה תמונה</span>
                  </>
                )}
              </label>
            );
          })}
        </div>

        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                שם המוצר
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: טאקי משפחתי"
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                קטגוריה
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  מחיר (₪)
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  ברקוד (אוטומטי/AI)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="729009..."
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-tabular text-left"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              תיאור המוצר
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="תיאור קצר של המשחק או המוצר..."
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm"
            />
          </div>

          {aiNotes && (
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700">
              <strong>הערת ה-AI מהתמונות:</strong> {aiNotes}
            </div>
          )}

          {barcode && (
            <div className="p-3 bg-white border border-stone-200 rounded-lg inline-block">
              <BarcodeSvg value={barcode} height={36} width={1.4} />
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMsg}
            </div>
          )}
          {statusMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleAnalyze4Angles}
              disabled={analyzing}
              className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              <span>{analyzing ? 'AI מנתח 4 זוויות...' : 'נתח תמונות ב-AI וקבע מחיר + ברקוד'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              <span>{saving ? 'שומר...' : 'שמור מוצר לקטלוג'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* AI Barcode Assistant */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-[#C2410C]" />
            <span>עוזר AI לברקודים — יצירה, הצגה ותיקון ברקוד</span>
          </h3>
          <p className="text-sm text-stone-600 mt-1">
            כתבו בקשה חופשית כמו: &ldquo;תבנה לי ברקוד למשחק הזה&rdquo;, &ldquo;תראה לי את הברקוד של קטאן&rdquo;, או &ldquo;הברקוד לא תקין תתקן אותו&rdquo;.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr_auto] gap-3">
          <select
            value={selectedProdId}
            onChange={(e) => setSelectedProdId(e.target.value)}
            className="px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={barcodePrompt}
            onChange={(e) => setBarcodePrompt(e.target.value)}
            placeholder="לדוגמה: הברקוד לא תקין תתקן אותו / תראה לי את הברקוד למשחק הזה"
            className="px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm"
          />
          <button
            type="button"
            disabled={barcodeLoading}
            onClick={() => runBarcodePrompt()}
            className="px-4 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            {barcodeLoading ? 'מעבד...' : 'שלח ל-AI'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => runBarcodePrompt('תראה לי את הברקוד של המוצר הזה')}
            className="px-3 py-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg cursor-pointer"
          >
            הראה לי ברקוד למוצר שנבחר
          </button>
          <button
            type="button"
            onClick={() => runBarcodePrompt('הברקוד לא תקין, תתקן אותו ותבנה ברקוד חדש')}
            className="px-3 py-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg cursor-pointer"
          >
            הברקוד לא תקין — תקן באמצעות AI
          </button>
        </div>

        {barcodeReply && (
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-bold text-sm text-stone-900">{barcodeReply.productName}</div>
              <p className="text-xs text-stone-600">{barcodeReply.text}</p>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-stone-200 shrink-0">
              <BarcodeSvg value={barcodeReply.barcode} height={38} width={1.4} />
            </div>
          </div>
        )}
      </div>

      {/* Product Catalog Table */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-bold text-base text-stone-900">
            כל המוצרים בקטלוג ({products.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-stone-50 border-b border-stone-200 text-xs text-stone-500">
              <tr>
                <th className="py-3 px-4 font-semibold">מוצר</th>
                <th className="py-3 px-4 font-semibold">קטגוריה</th>
                <th className="py-3 px-4 font-semibold">מחיר</th>
                <th className="py-3 px-4 font-semibold">ברקוד</th>
                <th className="py-3 px-4 font-semibold">סטטוס תג</th>
                <th className="py-3 px-4 font-semibold">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50/60">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <ProductImage
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-11 h-11 rounded-lg object-cover border border-stone-200 shrink-0"
                      />
                      <div>
                        <div className="font-semibold text-stone-900">{p.name}</div>
                        <div className="text-xs text-stone-500 line-clamp-1 max-w-xs">
                          {p.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-stone-600">{p.category}</td>
                  <td className="py-3 px-4 font-mono-tabular font-bold text-stone-900">
                    ₪{p.price}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col items-start gap-1">
                      <div className="bg-white border border-stone-200 rounded px-2 py-1">
                        <BarcodeSvg value={p.barcode} height={28} width={1.1} />
                      </div>
                      <span className="font-mono-tabular text-[11px] text-stone-600" dir="ltr">
                        {p.barcode}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-stone-600">
                    {p.hasGeneratedTag ? 'נוצר תג בעבר' : 'טרם נוצר תג'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          runBarcodePrompt('הברקוד לא תקין, תתקן אותו ותבנה ברקוד חדש', p.id)
                        }
                        className="px-2.5 py-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md cursor-pointer whitespace-nowrap"
                      >
                        תקן ברקוד
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-1.5 text-stone-400 hover:text-red-600 rounded-md cursor-pointer"
                        aria-label={`מחק ${p.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
