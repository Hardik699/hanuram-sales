import { RequestHandler } from "express";
import { MongoClient, Db } from "mongodb";

const MONGODB_URI = "mongodb+srv://admin:admin1@cluster0.a3duo.mongodb.net/?appName=Cluster0";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let connectionPromise: Promise<Db> | null = null;

async function getDatabase(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      const client = new MongoClient(MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 5000,
        family: 4,
      });

      await client.connect();
      console.log("✅ Connected to MongoDB");
      cachedClient = client;
      cachedDb = client.db("upload_system");
      return cachedDb;
    } catch (error) {
      console.error("❌ Failed to connect to MongoDB:", error);
      connectionPromise = null;
      throw new Error("Database connection failed: " + (error instanceof Error ? error.message : String(error)));
    }
  })();

  return connectionPromise;
}

// Sample sales data structure
interface SalesRecord {
  itemId: string;
  variationId: string;
  channel: "Dining" | "Parcel" | "Online";
  quantity: number;
  value: number;
  date: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PetpoojaRow {
  restaurant_name: string;
  "New Date": string;
  Time: string;
  order_type: string;
  area: string;
  brand_grouping: string;
  category_name: string;
  sap_code: string;
  item_price: number;
  item_quantity: number;
}

interface SalesAnalysis {
  diningData: {
    quantity: number;
    value: number;
    variations: Array<{ name: string; quantity: number; value: number }>;
  };
  parcelData: {
    quantity: number;
    value: number;
    variations: Array<{ name: string; quantity: number; value: number }>;
  };
  onlineData: {
    quantity: number;
    value: number;
    variations: Array<{ name: string; quantity: number; value: number }>;
  };
}

// GET /api/sales - Get sales records with optional filters
export const handleGetSales: RequestHandler = async (req, res) => {
  try {
    const { itemId, startDate, endDate, channel } = req.query;

    // This is a placeholder for future database integration
    // For now, return an empty array or sample data
    const filters: any = {};

    if (itemId) filters.itemId = itemId;
    if (channel) filters.channel = channel;
    if (startDate || endDate) {
      filters.date = {};
      if (startDate) filters.date.$gte = startDate;
      if (endDate) filters.date.$lte = endDate;
    }

    // TODO: Query from MongoDB collections.sales with filters
    const salesRecords: SalesRecord[] = [];

    res.json({
      success: true,
      count: salesRecords.length,
      data: salesRecords,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
};

// Helper function to map order type
function mapOrderType(orderType: string, area: string): "Dining" | "Parcel" | "Online" {
  const orderTypeLower = orderType?.toLowerCase() || "";
  const areaLower = area?.toLowerCase() || "";

  // If Area is Zomato or Swiggy → Online
  if (areaLower === "zomato" || areaLower === "swiggy") {
    return "Online";
  }

  // If Order_type is Pickup or Home Delivery → Parcel
  if (orderTypeLower === "pickup" || orderTypeLower === "home delivery") {
    return "Parcel";
  }

  // Default to Dining
  return "Dining";
}

// Helper function to parse date string (handles multiple formats)
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try YYYY-MM-DD format first (from HTML date input)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]);
    const day = parseInt(isoMatch[3]);
    // Use UTC to avoid timezone issues
    const result = new Date(Date.UTC(year, month - 1, day));
    //console.log(`parseDate("${dateStr}") → ${result.toISOString()}`);
    return result;
  }

  // Try other date formats
  const formats = [
    /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY or D/M/YYYY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year, month, day;
      if (match[3].length === 4) {
        year = parseInt(match[3]);
        month = parseInt(match[1]);
        day = parseInt(match[2]);
      }
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  // Fallback: try native Date parsing
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

// GET /api/sales/item/:itemId - Get sales data for a specific item from stored salesHistory
export const handleGetItemSales: RequestHandler = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { startDate, endDate, restaurant } = req.query;

    // Parse dates - if not provided, use last 365 days as default
    let start: Date, end: Date;

    if (startDate && endDate) {
      const parsedStart = parseDate(startDate as string);
      const parsedEnd = parseDate(endDate as string);

      if (!parsedStart || !parsedEnd) {
        return res.status(400).json({
          success: false,
          error: "Invalid date format. Use YYYY-MM-DD",
        });
      }
      start = parsedStart;
      end = new Date(parsedEnd.getTime() + 24 * 60 * 60 * 1000 - 1);
    } else {
      // Default to last 365 days
      end = new Date();
      // Set end to end-of-day
      end = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1));
      end = new Date(end.getTime() - 1);
      // Set start to 365 days ago
      start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    const db = await getDatabase();

