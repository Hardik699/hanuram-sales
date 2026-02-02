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

// Get all SAP codes from uploaded data
export const handleGetAllSapCodes: RequestHandler = async (req, res) => {
  try {
    const db = await getDatabase();
    const petpoojaCollection = db.collection("petpooja");
    const petpoojaData = await petpoojaCollection.find({}).toArray();

    const sapCodeMap = new Map<string, { count: number; categories: string[] }>();

    for (const doc of petpoojaData) {
      if (!Array.isArray(doc.data)) continue;

      const headers = doc.data[0] as string[];
      const dataRows = doc.data.slice(1);

      const sapCodeIdx = headers.findIndex(
        (h) => h.toLowerCase().trim() === "sap_code"
      );
      const categoryIdx = headers.findIndex(
        (h) => h.toLowerCase().trim() === "category_name"
      );

      if (sapCodeIdx === -1) continue;

      for (const row of dataRows) {
        if (!Array.isArray(row)) continue;
        const sapCode = row[sapCodeIdx]?.toString().trim() || "";
        const category = row[categoryIdx]?.toString().trim() || "Unknown";

        if (sapCode) {
          if (!sapCodeMap.has(sapCode)) {
            sapCodeMap.set(sapCode, { count: 0, categories: [] });
          }
          const entry = sapCodeMap.get(sapCode)!;
          entry.count += 1;
          if (!entry.categories.includes(category)) {
            entry.categories.push(category);
          }
        }
      }
    }

    // Convert to array and sort by count
    const sapCodes = Array.from(sapCodeMap.entries())
      .map(([code, data]) => ({
        sapCode: code,
        rowCount: data.count,
        categories: data.categories,
      }))
      .sort((a, b) => b.rowCount - a.rowCount);

    res.json({
      success: true,
      totalUniqueSapCodes: sapCodes.length,
      sapCodes,
      message: "All SAP codes from uploaded petpooja data with their counts",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get all items with their current SAP codes
export const handleGetItemsWithSapCodes: RequestHandler = async (req, res) => {
  try {
    const db = await getDatabase();
    const itemsCollection = db.collection("items");
    const items = await itemsCollection.find({}).toArray();

    const itemsData = items.map((item: any) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      shortCode: item.shortCode || "NOT SET",
      group: item.group,
      category: item.category,
      variations: item.variations?.map((v: any) => ({
        value: v.value,
        sapCode: v.sapCode || "NOT SET",
      })) || [],
    }));

    res.json({
      success: true,
      totalItems: itemsData.length,
      items: itemsData,
      message: "All items with their current SAP codes",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update item's shortCode to match SAP code from sales data
export const handleSetItemSapCode: RequestHandler = async (req, res) => {
  try {
    const { itemId, sapCode } = req.body;

    if (!itemId || !sapCode) {
      return res.status(400).json({
        error: "itemId and sapCode are required",
      });
    }

    const db = await getDatabase();
    const itemsCollection = db.collection("items");

    const result = await itemsCollection.updateOne(
      { itemId },
      { $set: { shortCode: sapCode, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        error: `Item ${itemId} not found`,
      });
    }

    console.log(`✅ Updated item ${itemId} SAP code to ${sapCode}`);

    res.json({
      success: true,
      message: `Item ${itemId} SAP code updated to ${sapCode}`,
      itemId,
      sapCode,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Batch update items SAP codes
export const handleBatchSetSapCodes: RequestHandler = async (req, res) => {
  try {
    const { mappings } = req.body; // Array of { itemId, sapCode }

    if (!Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({
        error: "mappings array is required with itemId and sapCode pairs",
      });
    }

    const db = await getDatabase();
    const itemsCollection = db.collection("items");

    const results = [];

    for (const { itemId, sapCode } of mappings) {
      const result = await itemsCollection.updateOne(
        { itemId },
        { $set: { shortCode: sapCode, updatedAt: new Date() } }
      );

      results.push({
        itemId,
        sapCode,
        updated: result.matchedCount > 0,
      });

      if (result.matchedCount > 0) {
        console.log(`✅ Updated ${itemId} -> ${sapCode}`);
      }
    }

    const successful = results.filter((r) => r.updated).length;

    res.json({
      success: true,
      message: `Updated ${successful} out of ${mappings.length} items`,
      results,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Compare items vs SAP codes in uploaded data
export const handleMatchSapCodes: RequestHandler = async (req, res) => {
  try {
    const db = await getDatabase();

    // Get SAP codes from petpooja
    const petpoojaCollection = db.collection("petpooja");
    const petpoojaData = await petpoojaCollection.find({}).toArray();

    const sapCodesFromUpload = new Set<string>();

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
          sapCodesFromUpload.add(sapCode);
        }
      }
    }

    // Get items
    const itemsCollection = db.collection("items");
    const items = await itemsCollection.find({}).toArray();

    const matchedItems = [];
    const unmatchedItems = [];

    for (const item of items) {
      const itemSapCode = (item as any).shortCode || (item as any).itemId;

      if (sapCodesFromUpload.has(itemSapCode)) {
        matchedItems.push({
          itemId: (item as any).itemId,
          itemName: (item as any).itemName,
          sapCode: itemSapCode,
          hasData: true,
        });
      } else {
        unmatchedItems.push({
          itemId: (item as any).itemId,
          itemName: (item as any).itemName,
          currentSapCode: itemSapCode,
          suggestedSapCodes: Array.from(sapCodesFromUpload).slice(0, 5), // Show first 5
        });
      }
    }

    res.json({
      success: true,
      summary: {
        totalItems: items.length,
        matchedItems: matchedItems.length,
        unmatchedItems: unmatchedItems.length,
        totalSapCodesInUpload: sapCodesFromUpload.size,
      },
      matchedItems,
      unmatchedItems,
      allAvailableSapCodes: Array.from(sapCodesFromUpload),
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
