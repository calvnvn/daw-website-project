const nodemailer = require("nodemailer");
const Settings = require("../models/Settings");
const path = require("path");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT == 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Fungsi cerdas untuk mengirim notifikasi persetujuan birokrasi.
 * @param {Object} params
 * @param {string} params.toEmail - Email penerima.
 * @param {string} params.recipientName - Nama panggilan penerima (Biar sopan).
 * @param {string} params.type - 'NEW_REQUEST' | 'REJECTED' | 'APPROVED'
 * @param {Object} params.draftInfo - Data draf (notrans, module_name, action, created_by).
 * @param {string} params.reason - (Opsional) Alasan penolakan.
 */
const sendApprovalNotification = async ({
  toEmail,
  recipientName,
  type,
  draftInfo,
  reason = "",
}) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const sender =
      process.env.SYSTEM_EMAIL_FROM || '"DAW Group" <noreply@daw.co.id>';

    const logoPath = path.join(__dirname, "..", "public", "logo-daw.png");
    const logoUrl = "cid:logo-daw";

    // 🎨 Identitas Warna DAW Group
    const DAW_GREEN = "#004b23";
    const DAW_YELLOW = "#e29504";
    const DAW_GREEN_HOVER = "#003619";
    const DANGER_RED = "#dc2626";

    let subject = "";
    let headline = "";
    let bannerBgColor = DAW_GREEN;
    let bannerTextColor = "#ffffff";
    let actionText = "Buka Approval Center";
    let actionUrl = `${frontendUrl}/admin/approvals?ticket=${draftInfo.notrans}`;
    let statusPillHtml = "";

    // 🧠 LOGIKA TEMA & SUBJEK (Executive Mapping)
    if (type === "NEW_REQUEST") {
      const isUrgent = draftInfo.action === "DELETE";
      subject = isUrgent
        ? `[URGENT REVIEW] Permintaan Hapus Modul: ${draftInfo.module_name}`
        : `[APPROVAL REQUIRED] Draf Baru Diajukan: ${draftInfo.module_name}`;
      headline = "Dokumen Menunggu Persetujuan";

      // Tema Kuning DAW untuk Urgent/Delete (Teks hijau gelap biar elegan & kontras)
      bannerBgColor = isUrgent ? DAW_YELLOW : DAW_GREEN;
      bannerTextColor = isUrgent ? DAW_GREEN_HOVER : "#ffffff";
      actionText = "Tinjau Dokumen Sekarang";

      statusPillHtml = `<span style="background-color: ${isUrgent ? "#fef3c7" : "#dcfce7"}; color: ${isUrgent ? "#b45309" : "#166534"}; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; letter-spacing: 1px;">ACTION REQUIRED</span>`;
    } else if (type === "REJECTED") {
      subject = `[REVISION REQUIRED] Draf Ditolak: ${draftInfo.module_name} (${draftInfo.notrans})`;
      headline = "Pemberitahuan Penolakan Draf";
      bannerBgColor = DANGER_RED;
      bannerTextColor = "#ffffff";
      actionText = "Buka & Perbaiki Draf";
      statusPillHtml = `<span style="background-color: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; letter-spacing: 1px;">REJECTED</span>`;
    } else if (type === "APPROVED") {
      subject = `[APPROVED] Draf Telah Tayang: ${draftInfo.module_name}`;
      headline = "Publikasi Berhasil";
      bannerBgColor = DAW_GREEN;
      bannerTextColor = "#ffffff";
      actionUrl = `${frontendUrl}/admin/approvals`;
      statusPillHtml = `<span style="background-color: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; letter-spacing: 1px;">PUBLISHED</span>`;
    }

    // 🏛️ THE EXECUTIVE HTML TEMPLATE
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,600;0,700;1,400&display=swap" rel="stylesheet">
        
        <style>
          /* CSS Reset & Base */
          body, p, h1, h2, h3, td, th { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          body { background-color: #f1f5f9; color: #334155; -webkit-font-smoothing: antialiased; }
          
          /* Layout */
          .email-wrapper { width: 100%; background-color: #f1f5f9; padding: 40px 0; }
          .email-card { max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
          
          /* Logo Area (White Background) */
          .logo-area { text-align: center; padding: 30px 20px; border-bottom: 1px solid #f1f5f9; }
          .logo-area img { max-height: 48px; width: auto; }
          
          /* Dynamic Banner (Lora Serif Font for Authority) */
          .hero-banner { background-color: ${bannerBgColor}; padding: 35px 40px; text-align: center; }
          .hero-banner h1 { font-family: 'Lora', Georgia, serif; color: ${bannerTextColor}; font-size: 26px; font-weight: 700; margin: 0; letter-spacing: -0.5px; line-height: 1.3; }
          
          /* Content Body */
          .content-body { padding: 40px; }
          .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 8px; }
          .intro-text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 30px; }
          
          /* Formal Ticket Table */
          .ticket-table-wrapper { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 30px; }
          .ticket-table { width: 100%; border-collapse: collapse; text-align: left; }
          .ticket-table th { background-color: #f8fafc; padding: 12px 20px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; width: 35%; border-right: 1px solid #e2e8f0;}
          .ticket-table td { padding: 12px 20px; font-size: 14px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
          .ticket-table tr:last-child th, .ticket-table tr:last-child td { border-bottom: none; }
          
          .action-highlight { color: ${draftInfo.action === "DELETE" ? DANGER_RED : DAW_GREEN}; }
          
          /* Rejection Box */
          .rejection-box { background-color: #fff1f2; border-left: 4px solid ${DANGER_RED}; padding: 20px; margin-bottom: 30px; border-radius: 0 8px 8px 0; }
          .rejection-box h3 { font-size: 12px; text-transform: uppercase; color: #9f1239; margin-bottom: 8px; letter-spacing: 1px; }
          .rejection-box p { font-size: 14px; color: #be123c; font-style: italic; line-height: 1.5; }
          
          /* Call to Action */
          .cta-container { text-align: center; margin: 40px 0 20px 0; }
          .cta-button { display: inline-block; background-color: ${DAW_GREEN}; color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 6px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px; transition: background-color 0.2s; }
          
          /* Footer */
          .footer { background-color: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 10px; }
          .footer .confidentiality { font-size: 10px; color: #94a3b8; text-align: justify; margin-top: 20px; border-top: 1px dotted #cbd5e1; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-card">
            
            <div class="logo-area">
              <img src="${logoUrl}" alt="DAW Group Logo" />
            </div>

            <div class="hero-banner">
              <h1>${headline}</h1>
            </div>

            <div class="content-body">
              <p class="greeting">Yth. ${recipientName},</p>
              <p class="intro-text">
                Pesan ini dihasilkan secara otomatis oleh sistem <strong>DAW CMS Workflow</strong>. Terdapat aktivitas baru yang memerlukan perhatian atau tindak lanjut dari Anda.
              </p>
              
              <div class="ticket-table-wrapper">
                <table class="ticket-table">
                  <tr>
                    <th>Status Tiket</th>
                    <td>${statusPillHtml}</td>
                  </tr>
                  <tr>
                    <th>Nomor Referensi</th>
                    <td style="font-family: monospace; letter-spacing: 0.5px;">${draftInfo.notrans}</td>
                  </tr>
                  <tr>
                    <th>Konteks Modul</th>
                    <td>${draftInfo.module_name}</td>
                  </tr>
                  <tr>
                    <th>Jenis Aksi</th>
                    <td class="action-highlight">${draftInfo.action}</td>
                  </tr>
                  <tr>
                    <th>Diajukan Oleh</th>
                    <td>${draftInfo.created_by}</td>
                  </tr>
                </table>
              </div>

              ${
                type === "REJECTED"
                  ? `
              <div class="rejection-box">
                <h3>Catatan Editor / Approver</h3>
                <p>"${reason}"</p>
              </div>
              `
                  : ""
              }

              <div class="cta-container">
                <a href="${actionUrl}" target="_blank" class="cta-button">${actionText}</a>
              </div>
              
              <p style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 20px;">
                Jika tombol di atas tidak berfungsi, salin tautan berikut ke browser Anda:<br/>
                <a href="${actionUrl}" style="color: ${DAW_GREEN}; text-decoration: underline; word-break: break-all;">${actionUrl}</a>
              </p>
            </div>
            
            <div class="footer">
              <p><strong>DAW Group Management System</strong><br/>
              Ini adalah email notifikasi otomatis. Mohon tidak membalas ke alamat email ini.</p>
              
              <div class="confidentiality">
                <strong>CONFIDENTIALITY NOTICE:</strong> This email and any attachments are confidential and may also be privileged. If you are not the intended recipient, please delete all copies and notify the sender immediately. You should not copy or use it for any purpose, nor disclose its contents to any other person without proper authorization from DAW Group Management.
              </div>
            </div>

          </div>
        </div>
      </body>
      </html>
    `;

    // Eksekusi Pengiriman
    await transporter.sendMail({
      from: sender,
      to: toEmail,
      subject: subject,
      html: htmlTemplate,
      attachments: [
        {
          filename: "logo-daw.png",
          path: logoPath,
          cid: "logo-daw",
        },
      ],
    });

    console.log(`✉️ [SUCCESS] Notifikasi terkirim ke: ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`🚨 [MAILER ERROR]:`, error.message);
    return false;
  }
};

module.exports = {
  transporter,
  sendApprovalNotification,
};
