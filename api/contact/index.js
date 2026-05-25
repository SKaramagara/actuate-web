const { EmailClient }  = require("@azure/communication-email");
const { TableClient }  = require("@azure/data-tables");

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://actuate.com.tr";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

module.exports = async function (context, req) {

  // ── OPTIONS preflight ──────────────────────────────────────
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: CORS_HEADERS };
    return;
  }

  // ── Validation ─────────────────────────────────────────────
  const b = req.body || {};
  const missing = ["firstName","lastName","email","message"].filter(k => !b[k]?.trim());
  if (missing.length) {
    context.res = {
      status: 400,
      headers: CORS_HEADERS,
      body: { error: "Missing required fields", fields: missing }
    };
    return;
  }

  // E-posta format kontrolü (basit)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) {
    context.res = {
      status: 400,
      headers: CORS_HEADERS,
      body: { error: "Invalid email format" }
    };
    return;
  }

  const rowKey = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

  // ── Table Storage: kayıt ──────────────────────────────────
  try {
    const tableClient = TableClient.fromConnectionString(
      process.env.STORAGE_CONNECTION_STRING,
      "ContactSubmissions"
    );
    // Tablo yoksa oluştur (ilk çalıştırmada)
    try { await tableClient.createTable(); } catch (_) {}

    await tableClient.upsertEntity({
      partitionKey: "contact",
      rowKey,
      firstName:  b.firstName.trim(),
      lastName:   b.lastName.trim(),
      email:      b.email.trim().toLowerCase(),
      company:    (b.company  || "").trim(),
      sector:     (b.sector   || "Not specified").trim(),
      message:    b.message.trim(),
      timestamp:  b.timestamp || new Date().toISOString(),
      userAgent:  req.headers?.["user-agent"]?.slice(0, 200) || "",
    });
  } catch (err) {
    context.log.error("Table Storage error:", err.message);
    // Storage hatası kritik değil — email yine de gönderilsin
  }

  // ── Email bildirimi ──────────────────────────────────────
  try {
    const emailClient = new EmailClient(process.env.ACS_CONNECTION_STRING);

    const poller = await emailClient.beginSend({
      senderAddress: "donotreply@actuate.com.tr",
      recipients: {
        to: [{ address: "info@actuate.com.tr", displayName: "Actuate" }]
      },
      content: {
        subject: `[actuate.com.tr] ${b.firstName} ${b.lastName} — ${b.sector || "—"}`,
        plainText: [
          `Ad Soyad  : ${b.firstName} ${b.lastName}`,
          `E-posta   : ${b.email}`,
          `Şirket    : ${b.company  || "—"}`,
          `Sektör    : ${b.sector   || "—"}`,
          `Mesaj     :\n\n${b.message}`,
          ``,
          `Zaman     : ${b.timestamp || new Date().toISOString()}`,
          `Kayıt ID  : ${rowKey}`,
        ].join("\n"),
        html: `
<div style="font-family:sans-serif;max-width:600px">
  <h2 style="color:#440099;border-bottom:2px solid #440099;padding-bottom:8px">
    Yeni İletişim Formu
  </h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:6px 0;color:#666;width:110px">Ad Soyad</td>
        <td style="padding:6px 0;font-weight:600">${esc(b.firstName)} ${esc(b.lastName)}</td></tr>
    <tr><td style="padding:6px 0;color:#666">E-posta</td>
        <td style="padding:6px 0"><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></td></tr>
    <tr><td style="padding:6px 0;color:#666">Şirket</td>
        <td style="padding:6px 0">${esc(b.company) || "—"}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Sektör</td>
        <td style="padding:6px 0">${esc(b.sector) || "—"}</td></tr>
  </table>
  <div style="margin-top:16px;padding:16px;background:#f8f6ff;border-left:3px solid #440099;border-radius:4px">
    <div style="color:#666;font-size:12px;margin-bottom:6px">MESAJ</div>
    <div style="white-space:pre-wrap">${esc(b.message)}</div>
  </div>
  <div style="margin-top:12px;font-size:11px;color:#aaa">
    ${b.timestamp || new Date().toISOString()} · ID: ${rowKey}
  </div>
</div>`
      }
    });

    // ACS async — en fazla 30 sn bekle
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const result = await poller.poll();
      if (poller.isDone()) break;
      await new Promise(r => setTimeout(r, 1000));
    }

  } catch (err) {
    context.log.error("Email send error:", err.message);
    // Email hatası kullanıcıya 500 döndürmez — form kaydedildi, yeter
  }

  context.res = {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: { ok: true, id: rowKey }
  };
};

function esc(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
