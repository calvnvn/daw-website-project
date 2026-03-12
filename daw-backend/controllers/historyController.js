const sequelize = require("../config/database");

// GET
exports.getHistories = async (req, res) => {
  try {
    const histories = await sequelize.query(
      "SELECT * FROM Histories ORDER BY year ASC",
      { type: sequelize.QueryTypes.SELECT },
    );
    res.status(200).json(histories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch histories" });
    console.log(error);
  }
};

// PUT
exports.updateHistories = async (req, res) => {
  try {
    const { histories } = req.body;

    await sequelize.query("DELETE FROM Histories");

    if (histories && histories.length > 0) {
      for (const item of histories) {
        await sequelize.query(
          "INSERT INTO Histories (year, description) VALUES (:year, :desc)",
          {
            replacements: {
              year: item.year || "",
              desc: item.text || "",
            },
            type: sequelize.QueryTypes.INSERT,
          },
        );
      }
    }

    res.status(200).json({ message: "Company timeline updated successfully!" });
  } catch (error) {
    console.error("Error updating histories:", error);
    res.status(500).json({ message: "Failed to update histories" });
  }
};
