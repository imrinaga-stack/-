import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Barcode,
  X,
  ShoppingBag,
  Eye,
  ScanLine,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { Product, StoreSettings } from '../types';
import { BarcodeSvg, ProductImage } from './BarcodeVisuals';

interface StorefrontViewProps {
  settings: StoreSettings;
  products: Product[];
  onAddToCart: (product: Product) => void;
  onInspectProduct: (product: Product | null) => void;
  onSearchChange?: (query: string) => void;
}

export function StorefrontView({
  settings,
  products,
  onAddToCart,
  onInspectProduct,
  onSearchChange,
}: StorefrontViewProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('הכל');
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  const [shelfScanOpen, setShelfScanOpen] = useState(false);
  const [shelfCode, setShelfCode] = useState('');
  const [shelfResult, setShelfResult] = useState<{
    status: 'idle' | 'found' | 'not_found';
    product?: Product;
    code?: string;
  }>({ status: 'idle' });

  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map((p) => p.category)));
    return ['הכל', ...unique];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = selectedCategory === 'הכל' || p.category === selectedCategory;
      const q = search.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [products, selectedCategory, search]);

  function openModal(product: Product) {
    setModalProduct(product);
    onInspectProduct(product);
  }

  function closeModal() {
    setModalProduct(null);
    onInspectProduct(null);
  }

  function handleQuickAdd(product: Product, e?: React.MouseEvent) {
    e?.stopPropagation();
    onAddToCart(product);
    setAddedId(product.id);
    setTimeout(() => {
      setAddedId((curr) => (curr === product.id ? null : curr));
    }, 900);
  }

  async function handleShelfScan(e: React.FormEvent) {
    e.preventDefault();
    const clean = shelfCode.trim();
    if (!clean) return;
    const res = await fetch(`/api/scan/${encodeURIComponent(clean)}`);
    const data = await res.json();
    if (!res.ok || !data.found) {
      setShelfResult({ status: 'not_found', code: clean });
      return;
    }
    setShelfResult({ status: 'found', product: data.product as Product, code: clean });
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8 space-y-12">
      <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 items-stretch">
        <div className="p-8 md:p-12 flex flex-col justify-center space-y-5">
          <div className="text-xs font-medium text-stone-500">
            חנות משפחתית בבית · אונליין וסריקת ברקוד מהמדף
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 leading-tight text-balance">
            ברוכים הבאים ל{settings.storeName}
          </h1>
          <p className="text-base text-stone-600 leading-relaxed max-w-lg">
            {settings.storeSubtitle}
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <a
              href="#catalog"
              className="px-5 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              לצפייה במוצרים
            </a>
            <button
              type="button"
              onClick={() => {
                setShelfResult({ status: 'idle' });
                setShelfCode('');
                setShelfScanOpen(true);
              }}
              className="px-4 py-2.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ScanLine className="w-4 h-4 text-[#C2410C]" />
              <span>קנייה פיזית (סריקת ברקוד)</span>
            </button>
          </div>
        </div>
        <div className="relative min-h-[260px] lg:min-h-[340px] bg-stone-100">
          <img
            src="/src/assets/images/hero_family_store_1794587711310.jpg"
            alt="מדף החנות המשפחתית"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      <section id="catalog" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200">
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                onSearchChange?.(e.target.value);
              }}
              placeholder="חיפוש מוצר או ברקוד..."
              className="w-full pr-9 pl-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C]"
            />
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
            <p className="text-base font-semibold text-stone-800 mb-1">
              לא נמצאו מוצרים התואמים לחיפוש
            </p>
            <p className="text-sm text-stone-500">
              נסו לנקות את הסינון או לבחור קטגוריה אחרת.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const justAdded = addedId === product.id;
              return (
                <article
                  key={product.id}
                  onClick={() => openModal(product)}
                  onMouseEnter={() => onInspectProduct(product)}
                  className="group bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                >
                  <div className="aspect-[4/3] bg-stone-100 overflow-hidden relative">
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-stone-500 mb-1.5">
                        <span>{product.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">{product.barcode}</span>
                      </div>
                      <h3 className="text-base font-bold text-stone-900 leading-snug mb-1.5">
                        {product.name}
                      </h3>
                      <p className="text-sm text-stone-600 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
                      <span className="text-lg font-bold text-stone-900 font-mono-tabular">
                        ₪{product.price}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(product);
                          }}
                          className="p-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors cursor-pointer"
                          title="צפייה בברקוד ופרטים"
                          aria-label={`ברקוד של ${product.name}`}
                        >
                          <Barcode className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleQuickAdd(product, e)}
                          className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                            justAdded
                              ? 'bg-emerald-700 text-white'
                              : 'bg-[#C2410C] hover:bg-[#9A3412] text-white'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{justAdded ? 'נוסף לסל' : 'הוסף לסל'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* In-Home Shelf Self-Scan Modal */}
      {shelfScanOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          onClick={() => setShelfScanOpen(false)}
        >
          <div
            className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-base text-stone-900">
                <ScanLine className="w-5 h-5 text-[#C2410C]" />
                <span>סריקת ברקוד מהמדף בבית</span>
              </div>
              <button
                type="button"
                onClick={() => setShelfScanOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
                aria-label="סגור"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleShelfScan} className="space-y-3">
              <label className="block text-xs font-semibold text-stone-700">
                הקלידו או סרקו את מספר הברקוד שעל התג:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  dir="ltr"
                  value={shelfCode}
                  onChange={(e) => setShelfCode(e.target.value)}
                  placeholder="7290010010018"
                  className="flex-1 px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-tabular text-left"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold rounded-lg cursor-pointer"
                >
                  אתר
                </button>
              </div>
            </form>

            {shelfResult.status === 'not_found' && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>
                  הברקוד <strong className="font-mono-tabular">{shelfResult.code}</strong> לא נמצא במערכת {settings.storeName}.
                </span>
              </div>
            )}

            {shelfResult.status === 'found' && shelfResult.product && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>נמצא על המדף!</span>
                </div>
                <div className="flex items-center gap-3">
                  <ProductImage
                    src={shelfResult.product.imageUrl}
                    alt={shelfResult.product.name}
                    className="w-14 h-14 rounded-lg object-cover border border-stone-200 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-stone-900 truncate">
                      {shelfResult.product.name}
                    </div>
                    <div className="font-mono-tabular font-bold text-[#C2410C] text-base">
                      ₪{shelfResult.product.price}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleQuickAdd(shelfResult.product!);
                    setShelfScanOpen(false);
                  }}
                  className="w-full py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  הוסף לסל הקניות
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Detail Modal with 4 Angles & Pure 1D Barcode */}
      {modalProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white border border-stone-200 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <Eye className="w-4 h-4 text-[#C2410C]" />
                <span>{modalProduct.category}</span>
                <span>·</span>
                <span className="font-mono-tabular">{modalProduct.barcode}</span>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
                aria-label="סגור חלון"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-3">
                <div className="aspect-[4/3] rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                  <ProductImage
                    src={modalProduct.imageUrl}
                    alt={modalProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {Object.values(modalProduct.angles || {}).filter(Boolean).length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'מלמעלה', src: modalProduct.angles.top },
                      { label: 'מהצד', src: modalProduct.angles.side },
                      { label: 'מלמטה', src: modalProduct.angles.bottom },
                      { label: 'צד שני', src: modalProduct.angles.otherSide },
                    ]
                      .filter((a) => Boolean(a.src))
                      .map((angle, i) => (
                        <div key={i} className="text-center">
                          <img
                            src={angle.src}
                            alt={angle.label}
                            referrerPolicy="no-referrer"
                            className="w-full aspect-square object-cover rounded-lg border border-stone-200"
                          />
                          <span className="text-[10px] text-stone-500">{angle.label}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold text-stone-900 mb-2">
                    {modalProduct.name}
                  </h2>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    {modalProduct.description}
                  </p>
                </div>

                <div className="flex items-center justify-between py-3 border-y border-stone-200">
                  <span className="text-sm text-stone-600">מחיר בחנות</span>
                  <span className="text-2xl font-bold text-[#C2410C] font-mono-tabular">
                    ₪{modalProduct.price}
                  </span>
                </div>

                <div className="bg-white border border-stone-200 rounded-xl p-4 text-center space-y-2">
                  <div className="text-xs font-medium text-stone-500">
                    ברקוד המוצר (לסריקה בחנות)
                  </div>
                  <BarcodeSvg value={modalProduct.barcode} height={48} width={1.8} />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleQuickAdd(modalProduct);
                    closeModal();
                  }}
                  className="w-full py-3 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>הוסף לסל הקניות</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
