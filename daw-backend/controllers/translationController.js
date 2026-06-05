const Translation = require("../models/Translation");
const { autoTranslate: translateText } = require("../services/openaiService");

/**
 * Controller to handle Manual Translation Operations
 */
class TranslationController {
  // Fetch existing manual/cached translations for a specific record
  async getManualTranslations(req, res) {
    try {
      const { modelName, recordId } = req.query;

      if (!modelName) {
        return res.status(400).json({ message: "modelName is required" });
      }

      // For singleton models, we might pass recordId as "1" or not at all.
      // We default to "1" if missing, to be safe.
      const queryRecordId = recordId || "1";

      const whereClause = { modelName: modelName };
      if (queryRecordId !== "ALL") {
        whereClause.recordId = String(queryRecordId);
      }

      const translations = await Translation.findAll({
        where: whereClause,
      });

      // Format response
      const formatted = { id: {} };
      translations.forEach((t) => {
        if (t.locale === "id") {
          if (queryRecordId === "ALL") {
            if (!formatted.id[t.recordId]) formatted.id[t.recordId] = {};
            formatted.id[t.recordId][t.field] = t.translatedText;
          } else {
            formatted.id[t.field] = t.translatedText;
          }
        }
      });

      res.status(200).json({ data: formatted });
    } catch (error) {
      console.error("🚨 Error fetching manual translations:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }

  // Trigger Magic Auto Translate from Frontend
  async autoTranslate(req, res) {
    try {
      const { text, targetLanguage = "id", context = "" } = req.body;

      if (!text) {
        return res.status(400).json({ message: "Text to translate is required" });
      }

      const translated = await translateText(text, targetLanguage, context);

      res.status(200).json({ data: translated });
    } catch (error) {
      console.error("🚨 Error auto translating:", error);
      res.status(500).json({ message: "Failed to translate text" });
    }
  }
}

module.exports = new TranslationController();
