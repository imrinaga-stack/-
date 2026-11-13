import React, { useEffect, useState } from 'react';
import {
  Video,
  Sparkles,
  ScanLine,
  Tag,
  Receipt,
  Users,
  Plus,
  Trash2,
  Upload,
  Send,
  Mail,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import type {
  EmailDispatch,
  OrderReceipt,
  Product,
  SafeUser,
  StoreSettings,
  UserLiveActivity,
} from '../types';
import { ReceiptCard, StoreLogo } from './BarcodeVisuals';
import { AdminCameraTab } from './AdminCameraTab';
import { AdminCatalogTab } from './AdminCatalogTab';
import { AdminScannerTab } from './AdminScannerTab';
import { AdminTagsTab } from './AdminTagsTab';
import { GmailConfirmModal } from './GmailConfirmModal';
import { getGmailAccessToken, signInWithGoogleForGmail } from '../lib/gmail';

type AdminTabId = 'camera' | 'catalog' | 'scanner' | 'tags' | 'receipts' | 'users';

interface AdminDashboardProps {
  settings: StoreSettings;
  products: Product[];
  users: SafeUser[];
  orders: OrderReceipt[];
  emails: EmailDispatch[];
  liveSessions: Record<string, UserLiveActivity>;
  onWatchUser: (username: string) => void;
  onRefreshStore: () => Promise<void>;
  onRefreshAdminData: () => Promise<void>;
}

export function AdminDashboard({
  settings,
  products,
  users,
  orders,
  emails,
  liveSessions,
  onWatchUser,
  onRefreshStore,
  onRefreshAdminData,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTabId>('camera');

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [userMsg, setUserMsg] = useState('');
  const [userErr, setUserErr] = useState('');

  const [storeNameInput, setStoreNameInput] = useState(settings.storeName);
  const [storeSubtitleInput, setStoreSubtitleInput] = useState(settings.storeSubtitle);
  const [brandSaved, setBrandSaved] = useState('');

  const selectableUsers = users.filter((u) => u.role === 'family').length > 0
    ? users.filter((u) => u.role === 'family')
    : users;
  const [receiptUser, setReceiptUser] = useState(selectableUsers[0]?.username || 'admin');
  const [receiptEmail, setReceiptEmail] = useState(selectableUsers[0]?.email || '');
  const [receiptProductId, setReceiptProductId] = useState(products[0]?.id || '');
  const [receiptQty, setReceiptQty] = useState(1);
  const [receiptNotice, setReceiptNotice] = useState('');
  const [gmailModalReceipt, setGmailModalReceipt] = useState<OrderReceipt | null>(null);
  const [gmailConnected, setGmailConnected] = useState(Boolean(getGmailAccessToken()));
  const [smtpConfigured, setSmtpConfigured] = useState(false);

  useEffect(() => {
    fetch('/api/email/config-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.serverMailerConfigured === 'boolean') {
          setSmtpConfigured(data.serverMailerConfigured);
        }
      })
      .catch(() => {});
  }, []);

  const navItems: Array<{ id: AdminTabId; label: string; icon: React.ReactNode }> = [
    { id: 'camera', label: 'כפתור מצלמה (זמן אמת)', icon: <Video className="w-4 h-4" /> },
    { id: 'catalog', label: 'מוצרים, 4 זוויות וברקוד AI', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'scanner', label: 'סורק ברקוד', icon: <ScanLine className="w-4 h-4" /> },
    { id: 'tags', label: 'תגים ומדבקות PDF / A4', icon: <Tag className="w-4 h-4" /> },
    { id: 'receipts', label: 'קבלות ושליחה למייל', icon: <Receipt className="w-4 h-4" /> },
    { id: 'users', label: 'משתמשים ולוגו החנות', icon: <Users className="w-4 h-4" /> },
  ];

  async function handleConnectGmail() {
    try {
      await signInWithGoogleForGmail();
      setGmailConnected(true);
    } catch {
      // User closed popup
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setUserErr('');
    setUserMsg('');
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: newUsername.trim(),
        password: newPassword,
        displayName: newDisplayName.trim() || newUsername.trim(),
        email: newEmail.trim(),
        role: 'family',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setUserErr(data.error || 'שגיאה ביצירת משתמש.');
      return;
    }
    setUserMsg(`המשתמש "${data.user.username}" נוצר בהצלחה עם סיסמה מוגדרת!`);
    setNewUsername('');
    setNewPassword('');
    setNewDisplayName('');
    setNewEmail('');
    await onRefreshAdminData();
  }

  async function handleDeleteUser(username: string) {
    await fetch(`/api/admin/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
    await onRefreshAdminData();
  }

  async function handleSaveBranding(logoOverride?: string | null) {
    setBrandSaved('');
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeName: storeNameInput,
        storeSubtitle: storeSubtitleInput,
        ...(logoOverride !== undefined ? { logoDataUrl: logoOverride } : {}),
      }),
    });
    if (res.ok) {
      setBrandSaved('פרטי החנות והלוגו עודכנו באתר, בקבלות ובדפי התגים!');
      await onRefreshStore();
    }
  }

  function handleLogoUpload(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        await handleSaveBranding(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSendManualReceipt(e: React.FormEvent) {
    e.preventDefault();
    setReceiptNotice('');
    const prod = products.find((p) => p.id === receiptProductId);
    if (!prod) return;
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: receiptUser,
        customerEmail: receiptEmail.trim(),
        source: 'in_store',
        items: [
          {
            productId: prod.id,
            name: prod.name,
            price: prod.price,
            quantity: receiptQty,
            imageUrl: prod.imageUrl,
            barcode: prod.barcode,
          },
        ],
      }),
    });
    const data = await res.json();
    if (res.ok && data.receipt) {
      const created = data.receipt as OrderReceipt;
      if (created.emailStatus === 'sent_smtp') {
        setReceiptNotice(
          `הקבלה נוצרה, נשלחה לצ׳אט של ${receiptUser} ונשלחה אוטומטית למייל ${created.customerEmail}!`
        );
      } else {
        setReceiptNotice(
          `הקבלה נוצרה ונשלחה לצ׳אט של ${receiptUser}. אשרו שליחה חינמית ב-Gmail בחלון שנפתח.`
        );
        setGmailModalReceipt(created);
      }
      await onRefreshAdminData();
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 items-start">
        <aside className="no-print bg-white border border-stone-200 rounded-2xl p-4 space-y-2 lg:sticky lg:top-20">
          <div className="px-3 py-2 border-b border-stone-100 mb-2">
            <div className="text-xs font-medium text-stone-500">פאנל מנהל החנות</div>
            <div className="font-bold text-base text-stone-900">{settings.storeName}</div>
          </div>

          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-right px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2.5 cursor-pointer ${
                  active
                    ? 'bg-[#C2410C] text-white font-semibold'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </aside>

        <main className="min-w-0">
          {activeTab === 'camera' && (
            <AdminCameraTab
              users={users}
              liveSessions={liveSessions}
              onWatchUser={onWatchUser}
            />
          )}

          {activeTab === 'catalog' && (
            <AdminCatalogTab products={products} onRefreshStore={onRefreshStore} />
          )}

          {activeTab === 'scanner' && (
            <AdminScannerTab
              products={products}
              users={users}
              settings={settings}
              onReceiptCreated={onRefreshAdminData}
            />
          )}

          {activeTab === 'tags' && (
            <AdminTagsTab
              settings={settings}
              products={products}
              onRefreshStore={onRefreshStore}
            />
          )}

          {activeTab === 'receipts' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-[#C2410C]" />
                    <span>קבלות, שליחה אמיתית בחינם למייל ותיעוד צ׳אט</span>
                  </h2>
                  <p className="text-sm text-stone-600 mt-1">
                    {smtpConfigured
                      ? 'שליחת המיילים האוטומטית (SMTP חינם) פעילה! כל הזמנה נשלחת אוטומטית למייל הלקוח, או דרך כפתור Gmail.'
                      : 'חברו את Gmail בחינם בלחיצה אחת כדי לשלוח קבלות אמיתיות לתיבת הדואר, או הגדירו GMAIL_USER ו-GMAIL_APP_PASSWORD ב-Secrets לשליחה אוטומטית ברקע.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {smtpConfigured && (
                    <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>שליחת SMTP אוטומטית פעילה (חינם)</span>
                    </div>
                  )}

                  {gmailConnected ? (
                    <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Gmail מחובר לשליחה</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectGmail}
                      className="px-4 py-2 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold rounded-lg flex items-center gap-2.5 cursor-pointer shadow-2xs"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                      <span>Sign in with Google (חבר Gmail חינם)</span>
                    </button>
                  )}
                </div>
              </div>

              <form
                onSubmit={handleSendManualReceipt}
                className="bg-white border border-stone-200 rounded-xl p-5 space-y-4"
              >
                <div className="font-bold text-sm text-stone-900">יצירה ושליחת קבלה מהירה</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <select
                    value={receiptUser}
                    onChange={(e) => {
                      const u = selectableUsers.find((f) => f.username === e.target.value);
                      setReceiptUser(e.target.value);
                      if (u && u.email) setReceiptEmail(u.email);
                    }}
                    className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm"
                  >
                    {selectableUsers.map((u) => (
                      <option key={u.username} value={u.username}>
                        {u.displayName} ({u.username})
                      </option>
                    ))}
                  </select>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    value={receiptEmail}
                    onChange={(e) => setReceiptEmail(e.target.value)}
                    placeholder="email@gmail.com"
                    className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-left"
                  />
                  <select
                    value={receiptProductId}
                    onChange={(e) => setReceiptProductId(e.target.value)}
                    className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₪{p.price})
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={receiptQty}
                      onChange={(e) => setReceiptQty(Math.max(1, Number(e.target.value)))}
                      className="w-20 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono-tabular"
                    />
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>שלח קבלה</span>
                    </button>
                  </div>
                </div>
                {receiptNotice && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                    {receiptNotice}
                  </div>
                )}
              </form>

              <div className="space-y-4">
                <h3 className="font-bold text-base text-stone-900">
                  קבלות שהונפקו ({orders.length})
                </h3>
                {orders.length === 0 ? (
                  <div className="bg-white border border-stone-200 rounded-xl p-10 text-center text-sm text-stone-500">
                    עדיין לא הונפקו קבלות. בצעו הזמנה בחנות או דרך סורק הקופה כדי לראות קבלות כאן.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {orders.map((order) => (
                      <ReceiptCard
                        key={order.id}
                        receipt={order}
                        fallbackLogo={settings.logoDataUrl}
                        onRequestSendGmail={(r) => setGmailModalReceipt(r)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-stone-200 flex items-center gap-2 font-bold text-sm text-stone-900">
                  <Mail className="w-4 h-4 text-[#C2410C]" />
                  <span>יומן שליחות Gmail ({emails.length})</span>
                </div>
                {emails.length === 0 ? (
                  <div className="p-8 text-center text-xs text-stone-500">
                    טרם נשלחו מיילים.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-500">
                        <tr>
                          <th className="py-2.5 px-4">אל</th>
                          <th className="py-2.5 px-4">נושא</th>
                          <th className="py-2.5 px-4">סכום</th>
                          <th className="py-2.5 px-4">סטטוס</th>
                          <th className="py-2.5 px-4">שעה</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {emails.map((em) => (
                          <tr key={em.id}>
                            <td className="py-2.5 px-4 font-mono-tabular" dir="ltr">
                              {em.toEmail}
                            </td>
                            <td className="py-2.5 px-4 text-stone-800">{em.subject}</td>
                            <td className="py-2.5 px-4 font-mono-tabular font-bold">₪{em.total}</td>
                            <td className="py-2.5 px-4">
                              {em.status === 'sent_gmail' ? (
                                <span className="text-emerald-700 font-semibold">נשלח ב-Gmail</span>
                              ) : em.status === 'sent_smtp' ? (
                                <span className="text-emerald-700 font-semibold">נשלח אוטומטית (SMTP חינם)</span>
                              ) : (
                                <span className="text-amber-700">ממתין לאישור שליחה</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-mono-tabular text-stone-500">
                              {new Date(em.sentAt).toLocaleString('he-IL', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-8">
              <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">לוגו ושם החנות</h2>
                  <p className="text-sm text-stone-600 mt-1">
                    העלו לוגו חדש לחנות — הוא יתעדכן אוטומטית בראש האתר, בכל הקבלות ובדפי התגים להדפסה.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-5">
                  <StoreLogo
                    logoDataUrl={settings.logoDataUrl}
                    storeName={settings.storeName}
                    size="lg"
                  />
                  <div className="flex flex-wrap gap-3">
                    <label className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>העלה תמונת לוגו</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => handleLogoUpload(e.target.files?.[0] || null)}
                      />
                    </label>
                    {settings.logoDataUrl && (
                      <button
                        type="button"
                        onClick={() => handleSaveBranding(null)}
                        className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>אפס ללוגו ברירת מחדל</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      שם החנות
                    </label>
                    <input
                      type="text"
                      value={storeNameInput}
                      onChange={(e) => setStoreNameInput(e.target.value)}
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      כותרת משנה
                    </label>
                    <input
                      type="text"
                      value={storeSubtitleInput}
                      onChange={(e) => setStoreSubtitleInput(e.target.value)}
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {brandSaved && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{brandSaved}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleSaveBranding()}
                  className="px-5 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold rounded-lg cursor-pointer"
                >
                  שמור שם ותיאור חנות
                </button>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-stone-900">
                    יצירת שם משתמש וסיסמה לבני המשפחה
                  </h3>
                  <p className="text-sm text-stone-600 mt-1">
                    צרו חשבונות אישיים עם שם משתמש וסיסמה עבור כל בן משפחה.
                  </p>
                </div>

                <form
                  onSubmit={handleCreateUser}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
                >
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="שם משתמש (באנגלית)"
                    className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="סיסמה"
                    className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="שם תצוגה (עברית)"
                    className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm"
                  />
                  <input
                    type="email"
                    dir="ltr"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@gmail.com"
                    className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-left"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>צור משתמש</span>
                  </button>
                </form>

                {userErr && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    {userErr}
                  </div>
                )}
                {userMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                    {userMsg}
                  </div>
                )}

                <div className="overflow-x-auto border-t border-stone-100 pt-4">
                  <table className="w-full text-right text-sm">
                    <thead className="text-xs text-stone-500 border-b border-stone-200">
                      <tr>
                        <th className="py-2.5 px-3">שם תצוגה</th>
                        <th className="py-2.5 px-3">שם משתמש</th>
                        <th className="py-2.5 px-3">מייל</th>
                        <th className="py-2.5 px-3">תפקיד</th>
                        <th className="py-2.5 px-3">פעולות</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {users.map((u) => (
                        <tr key={u.username}>
                          <td className="py-2.5 px-3 font-semibold text-stone-900">
                            {u.displayName}
                          </td>
                          <td className="py-2.5 px-3 font-mono-tabular text-stone-700">
                            {u.username}
                          </td>
                          <td className="py-2.5 px-3 font-mono-tabular text-xs text-stone-500" dir="ltr">
                            {u.email}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-stone-600">
                            {u.role === 'admin' ? 'מנהל מערכת (מובנה)' : 'בן משפחה'}
                          </td>
                          <td className="py-2.5 px-3">
                            {u.username !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.username)}
                                className="text-stone-400 hover:text-red-600 p-1 cursor-pointer"
                                aria-label={`מחק את ${u.username}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <GmailConfirmModal
        receipt={gmailModalReceipt}
        onClose={() => setGmailModalReceipt(null)}
        onSent={() => {
          setGmailConnected(true);
          onRefreshAdminData();
        }}
      />
    </div>
  );
}