    // Fetch the item with all its variations and salesHistory
    const itemsCollection = db.collection("items");
    const item = await itemsCollection.findOne({ itemId });

    if (!item) {
      return res.json({
        success: true,
        data: {
          itemId,
          zomatoData: { quantity: 0, value: 0, variations: [] },
          swiggyData: { quantity: 0, value: 0, variations: [] },
          diningData: { quantity: 0, value: 0, variations: [] },
          parcelData: { quantity: 0, value: 0, variations: [] },
        },
      });
    }

    console.log(`📊 Fetching sales for item ${itemId} from stored salesHistory`);
    console.log(`📅 Date range: ${start.toISOString()} to ${end.toISOString()}`);

    // Aggregate sales data by month, day, area, and restaurant
    const monthlyByArea: { [key: string]: { [area: string]: number } } = {};
    const dailyByArea: { [key: string]: { [area: string]: number } } = {};
    const restaurantSales: { [key: string]: number } = {};
    const salesByArea: {
      [key in "zomato" | "swiggy" | "dining" | "parcel"]: {
        [variationName: string]: { quantity: number; value: number };
      };
    } = {
      zomato: {},
      swiggy: {},
      dining: {},
      parcel: {},
    };

    let totalRecordsProcessed = 0;
    let totalRecordsFiltered = 0;

    if ((item as any).variations && Array.isArray((item as any).variations)) {
      (item as any).variations.forEach((variation: any, idx: number) => {
        if (!variation.salesHistory || !Array.isArray(variation.salesHistory)) {
          return;
        }

        const variationName = variation.name || `Variation ${idx + 1}`;
        console.log(`  Processing variation ${idx} (${variationName}): ${variation.salesHistory.length} records`);

        variation.salesHistory.forEach((record: any) => {
          totalRecordsProcessed++;
          const recordDate = parseDate(record.date);

          // Debug first few records
          if (totalRecordsProcessed <= 3) {
            console.log(`    Record ${totalRecordsProcessed}: date="${record.date}" → parsed="${recordDate?.toISOString()}" (start=${start.toISOString()}, end=${end.toISOString()})`);
            console.log(`    Comparison: ${recordDate?.getTime()} < ${start.getTime()} ? ${recordDate! < start}, ${recordDate?.getTime()} > ${end.getTime()} ? ${recordDate! > end}`);
          }

          if (!recordDate || recordDate < start || recordDate > end) {
            totalRecordsFiltered++;
            return;
          }

          // Filter by restaurant if provided
          if (restaurant && record.restaurant !== restaurant) {
            return;
          }

          // Normalize area to lowercase (handles cases where area might be stored as "Zomato" or "ZOMATO")
          const rawArea = record.area || "dining";
          const area = (rawArea.toLowerCase()) as "zomato" | "swiggy" | "dining" | "parcel";
          const quantity = record.quantity || 0;
          const restaurantName = record.restaurant || "Unknown";

          // Aggregate by area & variation
          if (!salesByArea[area][variationName]) {
            salesByArea[area][variationName] = { quantity: 0, value: 0 };
          }
          salesByArea[area][variationName].quantity += quantity;
          salesByArea[area][variationName].value += record.value || 0;

          // Aggregate by month & area
          const month = recordDate.toISOString().substring(0, 7); // YYYY-MM
          if (!monthlyByArea[month]) monthlyByArea[month] = {};
          monthlyByArea[month][area] = (monthlyByArea[month][area] || 0) + quantity;

          // Aggregate by day & area
          const day = recordDate.toISOString().substring(0, 10); // YYYY-MM-DD
          if (!dailyByArea[day]) dailyByArea[day] = {};
          dailyByArea[day][area] = (dailyByArea[day][area] || 0) + quantity;

          // Aggregate by restaurant
          restaurantSales[restaurantName] = (restaurantSales[restaurantName] || 0) + quantity;
        });
      });
    }

