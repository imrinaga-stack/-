import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type { OrderReceipt } from '../types';

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.send');

// Strictly in-memory token cache (never localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export function initGmailAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) {
  return onAuthStateChanged(auth, (user) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      if (!user) cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
}

export async function signInWithGoogleForGmail(): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('לא התקבל אישור גישה ל-Gmail.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getGmailAccessToken(): string | null {
  return cachedAccessToken;
}

export function getCurrentGoogleUser(): User | null {
  return auth.currentUser;
}

export async function signOutGmail(): Promise<void> {
  await auth.signOut();
  cachedAccessToken = null;
}

function encodeRfc2047Subject(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function toBase64UrlUtf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildReceiptHtml(receipt: OrderReceipt): string {
  const dateStr = new Date(receipt.createdAt).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const rows = receipt.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e7e5e4;font-size:14px;color:#1c1917;">${item.name}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e7e5e4;font-size:14px;color:#57534e;text-align:center;">×${item.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e7e5e4;font-size:14px;font-weight:700;color:#1c1917;text-align:left;">₪${item.price * item.quantity}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<body style="margin:0;padding:24px;background:#faf9f6;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;overflow:hidden;">
    <div style="background:#c2410c;color:#ffffff;padding:20px 24px;">
      <div style="font-size:22px;font-weight:800;">${receipt.storeName}</div>
      <div style="font-size:13px;opacity:0.9;margin-top:4px;">קבלה רשמית · הזמנה #${receipt.id} · ${dateStr}</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;font-size:14px;color:#44403c;">
        שלום <strong>${receipt.customerName}</strong>, תודה שקנית ב<strong>${receipt.storeName}</strong>!
      </p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f5f5f4;color:#78716c;font-size:12px;">
            <th style="padding:8px;text-align:right;">מוצר</th>
            <th style="padding:8px;text-align:center;">כמות</th>
            <th style="padding:8px;text-align:left;">סה״כ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:18px;padding-top:14px;border-top:2px solid #e7e5e4;display:flex;justify-content:space-between;font-size:18px;font-weight:800;color:#1c1917;">
        <span>סה״כ לתשלום: </span>
        <span style="color:#c2410c;">₪${receipt.total}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendReceiptViaGmailApi(receipt: OrderReceipt): Promise<{
  gmailMessageId: string;
}> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('יש להתחבר לחשבון Google / Gmail כדי לשלוח קבלות אמיתיות למייל.');
  }

  const subject = `קבלה מ-${receipt.storeName} — הזמנה #${receipt.id}`;
  const htmlBody = buildReceiptHtml(receipt);
  const mime = [
    `To: ${receipt.customerEmail}`,
    `Subject: ${encodeRfc2047Subject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(
      Array.from(new TextEncoder().encode(htmlBody))
        .map((b) => String.fromCharCode(b))
        .join('')
    ),
  ].join('\r\n');

  const raw = toBase64UrlUtf8(mime);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`שליחת המייל דרך Gmail נכשלה (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { id: string };
  return { gmailMessageId: data.id };
}
