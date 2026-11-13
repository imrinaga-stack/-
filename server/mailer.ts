import nodemailer from 'nodemailer';
import type { OrderReceipt } from '../src/types';

export function isServerMailerConfigured(): boolean {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  return Boolean(user && pass);
}

export function buildReceiptEmailHtml(receipt: OrderReceipt): string {
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
      <div style="margin-top:18px;padding-top:14px;border-top:2px solid #e7e5e4;font-size:18px;font-weight:800;color:#1c1917;">
        <span>סה״כ לתשלום: </span>
        <span style="color:#c2410c;">₪${receipt.total}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendServerReceiptEmail(
  receipt: OrderReceipt
): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);

  if (!user || !pass) {
    return { sent: false };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: `"${receipt.storeName}" <${user}>`,
      to: receipt.customerEmail,
      subject: `קבלה מ-${receipt.storeName} — הזמנה #${receipt.id}`,
      html: buildReceiptEmailHtml(receipt),
    });

    return { sent: true, messageId: info.messageId };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : 'SMTP error',
    };
  }
}