    // Format data for output
    const formatAreaData = (areaKey: string, data: { [variationName: string]: { quantity: number; value: number } }) => {
      const variations = Object.entries(data).map(([variationName, info]) => ({
        name: variationName,
        quantity: info.quantity,
        value: info.value,
      }));

      return {
        quantity: variations.reduce((sum, v) => sum + v.quantity, 0),
        value: variations.reduce((sum, v) => sum + v.value, 0),
        variations,
      };
    };

    // Build monthly chart data
    const monthlyData = Object.entries(monthlyByArea)
      .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
      .map(([month, areas]) => ({
        month,
        zomatoQty: areas.zomato || 0,
        swiggyQty: areas.swiggy || 0,
        diningQty: areas.dining || 0,
        parcelQty: areas.parcel || 0,
        totalQty: (areas.zomato || 0) + (areas.swiggy || 0) + (areas.dining || 0) + (areas.parcel || 0),
      }));

    // Build daily chart data
    const dateWiseData = Object.entries(dailyByArea)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, areas]) => ({
        date,
        zomatoQty: areas.zomato || 0,
        swiggyQty: areas.swiggy || 0,
        diningQty: areas.dining || 0,
        parcelQty: areas.parcel || 0,
        totalQty: (areas.zomato || 0) + (areas.swiggy || 0) + (areas.dining || 0) + (areas.parcel || 0),
      }));

    const salesData = {
      itemId,
      zomatoData: formatAreaData("zomato", salesByArea.zomato),
      swiggyData: formatAreaData("swiggy", salesByArea.swiggy),
      diningData: formatAreaData("dining", salesByArea.dining),
      parcelData: formatAreaData("parcel", salesByArea.parcel),
      monthlyData,
      dateWiseData,
      restaurantSales,
    };

    console.log(`✅ Sales data for ${itemId}:`, {
      totalProcessed: totalRecordsProcessed,
      totalFiltered: totalRecordsFiltered,
      zomato: salesData.zomatoData.quantity,
      swiggy: salesData.swiggyData.quantity,
      dining: salesData.diningData.quantity,
      parcel: salesData.parcelData.quantity,
      monthlyMonths: salesData.monthlyData.length,
      dailyDays: salesData.dateWiseData.length,
      restaurants: Object.keys(salesData.restaurantSales).length,
    });

    res.json({
      success: true,
      data: salesData,
    });
  } catch (error) {
    console.error("Error in handleGetItemSales:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
};

// GET /api/sales/summary - Get sales summary data
export const handleGetSalesSummary: RequestHandler = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // TODO: Aggregate sales data from MongoDB
    const summary = {
      period: {
        start: startDate,
        end: endDate,
      },
      channels: {
        dining: {
          quantity: 0,
          value: 0,
        },
        parcel: {
          quantity: 0,
          value: 0,
        },
        online: {
          quantity: 0,
          value: 0,
        },
      },
      total: {
        quantity: 0,
        value: 0,
      },
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
};

// POST /api/sales - Record a new sale (for future use)
export const handleRecordSale: RequestHandler = async (req, res) => {
  try {
    const { itemId, variationId, channel, quantity, value, date } = req.body;

    // Validate required fields
    if (!itemId || !variationId || !channel || !quantity || !value || !date) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: itemId, variationId, channel, quantity, value, date",
      });
      return;
    }

    // TODO: Insert sale record into MongoDB
    const saleRecord: SalesRecord = {
      itemId,
      variationId,
      channel,
      quantity,
      value,
      date,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    res.status(201).json({
      success: true,
      message: "Sale recorded successfully",
      data: saleRecord,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
};

// GET /api/sales/monthly/:itemId - Get monthly sales data for an item
export const handleGetMonthlySales: RequestHandler = async (req, res) => {
  try {
    const { itemId } = req.params;

    // TODO: Aggregate sales data by month from MongoDB
    const monthlyData = [];

    res.json({
      success: true,
      data: monthlyData,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
};

// GET /api/sales/daily/:itemId/:month - Get daily sales data for a month
export const handleGetDailySales: RequestHandler = async (req, res) => {
  try {
    const { itemId, month } = req.params;

    // TODO: Aggregate sales data by day for the specified month from MongoDB
    const dailyData = [];

    res.json({
      success: true,
      data: dailyData,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
};

// Debug endpoint - Get raw sales data for an item without date filtering
export const handleDebugItemSalesRaw: RequestHandler = async (req, res) => {
  try {
    const { itemId } = req.query;

    if (!itemId) {
      return res.status(400).json({ error: "itemId query parameter required" });
    }

    const db = await getDatabase();
    const itemsCollection = db.collection("items");
    const item = await itemsCollection.findOne({ itemId });

    if (!item) {
      return res.json({
        success: false,
        error: `Item ${itemId} not found`,
      });
    }

    const salesByArea: {
      [key in "zomato" | "swiggy" | "dining" | "parcel"]: {
        [variationName: string]: { quantity: number; value: number };
      };
    } = {
      zomato: {},
      swiggy: {},
      dining: {},
      parcel: {},
    };

    let totalRecords = 0;
    let areaCount: { [key: string]: number } = {};

    if ((item as any).variations && Array.isArray((item as any).variations)) {
      (item as any).variations.forEach((variation: any, idx: number) => {
        if (!variation.salesHistory || !Array.isArray(variation.salesHistory)) {
          return;
        }

        const variationName = variation.name || `Variation ${idx + 1}`;

        variation.salesHistory.forEach((record: any) => {
          totalRecords++;
          const rawArea = record.area || "dining";
          const area = (rawArea.toLowerCase()) as "zomato" | "swiggy" | "dining" | "parcel";
          areaCount[area] = (areaCount[area] || 0) + 1;

          if (!salesByArea[area][variationName]) {
            salesByArea[area][variationName] = { quantity: 0, value: 0 };
          }
          salesByArea[area][variationName].quantity += record.quantity || 0;
          salesByArea[area][variationName].value += record.value || 0;
        });
      });
    }

    const formatAreaData = (data: { [variationName: string]: { quantity: number; value: number } }) => {
      const variations = Object.entries(data).map(([variationName, info]) => ({
        name: variationName,
        quantity: info.quantity,
        value: info.value,
      }));
      return {
        quantity: variations.reduce((sum, v) => sum + v.quantity, 0),
        value: variations.reduce((sum, v) => sum + v.value, 0),
        variations,
      };
    };

    res.json({
      success: true,
      itemId,
      itemName: (item as any).itemName,
      totalRecords,
      areaCount,
      zomatoData: formatAreaData(salesByArea.zomato),
      swiggyData: formatAreaData(salesByArea.swiggy),
      diningData: formatAreaData(salesByArea.dining),
      parcelData: formatAreaData(salesByArea.parcel),
    });
  } catch (error) {
    console.error("Error in debug sales raw:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// GET /api/sales/restaurants - Get unique restaurant names from all sales data
export const handleGetRestaurants: RequestHandler = async (req, res) => {
  try {
    console.log("📥 GET /api/sales/restaurants - fetching unique restaurants");

    const db = await getDatabase();
    const itemsCollection = db.collection("items");

    // Aggregate all unique restaurant names from salesHistory
    console.log("🔍 Running MongoDB aggregation to find unique restaurants...");

    const restaurants = await itemsCollection.aggregate([
      { $unwind: "$variations" },
      { $unwind: "$variations.salesHistory" },
      {
        $group: {
          _id: "$variations.salesHistory.restaurant",
        },
      },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { _id: 1 } },
    ]).toArray();

    const restaurantNames = restaurants.map((r: any) => r._id).filter(Boolean);

    console.log(`✅ Found ${restaurantNames.length} unique restaurants:`, restaurantNames);

    res.json({
      success: true,
      data: restaurantNames,
    });
  } catch (error) {
    console.error("❌ Error fetching restaurants:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error details:", errorMessage);
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
};

// DELETE /api/sales/item/:itemId - Reset all sales data for an item
export const handleResetItemSales: RequestHandler = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        error: "itemId is required",
      });
    }

    const db = await getDatabase();
    const itemsCollection = db.collection("items");

    // Find the item first
    const item = await itemsCollection.findOne({ itemId });
    if (!item) {
      return res.status(404).json({
        success: false,
        error: `Item with ID "${itemId}" not found`,
      });
    }

    // Clear salesHistory from all variations
    const result = await itemsCollection.updateOne(
      { itemId },
      {
        $set: {
          "variations.$[].salesHistory": [],
        },
      }
    );

    console.log(`✅ Reset sales data for item ${itemId}. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

    res.json({
      success: true,
      message: `Sales data cleared for item "${item.itemName}" (ID: ${itemId})`,
      itemName: item.itemName,
    });
  } catch (error) {
    console.error("Error resetting sales data:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
};
