import 'dotenv/config';
import http from 'http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import {
  loadStore,
  saveStore,
  toSafeUser,
  generateSyntheticBarcode,
} from './server/store';
import {
  analyzeProductFromAngles,
  runBarcodeAssistant,
  estimateCustomTagWithAI,
} from './server/gemini';
import { isServerMailerConfigured, sendServerReceiptEmail } from './server/mailer';
import type {
  CartItem,
  ChatMessage,
  EmailDispatch,
  OrderReceipt,
  Product,
  TagSheetItem,
  UserAccount,
  UserLiveActivity,
} from './src/types';

const PORT = 3000;

interface ConnectedClient {
  ws: WebSocket;
  username: string;
  role: 'admin' | 'family';
  watchingUsername?: string;
}

const clients = new Set<ConnectedClient>();
const liveActivityMap = new Map<string, UserLiveActivity>();

function broadcastToAll(payload: unknown) {
  const data = JSON.stringify(payload);
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function broadcastToAdmins(payload: unknown) {
  const data = JSON.stringify(payload);
  for (const client of clients) {
    if (client.role === 'admin' && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function broadcastChatToParticipants(msg: ChatMessage) {
  const data = JSON.stringify({ type: 'chat:message', message: msg });
  for (const client of clients) {
    if (
      client.ws.readyState === WebSocket.OPEN &&
      (client.role === 'admin' || client.username === msg.username)
    ) {
      client.ws.send(data);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/email/config-status', (_req, res) => {
    res.json({ serverSmtpConfigured: isServerMailerConfigured() });
  });

  // Auth login
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    const cleanUser = (username || '').trim().toLowerCase();
    const db = loadStore();
    const found = db.users.find(
      (u) => u.username.toLowerCase() === cleanUser && u.password === (password || '')
    );
    if (!found) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
    }
    return res.json({ user: toSafeUser(found) });
  });

  // Public store state (settings + products)
  app.get('/api/store', (_req, res) => {
    const db = loadStore();
    res.json({
      settings: db.settings,
      products: db.products,
    });
  });

  // Admin: update store settings (name, subtitle, logo)
  app.put('/api/admin/settings', (req, res) => {
    const db = loadStore();
    const { storeName, storeSubtitle, logoDataUrl } = req.body as {
      storeName?: string;
      storeSubtitle?: string;
      logoDataUrl?: string | null;
    };
    if (typeof storeName === 'string' && storeName.trim()) {
      db.settings.storeName = storeName.trim();
    }
    if (typeof storeSubtitle === 'string') {
      db.settings.storeSubtitle = storeSubtitle.trim();
    }
    if (logoDataUrl !== undefined) {
      db.settings.logoDataUrl = logoDataUrl;
    }
    saveStore(db);
    broadcastToAll({ type: 'store:settings', settings: db.settings });
    res.json({ settings: db.settings });
  });

  // Admin: users CRUD
  app.get('/api/admin/users', (_req, res) => {
    const db = loadStore();
    res.json({ users: db.users.map(toSafeUser) });
  });

  app.post('/api/admin/users', (req, res) => {
    const { username, password, displayName, email, role } = req.body as Partial<UserAccount>;
    const cleanUsername = (username || '').trim().toLowerCase();
    if (!cleanUsername || !password) {
      return res.status(400).json({ error: 'יש להזין שם משתמש וסיסמה.' });
    }
    const db = loadStore();
    if (db.users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      return res.status(409).json({ error: 'שם משתמש זה כבר קיים במערכת.' });
    }
    const newUser: UserAccount = {
      username: cleanUsername,
      password,
      displayName: (displayName || cleanUsername).trim(),
      email: (email || `${cleanUsername}@family.home`).trim(),
      role: role === 'admin' ? 'admin' : 'family',
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    const welcomeMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      username: newUser.username,
      sender: db.settings.storeName,
      senderRole: 'system',
      text: `שלום ${newUser.displayName}! החשבון שלך בחנות "${db.settings.storeName}" נוצר. כאן יופיעו הקבלות שלך והודעות מהמנהל.`,
      createdAt: new Date().toISOString(),
    };
    db.chatMessages.push(welcomeMsg);
    saveStore(db);
    broadcastChatToParticipants(welcomeMsg);
    res.json({ user: toSafeUser(newUser) });
  });

  app.delete('/api/admin/users/:username', (req, res) => {
    const target = req.params.username.toLowerCase();
    if (target === 'admin') {
      return res.status(400).json({ error: 'לא ניתן למחוק את חשבון האדמין המובנה.' });
    }
    const db = loadStore();
    db.users = db.users.filter((u) => u.username.toLowerCase() !== target);
    saveStore(db);
    res.json({ ok: true });
  });

  // Admin: products CRUD
  app.post('/api/admin/products', (req, res) => {
    const db = loadStore();
    const existingSet = new Set(db.products.map((p) => p.barcode));
    const body = req.body as Partial<Product>;
    const barcode = (body.barcode || '').trim() || generateSyntheticBarcode(existingSet);
    const id = `prod-${Date.now()}`;
    const newProduct: Product = {
      id,
      name: (body.name || 'מוצר חדש').trim(),
      category: (body.category || 'משחקי קופסה').trim(),
      description: (body.description || 'מוצר משפחתי בחנות קטן ושווה.').trim(),
      price: Number(body.price) > 0 ? Math.round(Number(body.price)) : 25,
      imageUrl:
        body.imageUrl ||
        body.angles?.top ||
        '/src/assets/images/product_board_game_1794587710970.jpg',
      angles: body.angles || {},
      barcode,
      inStock: body.inStock ?? true,
      hasGeneratedTag: false,
      createdAt: new Date().toISOString(),
    };
    db.products.unshift(newProduct);
    saveStore(db);
    broadcastToAll({ type: 'store:products', products: db.products });
    res.json({ product: newProduct });
  });

  app.put('/api/admin/products/:id', (req, res) => {
    const db = loadStore();
    const idx = db.products.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'המוצר לא נמצא.' });
    }
    const patch = req.body as Partial<Product>;
    db.products[idx] = {
      ...db.products[idx],
      ...patch,
      id: db.products[idx].id,
    };
    saveStore(db);
    broadcastToAll({ type: 'store:products', products: db.products });
    res.json({ product: db.products[idx] });
  });

  app.delete('/api/admin/products/:id', (req, res) => {
    const db = loadStore();
    db.products = db.products.filter((p) => p.id !== req.params.id);
    saveStore(db);
    broadcastToAll({ type: 'store:products', products: db.products });
    res.json({ ok: true });
  });

  // 1D Barcode lookup — strictly returns 404 if barcode is not in catalog
  app.get('/api/scan/:code', (req, res) => {
    const code = (req.params.code || '').trim();
    const db = loadStore();
    const found = db.products.find(
      (p) => p.barcode.toLowerCase() === code.toLowerCase()
    );
    if (!found) {
      return res.status(404).json({
        found: false,
        code,
        message: 'הברקוד לא נמצא במערכת קטן ושווה.',
      });
    }
    return res.json({ found: true, product: found });
  });

  // Orders & automatic Email + Special In-App Chat receipt dispatch
  app.post('/api/orders', async (req, res) => {
    const { username, customerEmail, items, source } = req.body as {
      username?: string;
      customerEmail?: string;
      items?: CartItem[];
      source?: 'online' | 'in_store';
    };
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'הסל ריק — יש לבחור לפחות מוצר אחד.' });
    }
    const cleanEmail = (customerEmail || '').trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'יש להזין כתובת מייל תקינה לקבלת הקבלה.' });
    }

    const db = loadStore();
    const user = db.users.find((u) => u.username === (username || 'admin').toLowerCase());
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const receipt: OrderReceipt = {
      id: `RCP-${Date.now().toString().slice(-6)}`,
      username: user?.username || (username || 'guest').toLowerCase(),
      customerName: user?.displayName || username || 'אורח משפחתי',
      customerEmail: cleanEmail,
      items,
      total,
      storeName: db.settings.storeName,
      logoSnapshot: db.settings.logoDataUrl,
      source: source === 'in_store' ? 'in_store' : 'online',
      emailStatus: 'pending_gmail',
      chatDelivered: true,
      createdAt: new Date().toISOString(),
    };

    // Attempt free automatic server SMTP send if configured in Secrets
    const smtpRes = await sendServerReceiptEmail(receipt);
    if (smtpRes.sent) {
      receipt.emailStatus = 'sent_smtp';
      receipt.gmailMessageId = smtpRes.messageId;
    }

    db.orders.unshift(receipt);

    const emailEntry: EmailDispatch = {
      id: `EML-${Date.now().toString().slice(-6)}`,
      toEmail: cleanEmail,
      toName: receipt.customerName,
      subject: `קבלה מ-${db.settings.storeName} — הזמנה #${receipt.id}`,
      receiptId: receipt.id,
      total,
      itemsCount: items.reduce((s, i) => s + i.quantity, 0),
      status: receipt.emailStatus,
      gmailMessageId: receipt.gmailMessageId,
      sentAt: receipt.createdAt,
    };
    db.emails.unshift(emailEntry);

    const chatMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      username: receipt.username,
      sender: db.settings.storeName,
      senderRole: 'system',
      text: `קבלה רשמית מהחנות "${db.settings.storeName}" עבור ${cleanEmail}`,
      receipt,
      createdAt: receipt.createdAt,
    };
    db.chatMessages.push(chatMsg);

    if (user && user.email !== cleanEmail) {
      user.email = cleanEmail;
    }

    saveStore(db);
    broadcastChatToParticipants(chatMsg);
    broadcastToAdmins({ type: 'order:created', receipt, email: emailEntry });

    res.json({ receipt, email: emailEntry, chatMessage: chatMsg });
  });

  app.post('/api/orders/:id/mark-email-sent', (req, res) => {
    const { gmailMessageId } = req.body as { gmailMessageId?: string };
    const db = loadStore();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'הקבלה לא נמצאה.' });
    }
    order.emailStatus = 'sent_gmail';
    order.gmailMessageId = gmailMessageId;

    const emailEntry = db.emails.find((e) => e.receiptId === order.id);
    if (emailEntry) {
      emailEntry.status = 'sent_gmail';
      emailEntry.gmailMessageId = gmailMessageId;
      emailEntry.sentAt = new Date().toISOString();
    }

    for (const m of db.chatMessages) {
      if (m.receipt && m.receipt.id === order.id) {
        m.receipt.emailStatus = 'sent_gmail';
        m.receipt.gmailMessageId = gmailMessageId;
      }
    }

    saveStore(db);
    broadcastToAll({ type: 'order:updated', receipt: order });
    res.json({ receipt: order });
  });

  app.get('/api/orders', (req, res) => {
    const db = loadStore();
    const username = typeof req.query.username === 'string' ? req.query.username.toLowerCase() : null;
    const orders = username
      ? db.orders.filter((o) => o.username.toLowerCase() === username)
      : db.orders;
    res.json({ orders });
  });

  app.get('/api/emails', (_req, res) => {
    const db = loadStore();
    res.json({ emails: db.emails });
  });

  // Chat endpoints
  app.get('/api/chat', (req, res) => {
    const db = loadStore();
    const username = typeof req.query.username === 'string' ? req.query.username.toLowerCase() : null;
    const messages = username
      ? db.chatMessages.filter((m) => m.username.toLowerCase() === username)
      : db.chatMessages;
    res.json({ messages });
  });

  app.post('/api/chat', (req, res) => {
    const { username, sender, senderRole, text } = req.body as {
      username?: string;
      sender?: string;
      senderRole?: 'admin' | 'family';
      text?: string;
    };
    if (!text?.trim() || !username) {
      return res.status(400).json({ error: 'תוכן ההודעה חסר.' });
    }
    const db = loadStore();
    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      username: username.toLowerCase(),
      sender: sender || username,
      senderRole: senderRole === 'admin' ? 'admin' : 'family',
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    db.chatMessages.push(msg);
    saveStore(db);
    broadcastChatToParticipants(msg);
    res.json({ message: msg });
  });

  // Admin: live user activity snapshot
  app.get('/api/admin/live-activity', (_req, res) => {
    res.json({ sessions: Array.from(liveActivityMap.values()) });
  });

  // AI Route 1: Analyze 4-angle product photos + suggest name, price & barcode
  app.post('/api/ai/analyze-product', async (req, res) => {
    try {
      const { images, hintName } = req.body as {
        images?: Array<{ label: string; dataUrl: string }>;
        hintName?: string;
      };
      if (!images || images.length === 0) {
        return res.status(400).json({ error: 'יש להעלות לפחות תמונה אחת של המוצר.' });
      }
      const db = loadStore();
      const result = await analyzeProductFromAngles({
        images,
        hintName,
        existingBarcodes: db.products.map((p) => p.barcode),
      });
      res.json({ analysis: result });
    } catch (error) {
      console.error('AI analyze-product error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'שגיאה בניתוח המוצר באמצעות AI.',
      });
    }
  });

  // AI Route 2: Barcode assistant (create / show / fix invalid barcode)
  app.post('/api/ai/barcode-assistant', async (req, res) => {
    try {
      const { prompt, targetProductId } = req.body as {
        prompt?: string;
        targetProductId?: string;
      };
      if (!prompt?.trim()) {
        return res.status(400).json({ error: 'יש לכתוב בקשה לעוזר הברקודים.' });
      }
      const db = loadStore();
      const result = await runBarcodeAssistant({
        prompt,
        products: db.products,
        targetProductId,
      });

      // If fixing or generating for an existing product, persist the new barcode!
      if ((result.action === 'fix' || result.action === 'generate') && (result.productId || targetProductId)) {
        const pid = result.productId || targetProductId;
        const prod = db.products.find((p) => p.id === pid);
        if (prod) {
          prod.barcode = result.barcode;
          saveStore(db);
          broadcastToAll({ type: 'store:products', products: db.products });
        }
      }

      res.json({ result });
    } catch (error) {
      console.error('AI barcode-assistant error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'שגיאה בעוזר הברקודים של AI.',
      });
    }
  });

  // AI Route 3: Generate A4 tag sheet (single/custom or auto-8 products never tagged before)
  app.post('/api/ai/generate-tags', async (req, res) => {
    try {
      const { mode, prompt, productId, productName, price } = req.body as {
        mode: 'auto8' | 'single' | 'custom';
        prompt?: string;
        productId?: string;
        productName?: string;
        price?: number;
      };
      const db = loadStore();

      if (mode === 'auto8') {
        let candidates = db.products.filter((p) => !p.hasGeneratedTag);
        let resetMessage = '';
        if (candidates.length === 0) {
          candidates = db.products;
          resetMessage = 'כל המוצרים כבר קיבלו תג בעבר — נבחרו 8 מוצרים מהקטלוג להדפסה חוזרת.';
        }
        const selected = candidates.slice(0, 8);
        for (const p of selected) {
          p.hasGeneratedTag = true;
        }
        saveStore(db);
        broadcastToAll({ type: 'store:products', products: db.products });

        const tags: TagSheetItem[] = selected.map((p) => ({
          id: `tag-${p.id}-${Date.now()}`,
          productId: p.id,
          productName: p.name,
          price: p.price,
          barcode: p.barcode,
          imageUrl: p.imageUrl,
          category: p.category,
        }));

        return res.json({
          tags,
          message:
            resetMessage ||
            `הותאמו אוטומטית ${tags.length} מוצרים שעדיין לא נוצר להם תג מעולם (דף A4 מוכן להדפסה ולייצוא PDF).`,
        });
      }

      if (mode === 'single' && productId) {
        const prod = db.products.find((p) => p.id === productId);
        if (!prod) {
          return res.status(404).json({ error: 'המוצר לא נמצא.' });
        }
        prod.hasGeneratedTag = true;
        saveStore(db);
        broadcastToAll({ type: 'store:products', products: db.products });
        return res.json({
          tags: [
            {
              id: `tag-${prod.id}-${Date.now()}`,
              productId: prod.id,
              productName: prod.name,
              price: prod.price,
              barcode: prod.barcode,
              imageUrl: prod.imageUrl,
              category: prod.category,
            },
          ],
          message: `נוצר תג רשמי עבור "${prod.name}".`,
        });
      }

      const aiEstimate = await estimateCustomTagWithAI({
        prompt: prompt || productName || 'מוצר חדש לחנות',
        productName,
        price,
        existingBarcodes: db.products.map((p) => p.barcode),
      });

      const customTag: TagSheetItem = {
        id: `tag-custom-${Date.now()}`,
        productId: null,
        productName: productName?.trim() || aiEstimate.productName,
        price: price && price > 0 ? price : aiEstimate.price,
        barcode: aiEstimate.barcode,
        imageUrl: '/src/assets/images/hero_family_store_1794587711310.jpg',
        category: aiEstimate.category,
      };

      return res.json({
        tags: [customTag],
        message: `AI יצר תג מותאם: "${customTag.productName}" במחיר ₪${customTag.price}.`,
      });
    } catch (error) {
      console.error('AI generate-tags error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'שגיאה ביצירת התגים.',
      });
    }
  });

  // HTTP server + Vite middleware + WebSocket server on port 3000
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const clientInfo: ConnectedClient = {
      ws,
      username: 'guest',
      role: 'family',
    };
    clients.add(clientInfo);

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as {
          type: string;
          username?: string;
          displayName?: string;
          role?: 'admin' | 'family';
          targetUsername?: string;
          payload?: Record<string, unknown>;
        };

        if (data.type === 'auth:identify') {
          clientInfo.username = (data.username || 'guest').toLowerCase();
          clientInfo.role = data.role === 'admin' ? 'admin' : 'family';

          if (clientInfo.role === 'family') {
            const existing = liveActivityMap.get(clientInfo.username);
            const updated: UserLiveActivity = {
              username: clientInfo.username,
              displayName: data.displayName || existing?.displayName || clientInfo.username,
              online: true,
              view: existing?.view || 'store',
              scrollY: existing?.scrollY || 0,
              scrollPercent: existing?.scrollPercent || 0,
              cursorXPercent: existing?.cursorXPercent || 50,
              cursorYPercent: existing?.cursorYPercent || 50,
              searchQuery: existing?.searchQuery || '',
              viewportWidth: existing?.viewportWidth || 1280,
              viewportHeight: existing?.viewportHeight || 800,
              activeProductId: existing?.activeProductId || null,
              activeProductName: existing?.activeProductName || null,
              cartCount: existing?.cartCount || 0,
              cartItems: existing?.cartItems || [],
              lastAction: 'התחבר לאתר',
              updatedAt: new Date().toISOString(),
              timeline: [
                {
                  action: 'התחבר לאתר',
                  detail: 'כניסה לחנות המשפחתית',
                  timestamp: new Date().toISOString(),
                },
                ...(existing?.timeline || []),
              ].slice(0, 25),
            };
            liveActivityMap.set(clientInfo.username, updated);
            broadcastToAdmins({ type: 'activity:broadcast', activity: updated });
          } else {
            ws.send(
              JSON.stringify({
                type: 'activity:snapshot',
                sessions: Array.from(liveActivityMap.values()),
              })
            );
          }
        }

        if (data.type === 'activity:update' && data.payload) {
          const uname = (clientInfo.username || (data.username as string) || 'guest').toLowerCase();
          const p = data.payload;
          const existing = liveActivityMap.get(uname);
          const actionText = String(p.lastAction || 'גולל באתר');
          const detailText = String(p.detail || '');

          const shouldAppendTimeline =
            !existing ||
            existing.timeline.length === 0 ||
            existing.timeline[0].action !== actionText ||
            existing.timeline[0].detail !== detailText;

          const newTimeline = shouldAppendTimeline
            ? [
                {
                  action: actionText,
                  detail: detailText,
                  timestamp: new Date().toISOString(),
                },
                ...(existing?.timeline || []),
              ].slice(0, 25)
            : existing.timeline;

          const updated: UserLiveActivity = {
            username: uname,
            displayName: String(p.displayName || existing?.displayName || uname),
            online: true,
            view: String(p.view || 'store'),
            scrollY: Number(p.scrollY || 0),
            scrollPercent: Number(p.scrollPercent || 0),
            cursorXPercent: Number(p.cursorXPercent ?? existing?.cursorXPercent ?? 50),
            cursorYPercent: Number(p.cursorYPercent ?? existing?.cursorYPercent ?? 50),
            searchQuery: typeof p.searchQuery === 'string' ? p.searchQuery : existing?.searchQuery,
            viewportWidth: Number(p.viewportWidth || 1280),
            viewportHeight: Number(p.viewportHeight || 800),
            activeProductId: (p.activeProductId as string | null) ?? null,
            activeProductName: (p.activeProductName as string | null) ?? null,
            cartCount: Number(p.cartCount || 0),
            cartItems: (p.cartItems as CartItem[]) || [],
            lastAction: actionText,
            updatedAt: new Date().toISOString(),
            timeline: newTimeline,
          };

          liveActivityMap.set(uname, updated);
          broadcastToAdmins({ type: 'activity:broadcast', activity: updated });
        }

        if (data.type === 'admin:watch' && clientInfo.role === 'admin') {
          clientInfo.watchingUsername = data.targetUsername?.toLowerCase();
          const target = clientInfo.watchingUsername
            ? liveActivityMap.get(clientInfo.watchingUsername)
            : undefined;
          if (target) {
            ws.send(JSON.stringify({ type: 'activity:broadcast', activity: target }));
          }
        }
      } catch {
        // Ignore malformed WS frame
      }
    });

    ws.on('close', () => {
      clients.delete(clientInfo);
      if (clientInfo.role === 'family' && clientInfo.username !== 'guest') {
        const stillConnected = Array.from(clients).some(
          (c) => c.username === clientInfo.username && c.role === 'family'
        );
        if (!stillConnected) {
          const existing = liveActivityMap.get(clientInfo.username);
          if (existing) {
            existing.online = false;
            existing.lastAction = 'התנתק מהאתר';
            existing.updatedAt = new Date().toISOString();
            liveActivityMap.set(clientInfo.username, existing);
            broadcastToAdmins({ type: 'activity:broadcast', activity: existing });
          }
        }
      }
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Katan VeShaveh server running on http://localhost:${PORT}`);
  });
}

startServer();
