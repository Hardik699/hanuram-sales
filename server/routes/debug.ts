import { RequestHandler } from "express";
import { MongoClient, Db } from "mongodb";

const MONGODB_URI = "mongodb+srv://admin:admin1@cluster0.a3duo.mongodb.net/?appName=Cluster0";

let cachedDb: Db | null = null;

async function getDatabase(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedDb = client.db("upload_system");
  return cachedDb;
}

// Debug endpoint to check item-sales matching
export const handleDebugItemSales: RequestHandler = async (req, res) => {
  try {
    const { itemId } = req.query;

    if (!itemId) {
      return res.status(400).json({ error: "itemId query parameter required" });
    }

    const db = await getDatabase();

    // Get the item
    const itemsCollection = db.collection("items");
    const item = await itemsCollection.findOne({ itemId });

    if (!item) {
      return res.json({
        success: false,
        error: `Item ${itemId} not found`,
      });
    }

    console.log(`🔍 Debugging item ${itemId}:`, {
      itemId: (item as any).itemId,
      itemName: (item as any).itemName,
      shortCode: (item as any).shortCode,
    });

    // Get all sap_codes from petpooja data
    const petpoojaCollection = db.collection("petpooja");
    const petpoojaData = await petpoojaCollection.find({}).toArray();

    const allSapCodes = new Set<string>();
    const matchingRows = [];

    for (const doc of petpoojaData) {
      if (!Array.isArray(doc.data)) continue;

      const headers = doc.data[0] as string[];
      const dataRows = doc.data.slice(1);

      const sapCodeIdx = headers.findIndex(
        (h) => h.toLowerCase().trim() === "sap_code"
      );

      if (sapCodeIdx === -1) continue;

      for (const row of dataRows) {
        if (!Array.isArray(row)) continue;
        const sapCode = row[sapCodeIdx]?.toString().trim() || "";
        if (sapCode) {
          allSapCodes.add(sapCode);

          // Check if this sap_code matches the item's shortCode
          if (sapCode === ((item as any).shortCode || itemId)) {
            matchingRows.push(sapCode);
          }
        }
      }
    }

    res.json({
      success: true,
      item: {
        itemId: (item as any).itemId,
        itemName: (item as any).itemName,
        shortCode: (item as any).shortCode || "NOT SET",
      },
      matching: {
        usedAsFilter: (item as any).shortCode || itemId,
        totalRowsMatching: matchingRows.length,
      },
      database: {
        totalUniqueSapCodes: allSapCodes.size,
        allSapCodes: Array.from(allSapCodes).slice(0, 20), // Show first 20
        totalSapCodesInDb: Array.from(allSapCodes).length,
      },
      recommendation:
        matchingRows.length === 0
          ? `No matching sap_codes found. Your item's shortCode is "${
              (item as any).shortCode || "NOT SET"
            }". Available sap_codes in database: ${Array.from(allSapCodes).join(", ")}`
          : `Found ${matchingRows.length} matching rows in sales data`,
    });
  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update item shortCode endpoint
export const handleUpdateItemShortCode: RequestHandler = async (req, res) => {
  try {
    const { itemId, shortCode } = req.body;

    if (!itemId || !shortCode) {
      return res.status(400).json({
        error: "itemId and shortCode are required",
      });
    }

    const db = await getDatabase();
    const itemsCollection = db.collection("items");

    const result = await itemsCollection.updateOne(
      { itemId },
      { $set: { shortCode, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: `Item ${itemId} not found` });
    }

    console.log(
      `✅ Updated item ${itemId} shortCode to ${shortCode}`
    );

    res.json({
      success: true,
      message: `Item ${itemId} shortCode updated to ${shortCode}`,
    });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
