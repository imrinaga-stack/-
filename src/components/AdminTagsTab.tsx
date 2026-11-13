import React, { useRef, useState } from 'react';
import {
  Printer,
  Sparkles,
  Tag,
  Layers,
  CheckCircle2,
  FileDown,
  Palette,
} from 'lucide-react';
import type { Product, StoreSettings, TagSheetItem } from '../types';
import { BarcodeSvg, ProductImage, StoreLogo } from './BarcodeVisuals';
import { downloadElementAsA4Pdf } from '../lib/pdf';

interface AdminTagsTabProps {
  settings: StoreSettings;
  products: Product[];
  onRefreshStore: () => Promise<void>;
}

type TagThemeId = 'terracotta' | 'forest' | 'navy' | 'monochrome';

const TAG_THEMES: Record<
  TagThemeId,
  {
    label: string;
    headerBg: string;
    headerText: string;
    borderColor: string;
    priceColor: string;
    priceBg: string;
    holeBorder: string;
    accentLine: string;
  }
> = {
  terracotta: {
    label: 'טרקוטה חמה',
    headerBg: 'bg-[#9A3412]',
    headerText: 'text-white',
    borderColor: 'border-[#C2410C]/40',
    priceColor: 'text-[#9A3412]',
    priceBg: 'bg-[#FFF7ED] border-[#FDBA74]',
    holeBorder: 'border-[#C2410C]/50',
    accentLine: 'bg-[#C2410C]',
  },
  forest: {
    label: 'ירוק יער',
    headerBg: 'bg-[#14532D]',
    headerText: 'text-white',
    borderColor: 'border-[#166534]/35',
    priceColor: 'text-[#14532D]',
    priceBg: 'bg-[#F0FDF4] border-[#86EFAC]',
    holeBorder: 'border-[#166534]/45',
    accentLine: 'bg-[#166534]',
  },
  navy: {
    label: 'נייבי מלכותי',
    headerBg: 'bg-[#1E3A8A]',
    headerText: 'text-white',
    borderColor: 'border-[#1E40AF]/35',
    priceColor: 'text-[#1E3A8A]',
    priceBg: 'bg-[#EFF6FF] border-[#93C5FD]',
    holeBorder: 'border-[#1E40AF]/45',
    accentLine: 'bg-[#1E40AF]',
  },
  monochrome: {
    label: 'מינימליסטי נקי',
    headerBg: 'bg-[#18181B]',
    headerText: 'text-white',
    borderColor: 'border-stone-400',
    priceColor: 'text-stone-900',
    priceBg: 'bg-stone-100 border-stone-300',
    holeBorder: 'border-stone-400',
    accentLine: 'bg-stone-900',
  },
};

