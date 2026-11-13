/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShoppingBag, LogOut } from 'lucide-react';
import type {
  CartItem,
  ChatMessage,
  EmailDispatch,
  OrderReceipt,
  Product,
  SafeUser,
  StoreSettings,
  UserLiveActivity,
} from './types';
import { StoreLogo } from './components/BarcodeVisuals';
import { LoginView } from './components/LoginView';
import { StorefrontView } from './components/StorefrontView';
import { SpecialChatView } from './components/SpecialChatView';
import { CartDrawer } from './components/CartDrawer';
import { AdminDashboard } from './components/AdminDashboard';
import { initGmailAuth } from './lib/gmail';

type AppView = 'store' | 'chat' | 'admin';

const SESSION_KEY = 'katan_veshaveh_user';

export default function App() {
  const [user, setUser] = useState<SafeUser | null>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? (JSON.parse(saved) as SafeUser) : null;
    } catch {
      return null;
    }
  });
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: 'קטן ושווה',
    storeSubtitle: 'החנות המשפחתית שלנו בבית — קונים בכיף אונליין או בסריקה מהמדף',
    logoDataUrl: null,
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [view, setView] = useState<AppView>(() =>
    user?.role === 'admin' ? 'admin' : 'store'
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allUsers, setAllUsers] = useState<SafeUser[]>([]);
  const [orders, setOrders] = useState<OrderReceipt[]>([]);
  const [emails, setEmails] = useState<EmailDispatch[]>([]);
  const [liveSessions, setLiveSessions] = useState<Record<string, UserLiveActivity>>({});
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const cursorRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 });
  const searchQueryRef = useRef<string>('');
  const lastActivityRef = useRef<{ action: string; detail: string }>({
    action: 'מחובר לחנות',
    detail: 'צופה בקטלוג',
  });

  useEffect(() => {
    const unsub = initGmailAuth();
    return () => unsub();
  }, []);

  const fetchStore = useCallback(async () => {
    const res = await fetch('/api/store');
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      setProducts(data.products);
    }
  }, []);

  const fetchChat = useCallback(async (loggedUser: SafeUser) => {
    const q = loggedUser.role === 'admin' ? '' : `?username=${encodeURIComponent(loggedUser.username)}`;
    const res = await fetch(`/api/chat${q}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages || []);
    }
  }, []);

  const fetchAdminData = useCallback(async () => {
    const [uRes, oRes, eRes, lRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/orders'),
      fetch('/api/emails'),
      fetch('/api/admin/live-activity'),
    ]);
    if (uRes.ok) {
      const d = await uRes.json();
      setAllUsers(d.users || []);
    }
    if (oRes.ok) {
      const d = await oRes.json();
      setOrders(d.orders || []);
    }
    if (eRes.ok) {
      const d = await eRes.json();
      setEmails(d.emails || []);
    }
    if (lRes.ok) {
      const d = await lRes.json();
      const map: Record<string, UserLiveActivity> = {};
      for (const s of (d.sessions || []) as UserLiveActivity[]) {
        map[s.username] = s;
      }
      setLiveSessions(map);
    }
  }, []);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  const emitActivity = useCallback(
    (action: string, detail: string, overrideView?: AppView, overrideProduct?: Product | null) => {
      lastActivityRef.current = { action, detail };
      const ws = wsRef.current;
      if (!user || user.role !== 'family' || !ws || ws.readyState !== WebSocket.OPEN) return;

      const docHeight = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const scrollPercent = Math.min(100, Math.round((window.scrollY / docHeight) * 100));
      const prod = overrideProduct !== undefined ? overrideProduct : activeProduct;

      ws.send(
        JSON.stringify({
          type: 'activity:update',
          username: user.username,
          payload: {
            displayName: user.displayName,
            view: overrideView || (cartOpen ? 'cart' : view),
            scrollY: Math.round(window.scrollY),
            scrollPercent,
            cursorXPercent: cursorRef.current.x,
            cursorYPercent: cursorRef.current.y,
            searchQuery: searchQueryRef.current,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            activeProductId: prod?.id || null,
            activeProductName: prod?.name || null,
            cartCount: cart.reduce((s, i) => s + i.quantity, 0),
            cartItems: cart,
            lastAction: action,
            detail,
          },
        })
      );
    },
    [user, view, cartOpen, activeProduct, cart]
  );

  useEffect(() => {
    if (!user) return;
    let closedByUser = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'auth:identify',
            username: user!.username,
            displayName: user!.displayName,
            role: user!.role,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'store:settings' && data.settings) {
            setSettings(data.settings);
          }
          if (data.type === 'store:products' && data.products) {
            setProducts(data.products);
          }
          if (data.type === 'chat:message' && data.message) {
            const incoming = data.message as ChatMessage;
            setMessages((prev) =>
              prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
            );
          }
          if (data.type === 'order:updated' && data.receipt) {
            const updatedReceipt = data.receipt as OrderReceipt;
            setMessages((prev) =>
              prev.map((m) =>
                m.receipt && m.receipt.id === updatedReceipt.id
                  ? { ...m, receipt: updatedReceipt }
                  : m
              )
            );
            if (user?.role === 'admin') {
              fetchAdminData();
            }
          }
          if (data.type === 'activity:snapshot' && data.sessions) {
            const map: Record<string, UserLiveActivity> = {};
            for (const s of data.sessions as UserLiveActivity[]) {
              map[s.username] = s;
            }
            setLiveSessions(map);
          }
          if (data.type === 'activity:broadcast' && data.activity) {
            const act = data.activity as UserLiveActivity;
            setLiveSessions((prev) => ({ ...prev, [act.username]: act }));
          }
          if (data.type === 'order:created' && user?.role === 'admin') {
            fetchAdminData();
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      ws.onclose = () => {
        if (!closedByUser) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    }

    connect();
    fetchChat(user);
    if (user.role === 'admin') {
      fetchAdminData();
    }

    return () => {
      closedByUser = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user, fetchChat, fetchAdminData]);

  // Real-time scroll & mouse pointer streaming for family users
  useEffect(() => {
    if (!user || user.role !== 'family') return;
    let lastScroll = 0;
    let lastMove = 0;

    function onScroll() {
      const now = Date.now();
      if (now - lastScroll < 120) return;
      lastScroll = now;
      emitActivity('גולל באתר', `עמוד ${view === 'chat' ? 'צ׳אט' : 'החנות'}`);
    }

    function onMouseMove(e: MouseEvent) {
      const now = Date.now();
      if (now - lastMove < 180) return;
      lastMove = now;
      cursorRef.current = {
        x: Math.round((e.clientX / Math.max(1, window.innerWidth)) * 100),
        y: Math.round((e.clientY / Math.max(1, window.innerHeight)) * 100),
      };
      emitActivity(lastActivityRef.current.action, lastActivityRef.current.detail);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [user, view, emitActivity]);

  function handleLoginSuccess(loggedInUser: SafeUser) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    setView(loggedInUser.role === 'admin' ? 'admin' : 'store');
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
    setCart([]);
    setCartOpen(false);
    setView('store');
  }

  function handleAddToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      const next = existing
        ? prev.map((i) =>
            i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
          )
        : [
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
      return next;
    });
    emitActivity('הוסיף מוצר לסל', product.name, undefined, product);
  }

  function handleUpdateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function handleRemoveItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  async function handleSendChatMessage(targetUsername: string, text: string) {
    if (!user) return;
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: targetUsername,
        sender: user.role === 'admin' ? `${settings.storeName} (מנהל)` : user.displayName,
        senderRole: user.role,
        text,
      }),
    });
    if (user.role === 'family') {
      emitActivity('שלח הודעה בצ׳אט', text.slice(0, 40));
    }
  }

  function handleWatchUser(targetUsername: string) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'admin:watch', targetUsername }));
    }
  }

  if (!user) {
    return <LoginView settings={settings} onLoginSuccess={handleLoginSuccess} />;
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#18181B] flex flex-col">
      <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-stone-200">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => {
              setView('store');
              emitActivity('חזר לדף הבית', 'החנות', 'store');
            }}
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <StoreLogo
              logoDataUrl={settings.logoDataUrl}
              storeName={settings.storeName}
              size="sm"
            />
            <span>{settings.storeName}</span>
          </button>

          <nav className="flex items-center gap-6 text-sm font-medium text-stone-600 overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setView('store');
                emitActivity('עבר לחנות', 'קטלוג מוצרים', 'store');
              }}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                view === 'store'
                  ? 'text-stone-950 font-semibold border-b-2 border-[#C2410C]'
                  : 'hover:text-stone-900'
              }`}
            >
              החנות
            </button>
            <button
              type="button"
              onClick={() => {
                setView('chat');
                emitActivity('נכנס לצ׳אט האתר', 'צפייה בקבלות והודעות', 'chat');
              }}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                view === 'chat'
                  ? 'text-stone-950 font-semibold border-b-2 border-[#C2410C]'
                  : 'hover:text-stone-900'
              }`}
            >
              צ׳אט וקבלות
            </button>
            {user.role === 'admin' && (
              <button
                type="button"
                onClick={() => setView('admin')}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  view === 'admin'
                    ? 'text-stone-950 font-semibold border-b-2 border-[#C2410C]'
                    : 'hover:text-stone-900'
                }`}
              >
                ניהול החנות
              </button>
            )}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setCartOpen(true);
                emitActivity('פתח סל קניות', `${cartCount} פריטים`);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>סל קניות</span>
              <span className="font-mono-tabular">({cartCount})</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title={`יציאה (${user.displayName})`}
              aria-label="יציאה מהחשבון"
              className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1">
        {view === 'store' && (
          <StorefrontView
            settings={settings}
            products={products}
            onAddToCart={handleAddToCart}
            onInspectProduct={(prod) => {
              setActiveProduct(prod);
              if (prod) {
                emitActivity('צופה במוצר', prod.name, undefined, prod);
              }
            }}
            onSearchChange={(q) => {
              searchQueryRef.current = q;
              emitActivity('מחפש מוצר', q || 'ניקה חיפוש');
            }}
          />
        )}

        {view === 'chat' && (
          <SpecialChatView
            user={user}
            settings={settings}
            messages={messages}
            allUsers={allUsers}
            onSendMessage={handleSendChatMessage}
            onReceiptUpdated={() => {
              fetchChat(user);
              if (user.role === 'admin') fetchAdminData();
            }}
          />
        )}

        {view === 'admin' && user.role === 'admin' && (
          <AdminDashboard
            settings={settings}
            products={products}
            users={allUsers}
            orders={orders}
            emails={emails}
            liveSessions={liveSessions}
            onWatchUser={handleWatchUser}
            onRefreshStore={fetchStore}
            onRefreshAdminData={fetchAdminData}
          />
        )}
      </div>

      <footer className="no-print border-t border-stone-200 bg-white mt-16">
        <div className="max-w-[1200px] mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div>
            {settings.storeName} · חנות משפחתית בבית · מחובר כעת: {user.displayName} ({user.username})
          </div>
          <div>קנייה אונליין, סריקת ברקודים מהמדף וייצוא תגים ל-PDF</div>
        </div>
      </footer>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        user={user}
        settings={settings}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={() => setCart([])}
        onOrderCompleted={() => {
          emitActivity('השלים הזמנה וקיבל קבלה', 'נשלחה למייל ולצ׳אט');
          fetchChat(user);
          if (user.role === 'admin') {
            fetchAdminData();
          }
        }}
        onGoToChat={() => setView('chat')}
      />
    </div>
  );
}
