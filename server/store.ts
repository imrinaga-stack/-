import fs from 'fs';
import path from 'path';
import type {
  UserAccount,
  SafeUser,
  StoreSettings,
  Product,
  OrderReceipt,
  EmailDispatch,
  ChatMessage,
} from '../src/types';

export interface StoreDatabase {
  settings: StoreSettings;
  users: UserAccount[];
  products: Product[];
  orders: OrderReceipt[];
  emails: EmailDispatch[];
  chatMessages: ChatMessage[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

const SEED_DATA: StoreDatabase = {
  settings: {
    storeName: 'קטן ושווה',
    storeSubtitle: 'החנות המשפחתית שלנו בבית — קונים בכיף אונליין או בסריקת ברקוד מהמדף',
    logoDataUrl: null,
  },
  users: [
    {
      username: 'admin',
      password: 'katan-admin',
      displayName: 'מנהל החנות',
      email: 'admin@katan-veshaveh.home',
      role: 'admin',
      createdAt: '2026-11-01T08:00:00.000Z',
    },
  ],
  products: [
    {
      id: 'prod-1',
      name: 'משחק קופסה: ממלכת הצבעים',
      category: 'משחקי קופסה',
      description: 'משחק אסטרטגיה משפחתי צבעוני עם חיילי עץ וקוביות אתגר לערבי שישי.',
      price: 65,
      imageUrl: '/src/assets/images/product_board_game_1794587710970.jpg',
      angles: { top: '/src/assets/images/product_board_game_1794587710970.jpg' },
      barcode: '7290010010018',
      inStock: true,
      hasGeneratedTag: false,
      createdAt: '2026-11-01T09:00:00.000Z',
    },
    {
      id: 'prod-2',
      name: 'משחק קלפים משפחתי מצחיק',
      category: 'משחקי קלפים',
      description: 'חבילת קלפי משימות ואתגרים מצחיקים לכל המשפחה מגיל 7 ומעלה.',
      price: 38,
      imageUrl: '/src/assets/images/product_card_deck_1794587711734.jpg',
      angles: { top: '/src/assets/images/product_card_deck_1794587711734.jpg' },
      barcode: '7290010010025',
      inStock: true,
      hasGeneratedTag: false,
      createdAt: '2026-11-01T09:05:00.000Z',
    },
    {
      id: 'prod-3',
      name: 'קוביית פאזל עץ תלת־ממדית',
      category: 'פאזלים וחשיבה',
      description: 'קוביית חשיבה מעץ בוק ואגוז טבעי לפירוק והרכבה מחדש.',
      price: 42,
      imageUrl: '/src/assets/images/product_wooden_puzzle_1794587712605.jpg',
      angles: { top: '/src/assets/images/product_wooden_puzzle_1794587712605.jpg' },
      barcode: '7290010010032',
      inStock: true,
      hasGeneratedTag: false,
      createdAt: '2026-11-01T09:10:00.000Z',
    },
    {
      id: 'prod-4',
      name: 'מארז ערב סרט משפחתי',
      category: 'פינוקים וחטיפים',
      description: 'צנצנת פופקורן ביתי, טבלאות שוקולד פרימיום ושתי כוסות קקאו חמות.',
      price: 54,
      imageUrl: '/src/assets/images/product_snack_box_1794587712695.jpg',
      angles: { top: '/src/assets/images/product_snack_box_1794587712695.jpg' },
      barcode: '7290010010049',
      inStock: true,
      hasGeneratedTag: false,
      createdAt: '2026-11-01T09:15:00.000Z',
    },
    {
      id: 'prod-5',
      name: 'המתיישבים של קטאן — מהדורת הבית',
      category: 'משחקי קופסה',
      description: 'קלאסיקת המסחר והבנייה המשפחתית מהמדף בסלון, כולל כל הקלפים והכבישים.',
      price: 89,
      imageUrl: '/src/assets/images/hero_family_store_1794587711310.jpg',
      angles: { top: '/src/assets/images/hero_family_store_1794587711310.jpg' },
      barcode: '7290010010056',
      inStock: true,
      hasGeneratedTag: false,
      createdAt: '2026-11-01T09:20:00.000Z',
    },
    {
      id: 'prod-6',
      name: 'קלפי סיפור ודמיון זוגי',
      category: 'משחקי קלפים',
      description: 'סט קלפים קליל למשחק מהיר אחרי ארוחת ערב.',
      price: 29,
      imageUrl: '/src/assets/images/product_card_deck_1794587711734.jpg',
      angles: { top: '/src/assets/images/product_card_deck_1794587711734.jpg' },
      barcode: '7290010010063',
      inStock: true,
      hasGeneratedTag: false,
      createdAt: '2026-11-01T09:25:00.000Z',
    },
    {
      id: 'prod-7',
      name: 'מגדל עץ מאוזן — אתגר משפחתי',
      category: 'פאזלים וחשיבה',
      description: 'בלוקים מעץ מלא לבניית מגדל ושליפת קוביות בלי להפיל.',
      price: 49,
      imageUrl: '/src/assets/images/product_wooden_puzzle_1794587712605.jpg',
      angles: { top: '/src/assets/images/product_wooden_puzzle_1794587712605.jpg' },
      barcode: '7290010010070',
      inStock: true,
      hasGeneratedTag: false,
      createdAt: '2026-11-01T09:30:00.000Z',
    },
    {
      id: 'prod-8',
      name: 'צנצנת פופקורן קרמל ופרצעל',
      category: 'פינוקים וחטיפים',
      description: 'חטיף פריך מוכן לחלוקה בזמן משחק הקופסה.',
      price: 22,
      imageUrl: '/src/assets/images/product_snack_box_1794587712695.jpg',
      angles: { top: '/src/assets/images/product_snack_box_1794587712695.jpg' },
      barcode: '7290010010087',
      inStock: true,
      hasGeneratedTag: false,
      createdAt: '2026-11-01T09:35:00.000Z',
    },
    {
      id: 'prod-9',
      name: 'קופסת הרפתקאות וטירות',
      category: 'משחקי קופסה',
      description: 'משחק לוח מרתק עם לוחות מפה וחיילי דרקון ואבירים.',
      price: 74,
      imageUrl: '/src/assets/images/product_board_game_1794587710970.jpg',
      angles: { top: '/src/assets/images/product_board_game_1794587710970.jpg' },
      barcode: '7290010010094',
      inStock: true,
      hasGeneratedTag: false,
      createdAt: '2026-11-01T09:40:00.000Z',
    },
    {
      id: 'prod-10',
      name: 'חבילת מתנה בהפתעה מהמדף',
      category: 'פינוקים וחטיפים',
      description: 'אריזת קראפט משפחתית חגיגית עם הפתעות קטנות וטעימות.',
      price: 35,
      imageUrl: '/src/assets/images/hero_family_store_1794587711310.jpg',
      angles: { top: '/src/assets/images/hero_family_store_1794587711310.jpg' },
      barcode: '7290010010100',
      inStock: true,
      hasGeneratedTag: false,
      createdAt: '2026-11-01T09:45:00.000Z',
    },
  ],
  orders: [],
  emails: [],
  chatMessages: [],
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadStore(): StoreDatabase {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(SEED_DATA, null, 2), 'utf-8');
    return structuredClone(SEED_DATA);
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as StoreDatabase;
    if (!parsed.users || parsed.users.length === 0) {
      return structuredClone(SEED_DATA);
    }
    return parsed;
  } catch {
    return structuredClone(SEED_DATA);
  }
}

export function saveStore(db: StoreDatabase): void {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

export function toSafeUser(user: UserAccount): SafeUser {
  const { password: _pw, ...safe } = user;
  return safe;
}

export function generateSyntheticBarcode(existingBarcodes: Set<string>): string {
  for (let i = 0; i < 100; i++) {
    const num = Math.floor(100000 + Math.random() * 899999);
    const candidate = `729001${num}`;
    if (!existingBarcodes.has(candidate)) {
      return candidate;
    }
  }
  return `729001${Date.now().toString().slice(-7)}`;
}