export function AdminTagsTab({ settings, products, onRefreshStore }: AdminTagsTabProps) {
  const [tagStyle, setTagStyle] = useState<'game_card' | 'bag_tag'>('game_card');
  const [themeId, setThemeId] = useState<TagThemeId>('terracotta');
  const [aiPrompt, setAiPrompt] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [selectedProdId, setSelectedProdId] = useState<string>('');
  const [sheetTags, setSheetTags] = useState<TagSheetItem[]>(() =>
    products.slice(0, 8).map((p) => ({
      id: `init-${p.id}`,
      productId: p.id,
      productName: p.name,
      price: p.price,
      barcode: p.barcode,
      imageUrl: p.imageUrl,
      category: p.category,
    }))
  );
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const untaggedCount = products.filter((p) => !p.hasGeneratedTag).length;
  const theme = TAG_THEMES[themeId];

  async function handleAuto8Untagged() {
    setLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/ai/generate-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'auto8' }),
      });
      const data = await res.json();
      if (res.ok && data.tags) {
        setSheetTags(data.tags);
        setStatusMessage(data.message);
        await onRefreshStore();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSingleOrCustom(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatusMessage('');
    try {
      if (!selectedProdId && !customName.trim() && !aiPrompt.trim()) {
        await handleAuto8Untagged();
        return;
      }

      const payload = selectedProdId
        ? { mode: 'single', productId: selectedProdId }
        : {
            mode: 'custom',
            prompt: aiPrompt.trim() || customName.trim(),
            productName: customName.trim() || undefined,
            price: customPrice ? Number(customPrice) : undefined,
          };

      const res = await fetch('/api/ai/generate-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.tags) {
        setSheetTags((prev) => [...data.tags, ...prev].slice(0, 8));
        setStatusMessage(data.message);
        setCustomName('');
        setCustomPrice('');
        setAiPrompt('');
        await onRefreshStore();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPdf() {
    if (!sheetRef.current) return;
    setExportingPdf(true);
    setStatusMessage('');
    try {
      await downloadElementAsA4Pdf(
        sheetRef.current,
        `katan-veshaveh-tags-a4-${Date.now().toString().slice(-4)}.pdf`
      );
      setStatusMessage('קובץ ה-PDF המוכן להדפסה (A4, 8 תגים בדף) הורד למחשב!');
    } catch {
      setStatusMessage('לא הצלחנו ליצור PDF אוטומטי, השתמשו בכפתור "הדפס ישירות (A4)".');
    } finally {
      setExportingPdf(false);
    }
  }

  const paddedCells: Array<TagSheetItem | null> = Array.from({ length: 8 }, (_, i) =>
    sheetTags[i] || null
  );

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#C2410C]" />
              <span>סטודיו תגים בוטיק להדפסה ב-PDF ו-A4 (8 בדף)</span>
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              עצבו והורידו קובץ PDF מוכן להדפסה של 8 כרטיסיות משחק או תגי מחיר ושקית בדף A4 אחד.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={exportingPdf}
              onClick={handleDownloadPdf}
              className="px-4 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold rounded-lg flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <FileDown className="w-4 h-4" />
              <span>{exportingPdf ? 'מכין PDF A4...' : 'הורד PDF מוכן להדפסה (A4)'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold rounded-lg flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>הדפס ישירות</span>
            </button>
          </div>
        </div>

        {/* Mode Switch, Color Theme & AI Controls */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
              <button
                type="button"
                onClick={() => setTagStyle('game_card')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  tagStyle === 'game_card' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600'
                }`}
              >
                כרטיסיית משחק בוטיק (עם תמונה)
              </button>
              <button
                type="button"
                onClick={() => setTagStyle('bag_tag')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  tagStyle === 'bag_tag' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600'
                }`}
              >
                תג שקית ומחיר (ללא תמונה)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-stone-500" />
              <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
                {(Object.keys(TAG_THEMES) as TagThemeId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setThemeId(id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      themeId === id ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600'
                    }`}
                  >
                    {TAG_THEMES[id].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-100">
            <span className="text-xs text-stone-600">
              יצירה אוטומטית חכמה למוצרים שעדיין לא הודפס להם תג:
            </span>
            <button
              type="button"
              disabled={loading}
              onClick={handleAuto8Untagged}
              className="px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Layers className="w-4 h-4" />
              <span>
                התאם אוטומטית 8 מוצרים ללא תג ({untaggedCount} ממתינים בקטלוג)
              </span>
            </button>
          </div>

          <form
            onSubmit={handleAddSingleOrCustom}
            className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-4 border-t border-stone-100"
          >
            <select
              value={selectedProdId}
              onChange={(e) => setSelectedProdId(e.target.value)}
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm"
            >
              <option value="">-- או מוצר מותאם אישית ב-AI --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (₪{p.price}) {p.hasGeneratedTag ? '✓' : ''}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              disabled={Boolean(selectedProdId)}
              placeholder="שם מוצר (או השאר ריק ל-AI)"
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm disabled:opacity-50"
            />

            <input
              type="number"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              disabled={Boolean(selectedProdId)}
              placeholder="מחיר ₪ (או השאר ריק למחיר סביר)"
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-tabular disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'AI יוצר...' : 'צור תג והוסף לדף'}</span>
            </button>

            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={Boolean(selectedProdId)}
              placeholder="הנחיה חופשית ל-AI: לדוגמה 'AI תצור לי תג למשחק דמקה מעץ'"
              className="md:col-span-4 px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs disabled:opacity-50"
            />
          </form>

          {statusMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Boutique A4 8-Tag Sheet (captured cleanly for both PDF & Print) */}
      <div className="bg-stone-100 border border-stone-200 rounded-xl p-4 sm:p-8 overflow-x-auto">
        <div className="no-print text-xs text-stone-600 mb-4 flex items-center justify-between max-w-[794px] mx-auto">
          <span>גיליון A4 מדויק מוכן להדפסה ו-PDF (2 עמודות × 4 שורות = 8 תגים)</span>
          <span className="font-mono-tabular font-semibold">{sheetTags.length} / 8 תגים</span>
        </div>

        <div
          ref={sheetRef}
          className="print-only-sheet bg-white mx-auto p-6 shadow-sm border border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-[794px]"
        >
          {paddedCells.map((tag, idx) => {
            if (!tag) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="print-tag-cell border border-dashed border-stone-200 rounded-2xl p-4 flex items-center justify-center text-xs text-stone-400 min-h-[245px]"
                >
                  משבצת תג #{idx + 1}
                </div>
              );
            }

            return (
              <div
                key={tag.id}
                className={`print-tag-cell relative rounded-2xl border-2 ${theme.borderColor} bg-[#FFFEFC] overflow-hidden flex flex-col justify-between min-h-[245px] shadow-2xs`}
              >
                {/* Top Boutique Header Band with Punch Hole Ring */}
                <div
                  className={`${theme.headerBg} ${theme.headerText} px-4 py-2.5 flex items-center justify-between gap-2 relative`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StoreLogo
                      logoDataUrl={settings.logoDataUrl}
                      storeName={settings.storeName}
                      size="sm"
                    />
                    <div className="truncate">
                      <div className="font-extrabold text-xs tracking-wide leading-tight">
                        {settings.storeName}
                      </div>
                      <div className="text-[10px] opacity-85 truncate">{tag.category}</div>
                    </div>
                  </div>

                  {/* Decorative hang-tag eyelet indicator */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] opacity-80 font-mono-tabular">#{idx + 1}</span>
                    <span
                      className="w-4 h-4 rounded-full bg-white/95 border border-black/20 inline-block shadow-inner"
                      aria-hidden="true"
                    />
                  </div>
                </div>

                {/* Middle Content: Image (in game_card mode) + Product Name + Price Seal */}
                <div className="px-4 py-3 flex-1 flex items-center justify-between gap-3">
                  {tagStyle === 'game_card' && (
                    <div className="w-20 h-20 rounded-xl overflow-hidden border border-stone-200 bg-stone-50 shrink-0 shadow-2xs">
                      <ProductImage
                        src={tag.imageUrl}
                        alt={tag.productName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-stone-400 font-medium mb-0.5">
                      {tagStyle === 'game_card' ? 'פריט מהמדף' : 'תג מחיר רשמי'}
                    </div>
                    <div className="font-extrabold text-[15px] text-stone-900 leading-snug line-clamp-2">
                      {tag.productName}
                    </div>
                  </div>

                  <div
                    className={`px-3 py-2 rounded-xl border ${theme.priceBg} text-center shrink-0`}
                  >
                    <div className="text-[10px] text-stone-500 leading-none mb-0.5">מחיר</div>
                    <div
                      className={`text-xl font-black font-mono-tabular leading-none ${theme.priceColor}`}
                    >
                      ₪{tag.price}
                    </div>
                  </div>
                </div>

                {/* Perforated Divider + Crisp Barcode Footer */}
                <div className="px-4 pb-2.5 pt-1.5 border-t border-dashed border-stone-300 bg-stone-50/70">
                  <BarcodeSvg value={tag.barcode} height={32} width={1.38} fontSize={10} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
