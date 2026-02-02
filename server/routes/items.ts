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
      console.log("✅ Connected to MongoDB for items");
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

// Create or get items collection
async function getItemsCollection() {
  const db = await getDatabase();
  return db.collection("items");
}

// Create or get dropdowns collection
async function getDropdownsCollection() {
  const db = await getDatabase();
  return db.collection("item_dropdowns");
}

// Get all items
export const handleGetItems: RequestHandler = async (req, res) => {
  try {
    const collection = await getItemsCollection();
    const items = await collection.find({}).toArray();

    if (items.length === 0) {
      console.warn("⚠️ No items found in database");
      return res.json([]);
    }

    console.log(`✅ Retrieved ${items.length} items from database`);

    // Log first item structure to debug field names
    console.log("First item fields:", Object.keys(items[0]));
    console.log("Item IDs from DB:", items.map(i => {
      const item = i as any;
      return `${item.itemId || item.itemName || "NO_ID"}`;
    }).join(", "));

    // Ensure all items have itemId - if not, try to use shortCode or generate one
    const processedItems = items.map((item: any, index: number) => {
      if (!item.itemId) {
        console.warn(`⚠️ Item at index ${index} missing itemId, has fields:`, Object.keys(item));
        // If itemId is missing, this item cannot be retrieved by ItemDetail page
        // Return it as-is so client can see the issue
      }
      return item;
    });

    res.json(processedItems);
  } catch (error) {
    console.error("❌ Error fetching items:", error);
    res.status(500).json({
      error: "Failed to fetch items",
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

// Get a single item by ID
export const handleGetItemById: RequestHandler = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!itemId) {
      return res.status(400).json({ error: "itemId is required" });
    }

    const collection = await getItemsCollection();
    const item = await collection.findOne({ itemId });

    if (!item) {
      return res.status(404).json({ error: `Item with ID "${itemId}" not found` });
    }

    console.log(`✅ Retrieved item ${itemId}: ${(item as any).itemName}`);
    res.json(item);
  } catch (error) {
    console.error("❌ Error fetching item:", error);
    res.status(500).json({
      error: "Failed to fetch item",
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

// Create a new item
export const handleCreateItem: RequestHandler = async (req, res) => {
  try {
    const item = req.body;

    // Validate required fields
    if (!item.itemId || !item.itemName || !item.group || !item.category) {
      console.error("❌ Missing required fields:", { itemId: item.itemId, itemName: item.itemName, group: item.group, category: item.category });
      return res.status(400).json({ error: "Missing required fields" });
    }

    const collection = await getItemsCollection();

    // Check if item already exists
    const existing = await collection.findOne({ itemId: item.itemId });
    if (existing) {
      console.warn(`⚠️ Item ${item.itemId} already exists`);
      return res.status(409).json({ error: "Item with this ID already exists" });
    }

    const documentToInsert = {
      ...item,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log(`📝 Inserting item ${item.itemId}:`, {
      itemName: item.itemName,
      group: item.group,
      category: item.category,
      variations: item.variations?.length || 0,
    });

    const result = await collection.insertOne(documentToInsert);

    console.log(`✅ Item ${item.itemId} created with MongoDB ID:`, result.insertedId);
    console.log(`📝 Response includes itemId:`, item.itemId);

    // Ensure itemId is included in the response
    const responseItem = { ...item, _id: result.insertedId };
    console.log(`📤 Sending response:`, { itemId: responseItem.itemId, itemName: responseItem.itemName });

    res.status(201).json(responseItem);
  } catch (error) {
    console.error("❌ Error creating item:", error);
    res.status(500).json({
      error: "Failed to create item",
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

// Update an item
export const handleUpdateItem: RequestHandler = async (req, res) => {
  try {
    const { itemId } = req.params;
    const updateData = req.body;

    const collection = await getItemsCollection();

    const result = await collection.updateOne(
      { itemId },
      {
        $set: {
          ...updateData,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({ message: "Item updated successfully" });
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).json({ error: "Failed to update item" });
  }
};

// Delete an item
export const handleDeleteItem: RequestHandler = async (req, res) => {
  try {
    const { itemId } = req.params;

    const collection = await getItemsCollection();

    const result = await collection.deleteOne({ itemId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({ error: "Failed to delete item" });
  }
};

// Get all dropdown options (groups, categories, HSN codes, variation values)
export const handleGetDropdowns: RequestHandler = async (req, res) => {
  try {
    const collection = await getDropdownsCollection();

    const dropdowns = await collection.findOne({ _id: "main" });

    if (!dropdowns) {
      return res.json({
        groups: [],
        categories: [],
        hsnCodes: [],
        variationValues: [],
      });
    }

    res.json({
      groups: dropdowns.groups || [],
      categories: dropdowns.categories || [],
      hsnCodes: dropdowns.hsnCodes || [],
      variationValues: dropdowns.variationValues || [],
    });
  } catch (error) {
    console.error("Error fetching dropdowns:", error);
    res.status(500).json({ error: "Failed to fetch dropdowns" });
  }
};

// Add a new group
export const handleAddGroup: RequestHandler = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Group name is required" });
    }

    const collection = await getDropdownsCollection();

    const result = await collection.updateOne(
      { _id: "main" },
      {
        $addToSet: { groups: name.trim() },
        $setOnInsert: {
          categories: [],
          hsnCodes: [],
          variationValues: [],
        },
      },
      { upsert: true }
    );

    res.status(201).json({ message: "Group added successfully" });
  } catch (error) {
    console.error("Error adding group:", error);
    res.status(500).json({ error: "Failed to add group" });
  }
};

// Add a new category
export const handleAddCategory: RequestHandler = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const collection = await getDropdownsCollection();

    await collection.updateOne(
      { _id: "main" },
      {
        $addToSet: { categories: name.trim() },
        $setOnInsert: {
          groups: [],
          hsnCodes: [],
          variationValues: [],
        },
      },
      { upsert: true }
    );

    res.status(201).json({ message: "Category added successfully" });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ error: "Failed to add category" });
  }
};

// Add a new HSN code
export const handleAddHsnCode: RequestHandler = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: "HSN code is required" });
    }

    const collection = await getDropdownsCollection();

    await collection.updateOne(
      { _id: "main" },
      {
        $addToSet: { hsnCodes: code.trim() },
        $setOnInsert: {
          groups: [],
          categories: [],
          variationValues: [],
        },
      },
      { upsert: true }
    );

    res.status(201).json({ message: "HSN code added successfully" });
  } catch (error) {
    console.error("Error adding HSN code:", error);
    res.status(500).json({ error: "Failed to add HSN code" });
  }
};

// Add a new variation value
export const handleAddVariationValue: RequestHandler = async (req, res) => {
  try {
    const { value } = req.body;

    if (!value || !value.trim()) {
      return res.status(400).json({ error: "Variation value is required" });
    }

    const collection = await getDropdownsCollection();

    await collection.updateOne(
      { _id: "main" },
      {
        $addToSet: { variationValues: value.trim() },
        $setOnInsert: {
          groups: [],
          categories: [],
          hsnCodes: [],
        },
      },
      { upsert: true }
    );

    res.status(201).json({ message: "Variation value added successfully" });
  } catch (error) {
    console.error("Error adding variation value:", error);
    res.status(500).json({ error: "Failed to add variation value" });
  }
};
