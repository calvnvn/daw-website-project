// test-mail.js
require("dotenv").config();
const { sendApprovalNotification } = require("./utils/mailer");

const dummyTest = async () => {
  console.log("🚀 Memulai Uji Coba Email DAW...");

  const result = await sendApprovalNotification({
    toEmail: "jf.calvin20@gmail.com",
    recipientName: "Jap Feodrian",
    type: "NEW_REQUEST", // Ganti ke 'REJECTED' atau 'APPROVED' buat ngetes warna
    draftInfo: {
      notrans: "CMS/PRJ/2026/001",
      module_name: "Project Detail",
      action: "UPDATE", // Coba ganti ke 'DELETE' buat liat warna Kuning DAW
      created_by: "Editor_Aziz",
    },
    reason: "Gambar kurang high-res, tolong ganti yang 4K.",
  });

  if (result) console.log("✅ Email sukses terkirim ke trap!");
  else console.log("❌ Email gagal.");
};

dummyTest();
