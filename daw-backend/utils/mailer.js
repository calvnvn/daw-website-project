const nodemailer = require("nodemailer");
const Settings = require("../models/Settings");
const path = require("path");

// Helper to extract display name from SYSTEM_EMAIL_FROM configuration
const getSenderName = (emailFrom) => {
  if (!emailFrom) return "DAW Admin System";
  const match = emailFrom.match(/^(?:"?([^"<]+)"?\s)?<([^>]+)>$/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return emailFrom.split("<")[0].trim() || "DAW Admin System";
};

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

const sendMailWithRetry = async (mailOptions, retries = 2, delay = 1500) => {
  if (process.env.DISABLE_EMAIL === "true") {
    console.log(`🔕 [MAILER BYPASS] Pengiriman email ke ${mailOptions.to} disimulasikan (DISABLE_EMAIL=true).`);
    return { messageId: "simulated-id" };
  }

  for (let i = 0; i <= retries; i++) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`⚠️ [MAILER WARNING] Gagal mengirim email (Percobaan ${i + 1}/${retries + 1}): ${err.message}. Mencoba kembali dalam ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

const sendApprovalNotification = async ({
  toEmail,
  recipientName,
  type,
  draftInfo,
  reason = "",
}) => {
  try {
    // INITIALIZATION
    // Mengamankan email header agar terhindar dari warning "via" atau "on behalf of"
    const backendUrl = process.env.BACKEND_URL || "http://localhost:5550";
    const frontendUrl = process.env.FRONTEND_URL;
    const senderName = getSenderName(process.env.SYSTEM_EMAIL_FROM);
    const sender = `"${senderName}" <${process.env.SMTP_USER}>`;
    
    // Menggunakan static public URL, namun jika di localhost kita fallback ke CID agar tidak broken saat dev/testing
    const isLocalhost = backendUrl.includes("localhost") || backendUrl.includes("127.0.0.1");
    const logoUrl = isLocalhost ? "cid:logo-daw" : `${backendUrl}/logo-daw.png`;

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
    // Memetakan gaya UI berdasarkan tipe notifikasi (Semi Casual / Professional Tone)
    if (type === "NEW_REQUEST") {
      const isUrgent = draftInfo.action === "DELETE";
      subject = isUrgent
        ? `[Urgent] Permintaan Hapus Modul: ${draftInfo.module_name}`
        : `[Action Required] Draf Baru Diajukan: ${draftInfo.module_name}`;
      headline = "Dokumen Butuh Approval Anda";
      bannerBgColor = isUrgent ? DAW_YELLOW : DAW_GREEN;
      bannerTextColor = isUrgent ? DAW_GREEN_HOVER : "#ffffff";
      actionText = "Review Dokumen Sekarang";
      statusPillHtml = `<span style="background-color: ${isUrgent ? "#fef3c7" : "#dcfce7"}; color: ${isUrgent ? "#b45309" : "#166534"}; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; letter-spacing: 1px;">ACTION REQUIRED</span>`;
    } else if (type === "REJECTED") {
      subject = `[Revise Please] Draf Ditolak: ${draftInfo.module_name} (${draftInfo.notrans})`;
      headline = "Draf Butuh Revisi";
      bannerBgColor = DANGER_RED;
      bannerTextColor = "#ffffff";
      actionText = "Buka & Perbaiki Draf";
      statusPillHtml = `<span style="background-color: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; letter-spacing: 1px;">REJECTED</span>`;
    } else if (type === "APPROVED") {
      subject = `[Live Now] Draf Telah Tayang: ${draftInfo.module_name}`;
      headline = "Konten Berhasil Di-publish!";
      bannerBgColor = DAW_GREEN;
      bannerTextColor = "#ffffff";
      actionUrl = `${frontendUrl}/admin/approvals`;
      statusPillHtml = `<span style="background-color: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; letter-spacing: 1px;">PUBLISHED</span>`;
    }

    // EXECUTION
    // Construct responsive executive email template following Golden Rules
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400..700;1,400..700&display=swap" rel="stylesheet">
        
        <style>
          /* CSS Reset & Base */
          body, p, h1, h2, h3, td, th { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          body { background-color: #f8fafc; color: #334155; -webkit-font-smoothing: antialiased; }
          
          /* Layout */
          .email-wrapper { width: 100%; background-color: #f8fafc; padding: 48px 0; }
          .email-card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
          
          /* Branding Header */
          .brand-header { text-align: center; padding: 32px 24px; border-bottom: 1px solid #f1f5f9; background-color: #ffffff; }
          .brand-header img { max-height: 44px; width: auto; }
          
          /* Hero Section */
          .hero-section { background-color: ${bannerBgColor === DANGER_RED ? "#fef2f2" : bannerBgColor === DAW_YELLOW ? "#fffbeb" : "#f0fdf4"}; padding: 40px 32px; text-align: center; border-bottom: 1px solid #f1f5f9; }
          .hero-section h1 { font-family: 'Lora', Georgia, serif; color: ${bannerBgColor === DANGER_RED ? "#991b1b" : bannerBgColor === DAW_YELLOW ? "#92400e" : "#166534"}; font-size: 24px; font-weight: 700; margin-bottom: 8px; line-height: 1.3; }
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
              <p>ID Tiket: <span style="font-family: monospace; font-weight: bold;">${draftInfo.notrans}</span></p>
            </div>

            <!-- Email Body -->
            <div class="content-body">
              <p class="greeting">Halo ${recipientName},</p>
              <p class="intro-text">
                Ada update terbaru nih di sistem <strong>DAW CMS</strong> yang butuh perhatian dan <i>review</i> langsung dari Anda. Yuk, kita pastikan semuanya sudah sesuai sebelum lanjut ke tahap berikutnya!
              </p>
              
              <!-- Info Card -->
              <div class="info-card">
                <div class="info-card-title">Detail Pengajuan</div>
                
                <div class="info-row">
                  <span class="info-label">Status Tiket</span>
                  <span class="info-value">${statusPillHtml}</span>
                </div>
                
                <div class="info-row">
                  <span class="info-label">Bagian / Modul</span>
                  <span class="info-value" style="color: #0f172a;">${draftInfo.module_name}</span>
                </div>
                
                <div class="info-row">
                  <span class="info-label">Jenis Update</span>
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
                <h3>Catatan Revisi dari Approver</h3>
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
                Kalau tombol di atas tidak bisa di-klik, copy dan paste link ini ke browser Anda ya:<br/>
                <a href="${actionUrl}" style="color: ${DAW_GREEN}; text-decoration: underline; word-break: break-all; font-weight: 500;">${actionUrl}</a>
              </p>
            </div>
            
            <!-- Branded Footer -->
            <div class="footer-section">
              <p><strong>DAW Group Management System</strong><br/>
              Email ini dikirim otomatis oleh sistem DAW Group. Tolong jangan reply langsung ke email ini ya.</p>
              
              <div class="confidential-notice">
                <strong>PEMBERITAHUAN KERAHASIAAN:</strong> Email ini beserta isinya bersifat rahasia dan dilindungi secara hukum. Jika Anda merasa salah menerima email ini, mohon segera dihapus dan beritahu kami. Dilarang menyalin atau menyebarkan isinya tanpa izin dari DAW Group Management.
              </div>
            </div>

          </div>
        </div>
      </body>
      </html>
    `;

    // EMAIL TRAP/INTERCEPTOR FOR TESTING
    let recipient = toEmail;
    if (process.env.EMAIL_TRAP) {
      recipient = process.env.EMAIL_TRAP;
      subject = `[TRAP -> ${toEmail}] ${subject}`;
    }

    // Execute asynchronous mail dispatch
    const mailAttachments = [];
    if (isLocalhost) {
      mailAttachments.push({
        filename: "logo-daw.png",
        path: path.join(__dirname, "..", "public", "logo-daw.png"),
        cid: "logo-daw",
      });
    }

    await sendMailWithRetry({
      from: sender,
      to: recipient,
      subject: subject,
      html: htmlTemplate,
      attachments: mailAttachments.length ? mailAttachments : undefined,
    });

    console.log(`✉️ [SUCCESS] Notifikasi terkirim ke: ${toEmail} | Tipe: ${type} | Tiket: ${draftInfo.notrans}`);
    return true;
  } catch (error) {
    console.error(`🚨 [MAILER ERROR]:`, error.message);
    return false;
  }
};

const sendInquiryNotification = async ({
  targetEmail,
  name,
  email,
  phone,
  company,
  subject,
  message,
  activeSubjectName,
  logoUrl = null,
  companyName = "DAW Group",
}) => {
  try {
    // Memperbaiki issue pengirim (Postman spoofing warning)
    const backendUrl = process.env.BACKEND_URL || "http://localhost:5550";
    const senderName = getSenderName(process.env.SYSTEM_EMAIL_FROM || "DAW Website Portal");
    const sender = `"${senderName}" <${process.env.SMTP_USER}>`;
    
    // Choose logo source (Dynamic from settings or Static URL)
    const isLocalhost = backendUrl.includes("localhost") || backendUrl.includes("127.0.0.1");
    const logoSrc = logoUrl || (isLocalhost ? "cid:logo-daw" : `${backendUrl}/logo-daw.png`);

    const DAW_GREEN = "#004b23";
    const DAW_YELLOW = "#e29504";

    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400..700;1,400..700&display=swap" rel="stylesheet">
        
        <style>
          /* CSS Reset & Base */
          body, p, h1, h2, h3, td, th { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          body { background-color: #f8fafc; color: #334155; -webkit-font-smoothing: antialiased; }
          
          /* Layout */
          .email-wrapper { width: 100%; background-color: #f8fafc; padding: 48px 0; }
          .email-card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
          
          /* Branding Header */
          .brand-header { text-align: center; padding: 32px 24px; border-bottom: 1px solid #f1f5f9; background-color: #ffffff; }
          .brand-header img { max-height: 44px; width: auto; }
          
          /* Hero Section */
          .hero-section { background-color: #f0fdf4; padding: 40px 32px; text-align: center; border-bottom: 1px solid #f1f5f9; }
          .hero-section h1 { font-family: 'Lora', Georgia, serif; color: ${DAW_GREEN}; font-size: 24px; font-weight: 700; margin-bottom: 8px; line-height: 1.3; }
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
          
          /* Message Content Block */
          .message-block { background-color: #081C15; background: linear-gradient(to right, #081C15, #0a2d22); padding: 24px; border-radius: 12px; color: #ffffff; margin-bottom: 28px; }
          .message-title { margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: ${DAW_YELLOW}; font-weight: 800; }
          .message-text { margin: 0; font-size: 15px; line-height: 1.7; white-space: pre-wrap; color: #f1f5f9; }
          
          /* Call to Action Button */
          .cta-wrapper { text-align: center; margin: 36px 0 20px 0; }
          .cta-btn { 
            display: inline-block; 
            background-color: ${DAW_GREEN}; 
            color: #ffffff; 
            text-decoration: none; 
            padding: 16px 40px; 
            border-radius: 10px; 
            font-size: 14px; 
            font-weight: 700; 
            letter-spacing: 0.5px; 
            box-shadow: 0 4px 14px 0 rgba(0, 75, 35, 0.2);
            transition: all 0.3s ease;
          }
          
          /* Footer */
          .footer-section { background-color: #ffffff; padding: 36px 32px; text-align: center; border-top: 1px solid #f1f5f9; }
          .footer-section p { font-size: 12px; color: #94a3b8; line-height: 1.6; margin-bottom: 12px; }
          .footer-section p strong { color: #64748b; }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-card">
            
            <!-- Logo Section -->
            <div class="brand-header">
              <img src="${logoSrc}" alt="${companyName} Logo" />
            </div>

            <!-- Header -->
            <div class="hero-section">
              <h1>New Contact Inquiry</h1>
              <p>Subjek Pesan: <strong>${subject}</strong></p>
            </div>

            <!-- Email Body -->
            <div class="content-body">
              <p class="greeting">Halo Tim ${activeSubjectName},</p>
              <p class="intro-text">
                Ada pesan baru masuk nih dari pengunjung website <strong>${companyName}</strong>. Berikut detail pengirimnya yang bisa Anda cek:
              </p>
              
              <!-- Info Card -->
              <div class="info-card">
                <div class="info-card-title">Informasi Pengirim</div>
                
                <div class="info-row">
                  <span class="info-label">Nama Lengkap</span>
                  <span class="info-value">${name}</span>
                </div>
                
                <div class="info-row">
                  <span class="info-label">Alamat Email</span>
                  <span class="info-value" style="color: ${DAW_GREEN};">${email}</span>
                </div>
                
                <div class="info-row">
                  <span class="info-label">Nomor Telepon</span>
                  <span class="info-value">${phone || "-"}</span>
                </div>

                <div class="info-row">
                  <span class="info-label">Perusahaan</span>
                  <span class="info-value">${company || "-"}</span>
                </div>
              </div>

              <!-- Message Content Block -->
              <div class="message-block">
                <div class="message-title">Isi Pesan:</div>
                <p class="message-text">${message}</p>
              </div>

              <!-- Call to Action -->
              <div class="cta-wrapper">
                <a href="mailto:${email}" class="cta-btn">Balas Pesan Ini</a>
              </div>
            </div>
            
            <!-- Branded Footer -->
            <div class="footer-section">
              <p><strong>${companyName} Website Portal</strong><br/>
              Email ini diteruskan otomatis dari form kontak di website DAW. Silakan langsung balas (reply) email ini untuk merespon pengirim.</p>
            </div>

          </div>
        </div>
      </body>
      </html>
    `;

    console.log("\n==================================================");
    console.log("✉️ [EMAIL TESTING - INCOMING CONTACT FORM INQUIRY]");
    console.log(`   👉 Pengirim  : ${name} <${email}>`);
    console.log(`   👉 Telepon   : ${phone || "-"}`);
    console.log(`   👉 Perusahaan: ${company || "-"}`);
    console.log(`   👉 Subjek    : ${subject}`);
    console.log(`   👉 Ditujukan : ${targetEmail} (${activeSubjectName})`);
    console.log("   👉 Isi Pesan :");
    console.log(`      "${message}"`);
    console.log("==================================================\n");

    // EMAIL TRAP/INTERCEPTOR FOR TESTING
    let recipient = targetEmail;
    let finalSubject = `[Inquiry] ${subject} - ${name}`;
    if (process.env.EMAIL_TRAP) {
      recipient = process.env.EMAIL_TRAP;
      finalSubject = `[TRAP -> ${targetEmail}] ${finalSubject}`;
    }

    // Execute dispatch
    const mailAttachments = [];
    if (isLocalhost && !logoUrl) {
      mailAttachments.push({
        filename: "logo-daw.png",
        path: path.join(__dirname, "..", "public", "logo-daw.png"),
        cid: "logo-daw",
      });
    }

    await sendMailWithRetry({
      from: sender,
      to: recipient,
      replyTo: email,
      subject: finalSubject,
      html: htmlTemplate,
      attachments: mailAttachments.length ? mailAttachments : undefined,
    });

    console.log(`✉️ [SUCCESS] Email Inquiry terkirim ke: ${targetEmail}`);
    return true;
  } catch (error) {
    console.error(`🚨 [MAILER ERROR] Gagal mengirim email inquiry:`, error.message);
    return false;
  }
};

module.exports = {
  transporter,
  sendApprovalNotification,
  sendInquiryNotification,
};
