const Translation = require("../models/Translation");

const saveManualTranslations = async (modelName, recordId, translations, transaction) => {
  if (!translations) return;
  
  let transObj = translations;
  if (typeof transObj === "string") {
    try {
      transObj = JSON.parse(transObj);
    } catch (e) {
      console.warn("Failed to parse manual translations:", e);
      return;
    }
  }
  
  if (transObj && transObj.id) {
    await Translation.destroy({
      where: { modelName, recordId: String(recordId), locale: "id" },
      transaction
    });
    
    for (const [field, text] of Object.entries(transObj.id)) {
      if (text !== undefined && text !== null && String(text).trim() !== "") {
        await Translation.create({
          modelName,
          recordId: String(recordId),
          field,
          locale: "id",
          translatedText: text
        }, { transaction });
      }
    }
  }
};

module.exports = { saveManualTranslations };
