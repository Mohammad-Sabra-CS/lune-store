import type { OrderInput } from "@/lib/orders";

const strings = {
  en: {
    subject: (n: string) => `Your Lune order ${n}`,
    title: "Thank you for your order",
    intro: "We have received your order and will contact you to confirm delivery.",
    deliveryNote: "Your order will be delivered within 2 days.",
    orderNumber: "Order number",
    item: "Item",
    qty: "Qty",
    price: "Price",
    subtotal: "Subtotal",
    delivery: "Delivery",
    total: "Total",
    deliverTo: "Deliver to",
    payment: "Payment method",
    cod: "Cash on Delivery",
    card: "Visa / Card",
    currency: "JD",
    motto: "Your Presence Is Complete With Love",
    dir: "ltr" as const,
    align: "left" as const,
  },
  ar: {
    subject: (n: string) => `طلبك من Lune ${n}`,
    title: "شكرًا لطلبك",
    intro: "استلمنا طلبك بنجاح وسنتواصل معك لتأكيد التوصيل.",
    deliveryNote: "سيصل طلبك خلال يومين.",
    orderNumber: "رقم الطلب",
    item: "المنتج",
    qty: "الكمية",
    price: "السعر",
    subtotal: "المجموع الفرعي",
    delivery: "التوصيل",
    total: "الإجمالي",
    deliverTo: "التوصيل إلى",
    payment: "طريقة الدفع",
    cod: "الدفع عند الاستلام",
    card: "فيزا / بطاقة",
    currency: "د.أ",
    motto: "حضورك يكتمل بالحب",
    dir: "rtl" as const,
    align: "right" as const,
  },
};

export function buildReceiptHtml(order: OrderInput): {
  subject: string;
  html: string;
} {
  const t = strings[order.locale];
  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee6d4;color:#101321;">${item.name}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee6d4;text-align:center;color:#101321;">${item.qty}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee6d4;text-align:${t.dir === "rtl" ? "left" : "right"};color:#101321;">${item.price * item.qty} ${t.currency}</td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="${order.locale}" dir="${t.dir}">
<body style="margin:0;padding:0;background:#f5f1e8;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#101321;padding:32px;text-align:center;">
      <p style="margin:0;color:#c9a96a;font-size:26px;letter-spacing:6px;text-transform:uppercase;">Lune</p>
      <p style="margin:8px 0 0;color:#f3eddf99;font-size:12px;letter-spacing:2px;">${t.motto}</p>
    </div>
    <div style="background:#fbf8f1;padding:32px;text-align:${t.align};">
      <h1 style="margin:0 0 8px;color:#101321;font-size:22px;font-weight:normal;">${t.title}</h1>
      <p style="margin:0 0 12px;color:#6b6553;font-size:14px;line-height:1.6;">${t.intro}</p>
      <p style="margin:0 0 20px;padding:10px 14px;background:#c9a96a1f;border-${t.dir === "rtl" ? "right" : "left"}:3px solid #c9a96a;color:#101321;font-size:14px;">${t.deliveryNote}</p>
      <p style="margin:0 0 24px;color:#101321;font-size:14px;">
        <strong>${t.orderNumber}:</strong>
        <span style="color:#c9a96a;letter-spacing:1px;" dir="ltr">${order.orderNumber}</span>
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;" dir="${t.dir}">
        <thead>
          <tr>
            <th style="text-align:${t.align};padding-bottom:8px;border-bottom:2px solid #101321;color:#101321;font-weight:normal;font-size:12px;text-transform:uppercase;letter-spacing:1px;">${t.item}</th>
            <th style="text-align:center;padding-bottom:8px;border-bottom:2px solid #101321;color:#101321;font-weight:normal;font-size:12px;text-transform:uppercase;letter-spacing:1px;">${t.qty}</th>
            <th style="text-align:${t.dir === "rtl" ? "left" : "right"};padding-bottom:8px;border-bottom:2px solid #101321;color:#101321;font-weight:normal;font-size:12px;text-transform:uppercase;letter-spacing:1px;">${t.price}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;" dir="${t.dir}">
        <tr>
          <td style="padding:4px 0;color:#6b6553;">${t.subtotal}</td>
          <td style="padding:4px 0;text-align:${t.dir === "rtl" ? "left" : "right"};color:#101321;">${order.subtotal} ${t.currency}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b6553;">${t.delivery}</td>
          <td style="padding:4px 0;text-align:${t.dir === "rtl" ? "left" : "right"};color:#101321;">${order.deliveryFee} ${t.currency}</td>
        </tr>
        <tr>
          <td style="padding:12px 0 0;color:#101321;font-size:16px;"><strong>${t.total}</strong></td>
          <td style="padding:12px 0 0;text-align:${t.dir === "rtl" ? "left" : "right"};color:#101321;font-size:16px;"><strong>${order.total} ${t.currency}</strong></td>
        </tr>
      </table>
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #eee6d4;font-size:13px;color:#6b6553;line-height:1.7;">
        <p style="margin:0;"><strong style="color:#101321;">${t.deliverTo}:</strong> ${order.customerName} — ${order.city}, ${order.address}</p>
        <p style="margin:6px 0 0;"><strong style="color:#101321;">${t.payment}:</strong> ${order.paymentMethod === "cod" ? t.cod : t.card}</p>
      </div>
    </div>
    <p style="text-align:center;color:#6b655388;font-size:11px;letter-spacing:2px;margin:20px 0 0;">LUNE — LUNAR ALLURE</p>
  </div>
</body>
</html>`;

  return { subject: t.subject(order.orderNumber), html };
}

/**
 * Sends the receipt. Never throws — an email failure must not fail the order.
 * Without RESEND_API_KEY (local dev), logs instead of sending.
 */
export async function sendReceiptEmail(order: OrderInput): Promise<void> {
  const { subject, html } = buildReceiptHtml(order);
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `[email] RESEND_API_KEY not set — receipt for ${order.orderNumber} to ${order.email} not sent (subject: "${subject}")`,
    );
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const from = process.env.EMAIL_FROM ?? "Lune <onboarding@resend.dev>";
    const { error } = await resend.emails.send({
      from,
      to: order.email,
      subject,
      html,
    });
    if (error) {
      console.error(`[email] failed for ${order.orderNumber}:`, error);
    }
  } catch (err) {
    console.error(`[email] failed for ${order.orderNumber}:`, err);
  }
}
