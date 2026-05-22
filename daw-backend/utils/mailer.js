const nodemailer = require("nodemailer");
const Settings = require("../models/Settings");
const path = require("path");

/**
 * UTILITY: Automated Approval Notifier
 * Facilitates multi-state email dispatch for the internal CMS bureaucracy workflow.
 */

// Initialize SMTP transport layer with environment-secured credentials
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT == 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendApprovalNotification = async ({
  toEmail,
  recipientName,
  type,
  draftInfo,
  reason = "",
}) => {
  try {
    // INITIALIZATION
    // Initialize notification context, branding assets, and UI theme constants
    const frontendUrl = process.env.FRONTEND_URL;
    const sender =
      process.env.SYSTEM_EMAIL_FROM || '"DAW Group" <noreply@daw.co.id>';
    const logoPath = path.join(__dirname, "..", "public", "logo-daw.png");
    const logoUrl = "cid:logo-daw";

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

    // REFERENCE GATHERING
    // Map notification metadata and visual themes based on workflow state and urgency
    if (type === "NEW_REQUEST") {
      const isUrgent = draftInfo.action === "DELETE";
      subject = isUrgent
        ? `[URGENT REVIEW] Permintaan Hapus Modul: ${draftInfo.module_name}`
        : `[APPROVAL REQUIRED] Draf Baru Diajukan: ${draftInfo.module_name}`;
      headline = "Dokumen Menunggu Persetujuan";
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

    // EXECUTION
    // Construct responsive executive email template
    // EXECUTION
    // Construct responsive executive email template
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap" rel="stylesheet">
        
        <style>
          /* CSS Reset & Base */
          body, p, h1, h2, h3, td, th { margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          body { background-color: #f8fafc; color: #334155; -webkit-font-smoothing: antialiased; }
          
          /* Layout */
          .email-wrapper { width: 100%; background-color: #f8fafc; padding: 48px 0; }
          .email-card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
          
          /* Branding Header */
          .brand-header { text-align: center; padding: 32px 24px; border-bottom: 1px solid #f1f5f9; background-color: #ffffff; }
          .brand-header img { max-height: 44px; width: auto; }
          
          /* Hero Section */
          .hero-section { background-color: ${bannerBgColor === DANGER_RED ? "#fef2f2" : bannerBgColor === DAW_YELLOW ? "#fffbeb" : "#f0fdf4"}; padding: 40px 32px; text-align: center; border-bottom: 1px solid #f1f5f9; }
          .hero-section h1 { font-family: 'Playfair Display', Georgia, serif; color: ${bannerBgColor === DANGER_RED ? "#991b1b" : bannerBgColor === DAW_YELLOW ? "#92400e" : "#166534"}; font-size: 24px; font-weight: 700; margin-bottom: 8px; line-height: 1.3; }
          .hero-section p { font-size: 13px; color: #64748b; font-weight: 500; }
          
          /* Content Body */
          .content-body { padding: 40px 32px; }
          .greeting { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
          .intro-text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 28px; }
          
          /* Info Card / Metadata Display */
          .info-card { background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 24px; margin-bottom: 28px; }
          .info-card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 1.5px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
          
          .info-row { display: table; width: 100%; margin-bottom: 12px; }
          .info-row:last-child { margin-bottom: 0; }
          .info-label { display: table-cell; width: 35%; font-size: 13px; font-weight: 600; color: #64748b; vertical-align: top; }
          .info-value { display: table-cell; width: 65%; font-size: 13px; font-weight: 700; color: #1e293b; text-align: right; }
          
          .action-badge { 
            display: inline-block; 
            padding: 2px 8px; 
            border-radius: 6px; 
            font-size: 11px; 
            font-weight: 800; 
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background-color: ${draftInfo.action === "DELETE" ? "#fee2e2" : "#e0f2fe"}; 
            color: ${draftInfo.action === "DELETE" ? "#dc2626" : "#0284c7"};
          }
          
          /* Rejection Alert Box */
          .rejection-alert { background-color: #fff5f5; border-left: 4px solid ${DANGER_RED}; padding: 20px; margin-bottom: 28px; border-radius: 8px; border: 1px solid #fee2e2; border-left-width: 4px; }
          .rejection-alert h3 { font-size: 12px; text-transform: uppercase; color: #991b1b; margin-bottom: 6px; letter-spacing: 1px; font-weight: 800; }
          .rejection-alert p { font-size: 13px; color: #b91c1c; font-style: italic; line-height: 1.6; }
          
          /* Call to Action Button */
          .cta-wrapper { text-align: center; margin: 36px 0 20px 0; }
          .cta-btn { 
            display: inline-block; 
            background-color: ${bannerBgColor === DANGER_RED ? DANGER_RED : bannerBgColor === DAW_YELLOW ? DAW_YELLOW : DAW_GREEN}; 
            color: #ffffff; 
            text-decoration: none; 
            padding: 16px 40px; 
            border-radius: 10px; 
            font-size: 14px; 
            font-weight: 700; 
            letter-spacing: 0.5px; 
            box-shadow: 0 4px 14px 0 ${bannerBgColor === DANGER_RED ? "rgba(220, 38, 38, 0.2)" : bannerBgColor === DAW_YELLOW ? "rgba(226, 149, 4, 0.2)" : "rgba(0, 75, 35, 0.2)"};
            transition: all 0.3s ease;
          }
          
          /* Footer */
          .footer-section { background-color: #ffffff; padding: 36px 32px; text-align: center; border-top: 1px solid #f1f5f9; }
          .footer-section p { font-size: 12px; color: #94a3b8; line-height: 1.6; margin-bottom: 12px; }
          .footer-section p strong { color: #64748b; }
          .confidential-notice { font-size: 10px; color: #cbd5e1; text-align: justify; margin-top: 24px; border-top: 1px dashed #e2e8f0; padding-top: 16px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-card">
            
            <!-- Logo Section -->
            <div class="brand-header">
              <img src="${logoUrl}" alt="DAW Group Logo" />
            </div>

            <!-- Dynamic Executive Header -->
            <div class="hero-section">
              <h1>${headline}</h1>
              <p>ID Transaksi: <span style="font-family: monospace; font-weight: bold;">${draftInfo.notrans}</span></p>
            </div>

            <!-- Email Body -->
            <div class="content-body">
              <p class="greeting">Yth. ${recipientName},</p>
              <p class="intro-text">
                Notifikasi ini dikirim secara otomatis oleh sistem <strong>DAW CMS Workflow</strong> untuk mengabarkan bahwa terdapat pembaruan data yang memerlukan perhatian, peninjauan, atau tindakan langsung dari pihak Anda.
              </p>
              
              <!-- Info Card -->
              <div class="info-card">
                <div class="info-card-title">Ringkasan Pengajuan</div>
                
                <div class="info-row">
                  <span class="info-label">Status Tiket</span>
                  <span class="info-value">${statusPillHtml}</span>
                </div>
                
                <div class="info-row">
                  <span class="info-label">Konteks Modul</span>
                  <span class="info-value" style="color: #0f172a;">${draftInfo.module_name}</span>
                </div>
                
                <div class="info-row">
                  <span class="info-label">Jenis Tindakan</span>
                  <span class="info-value"><span class="action-badge">${draftInfo.action}</span></span>
                </div>
                
                <div class="info-row">
                  <span class="info-label">Diajukan Oleh</span>
                  <span class="info-value" style="color: #0f172a;">${draftInfo.created_by}</span>
                </div>
              </div>

              <!-- Conditional Rejection Box -->
              ${
                type === "REJECTED"
                  ? `
              <div class="rejection-alert">
                <h3>Alasan Penolakan / Catatan Revisi</h3>
                <p>"${reason}"</p>
              </div>
              `
                  : ""
              }

              <!-- Call to Action -->
              <div class="cta-wrapper">
                <a href="${actionUrl}" target="_blank" class="cta-btn">${actionText}</a>
              </div>
              
              <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 24px; line-height: 1.5;">
                Jika tombol di atas tidak berfungsi secara langsung, Anda dapat menyalin tautan berikut ke browser:<br/>
                <a href="${actionUrl}" style="color: ${DAW_GREEN}; text-decoration: underline; word-break: break-all; font-weight: 500;">${actionUrl}</a>
              </p>
            </div>
            
            <!-- Branded Footer -->
            <div class="footer-section">
              <p><strong>DAW Group Management System</strong><br/>
              Ini adalah email otomatis dari sistem administrasi DAW Group. Mohon untuk tidak membalas email ini.</p>
              
              <div class="confidential-notice">
                <strong>PEMBERITAHUAN KERAHASIAAN:</strong> Surat elektronik ini beserta lampirannya bersifat sangat rahasia dan dilindungi secara hukum. Jika Anda bukan penerima yang dituju, harap segera menghapus salinan ini dan memberitahu pengirim. Segala bentuk penyalinan, penyebarluasan, atau penggunaan tanpa izin tertulis dari DAW Group Management dilarang keras.
              </div>
            </div>

          </div>
        </div>
      </body>
      </html>
    `;

    // Execute asynchronous mail dispatch with embedded branding assets
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
