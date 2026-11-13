export type UserRole = 'admin' | 'family';

export interface UserAccount {
  username: string;
  password: string;
  displayName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface SafeUser {
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface StoreSettings {
  storeName: string;
  storeSubtitle: string;
  logoDataUrl: string | null;
}

export interface ProductAngles {
  top?: string;
  side?: string;
  bottom?: string;
  otherSide?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  imageUrl: string;
  angles: ProductAngles;
  barcode: string;
  inStock: boolean;
  hasGeneratedTag: boolean;
  createdAt: string;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  barcode: string;
}

export interface OrderReceipt {
  id: string;
  username: string;
  customerName: string;
  customerEmail: string;
  items: CartItem[];
  total: number;
  storeName: string;
  logoSnapshot: string | null;
  source: 'online' | 'in_store';
  emailStatus: 'sent_gmail' | 'sent_smtp' | 'pending_gmail';
  gmailMessageId?: string;
  chatDelivered: boolean;
  createdAt: string;
}

export interface EmailDispatch {
  id: string;
  toEmail: string;
  toName: string;
  subject: string;
  receiptId: string;
  total: number;
  itemsCount: number;
  status: 'sent_gmail' | 'sent_smtp' | 'pending_gmail';
  gmailMessageId?: string;
  sentAt: string;
}

export interface ChatMessage {
  id: string;
  username: string;
  sender: string;
  senderRole: 'admin' | 'family' | 'system';
  text: string;
  receipt?: OrderReceipt;
  createdAt: string;
}

export interface UserLiveActivity {
  username: string;
  displayName?: string;
  online: boolean;
  view: string;
  scrollY: number;
  scrollPercent: number;
  cursorXPercent: number;
  cursorYPercent: number;
  searchQuery?: string;
  viewportWidth: number;
  viewportHeight: number;
  activeProductId: string | null;
  activeProductName: string | null;
  cartCount: number;
  cartItems: CartItem[];
  lastAction: string;
  updatedAt: string;
  timeline: Array<{
    action: string;
    detail: string;
    timestamp: string;
  }>;
}

export interface TagSheetItem {
  id: string;
  productId: string | null;
  productName: string;
  price: number;
  barcode: string;
  imageUrl: string;
  category: string;
}
