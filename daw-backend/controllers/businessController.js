const BusinessSection = require("../models/BusinessSection");
const BusinessMapMarker = require("../models/BusinessMapMarker");
const sequelize = require("../config/database");

// FUNGSI UNTUK PUBLIC FRONTEND
exports.getPublicBusinessData = async (req, res) => {
  try {
    const sections = await BusinessSection.findAll({
      include: [
        {
          model: BusinessMapMarker,
          as: "mapMarkers",
          attributes: [
            "id",
            "title",
            "desc",
            "type",
            "dotX",
            "dotY",
            "boxX",
            "boxY",
          ],
        },
      ],
      order: [["createdAt", "ASC"]], // Urutkan sesuai waktu pembuatan
    });

    res.status(200).json(sections);
  } catch (error) {
    console.error("Error fetching business data:", error);
    res.status(500).json({ message: "Failed to fetch business data" });
  }
};

exports.updateBusinessSection = async (req, res) => {
  const { id } = req.params; // ID section (contoh: 'resources' atau 'energy')
  const { title, htmlContent, hasMap, mapMarkers } = req.body;
  const isMapActive =
    hasMap === true || hasMap === "true" || hasMap === 1 ? 1 : 0;
  // Memulai Transaksi Database
  // Jika salah satu proses gagal, SEMUA proses dibatalkan (Rollback). Ini mencegah data setengah matang!
  const t = await sequelize.transaction();

  try {
    // 1. Cek apakah Section-nya ada
    const section = await BusinessSection.findByPk(id);
    if (!section) {
      await t.rollback();
      return res.status(404).json({ message: "Business Section not found!" });
    }

    // 2. Update Data Utama (Judul, HTML, dan Toggle Map)
    await section.update(
      {
        title: title,
        htmlContent: htmlContent,
        hasMap: isMapActive, // <-- Gunakan variabel baru ini!
      },
      { transaction: t },
    );

    // 3. Teknik "Wipe and Replace" untuk Map Markers
    // Hapus SEMUA marker lama milik section ini
    await BusinessMapMarker.destroy({
      where: { sectionId: id },
      transaction: t,
    });

    // Jika Admin menyalakan toggle Map dan mengirimkan data marker baru
    if (hasMap && mapMarkers && mapMarkers.length > 0) {
      // Siapkan array marker baru dengan menyisipkan 'sectionId'
      const newMarkers = mapMarkers.map((marker) => ({
        title: marker.title,
        desc: marker.desc,
        type: marker.type,
        dotX: marker.dotX,
        dotY: marker.dotY,
        boxX: marker.boxX,
        boxY: marker.boxY,
        sectionId: id, // Hubungkan marker ini ke section yang sedang diedit
      }));

      // Masukkan semua marker baru sekaligus (Bulk Create)
      await BusinessMapMarker.bulkCreate(newMarkers, { transaction: t });
    }

    // 4. Jika semua berhasil, KUNCI PERUBAHANNYA (Commit)
    await t.commit();
    res.status(200).json({ message: "Business Section updated successfully!" });
  } catch (error) {
    // Jika ada error di tengah jalan, BATALKAN SEMUA PERUBAHAN (Rollback)
    await t.rollback();
    console.error("Error updating business section:", error);
    res.status(500).json({
      message: "Failed to update business section",
      error: error.message,
    });
  }
};
