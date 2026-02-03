import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";

const CHANNELS = ["Dining", "Parcale", "Swiggy", "Zomato", "GS1"];
const ITEM_TYPES = ["Service", "Goods"];
const UNIT_TYPES = ["Single Count", "GM to KG", "All Count"];
const GST_OPTIONS = ["0%", "5%", "12%", "18%", "28%"];
const HSN_CODES = [
  "1001",
  "1002",
  "1003",
  "1004",
  "1005",
  "2101",
  "2102",
  "2201",
  "2202",
  "2301",
];
const VARIATION_VALUES = [
  "200 Gms",
  "250 Gms",
  "500 Gms",
  "1 Kg",
  "500 ml",
  "1 L",
  "2 L",
];

// Helper function to calculate auto pricing
const calculateAutoPrices = (basePrice: number) => {
  if (basePrice <= 0) return { Zomato: 0, Swiggy: 0 };

  // Add 15% markup
  const priceWith15Percent = basePrice * 1.15;

  // Round to nearest 5
  const roundToNearest5 = (price: number) => {
    return Math.round(price / 5) * 5;
  };

  const autoPriceZomato = roundToNearest5(priceWith15Percent);
  const autoPriceSwiggy = roundToNearest5(priceWith15Percent);

  return { Zomato: autoPriceZomato, Swiggy: autoPriceSwiggy };
};

interface Variation {
  id: string;
  name: string;
  value: string;
  area?: string;
  channels: Record<string, number>;
  price: number;
  sapCode: string;
  profitMargin: number;
  salesHistory?: Array<{
    date: string;
    channel: "Dining" | "Parcel" | "Online";
    quantity: number;
    value: number;
    category?: string;
  }>;
}

export default function ItemEdit() {
  const params = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const itemId = params.itemId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [itemName, setItemName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [description, setDescription] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [group, setGroup] = useState("");
  const [category, setCategory] = useState("");
  const [profitMargin, setProfitMargin] = useState("");
  const [gst, setGst] = useState("");
  const [itemType, setItemType] = useState("Goods");
  const [unitType, setUnitType] = useState("Single Count");
  const [variations, setVariations] = useState<Variation[]>([]);

  const [groups, setGroups] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [hsnCodes, setHsnCodes] = useState<string[]>(HSN_CODES);
  const [variationValues, setVariationValues] =
    useState<string[]>(VARIATION_VALUES);

  const [newGroup, setNewGroup] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newHsnCode, setNewHsnCode] = useState("");
  const [newVariationValue, setNewVariationValue] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Load dropdown data
  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        const response = await fetch("/api/items/dropdowns");
        if (response.ok) {
          const data = await response.json();
          if (data.groups) setGroups(data.groups);
          if (data.categories) setCategories(data.categories);
          if (data.hsnCodes) setHsnCodes(data.hsnCodes);
          if (data.variationValues) setVariationValues(data.variationValues);
        }
      } catch (error) {
        console.error("Failed to load dropdown data:", error);
      }
    };

    loadDropdownData();
  }, []);

  // Load item data
  useEffect(() => {
    const fetchItem = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/items");
        if (!response.ok) {
          throw new Error("Failed to fetch items");
        }

        const items = await response.json();
        const foundItem = items.find((i: any) => i.itemId === itemId);

        if (!foundItem) {
          setError(`Item with ID "${itemId}" not found`);
          return;
        }

        // Populate form with item data
        setItemName(foundItem.itemName);
        setShortCode(foundItem.shortCode);
        setDescription(foundItem.description || "");
        setHsnCode(foundItem.hsnCode || "");
        setGroup(foundItem.group);
        setCategory(foundItem.category);
        setProfitMargin(foundItem.profitMargin?.toString() || "");
        setGst(foundItem.gst?.toString() || "");
        setItemType(foundItem.itemType || "Goods");
        setUnitType(foundItem.unitType || "Single Count");

        // Load existing images
        if (foundItem.images && Array.isArray(foundItem.images)) {
          setImagePreviews(foundItem.images);
        }

        // Load variations with auto-calculated prices
        if (foundItem.variations && Array.isArray(foundItem.variations)) {
          setVariations(
            foundItem.variations.map((v: any) => {
              const basePrice = v.price || 0;
              const autoPrices = calculateAutoPrices(basePrice);

              return {
                id: v.id || Date.now().toString(),
                name: v.name || "",
                value: v.value || "",
                area: v.area || "",
                channels: {
                  ...(v.channels || CHANNELS.reduce((acc, ch) => ({ ...acc, [ch]: 0 }), {})),
                  // Override Zomato and Swiggy with auto-calculated prices
                  Zomato: autoPrices.Zomato,
                  Swiggy: autoPrices.Swiggy,
                },
                price: basePrice,
                sapCode: v.sapCode || "",
                profitMargin: v.profitMargin || 0,
                salesHistory: v.salesHistory || [],
              };
            })
          );
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load item";
        console.error("Error loading item:", errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (itemId) {
      fetchItem();
    }
  }, [itemId]);

  const addGroup = async () => {
    if (newGroup.trim() && !groups.includes(newGroup)) {
      try {
        const response = await fetch("/api/items/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newGroup }),
        });
        if (response.ok) {
          const updated = [...groups, newGroup];
          setGroups(updated);
          setGroup(newGroup);
          setNewGroup("");
        }
      } catch (error) {
        console.error("Failed to add group:", error);
      }
    }
  };

  const addCategory = async () => {
    if (newCategory.trim() && !categories.includes(newCategory)) {
      try {
        const response = await fetch("/api/items/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newCategory }),
        });
        if (response.ok) {
          const updated = [...categories, newCategory];
          setCategories(updated);
          setCategory(newCategory);
          setNewCategory("");
        }
      } catch (error) {
        console.error("Failed to add category:", error);
      }
    }
  };

  const addHsnCode = async () => {
    if (newHsnCode.trim() && !hsnCodes.includes(newHsnCode)) {
      try {
        const response = await fetch("/api/items/hsn-codes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: newHsnCode }),
        });
        if (response.ok) {
          const updated = [...hsnCodes, newHsnCode];
          setHsnCodes(updated);
          setHsnCode(newHsnCode);
          setNewHsnCode("");
        }
      } catch (error) {
        console.error("Failed to add HSN code:", error);
      }
    }
  };

  const addVariationValue = async () => {
    if (
      newVariationValue.trim() &&
      !variationValues.includes(newVariationValue)
    ) {
      try {
        const response = await fetch("/api/items/variation-values", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: newVariationValue }),
        });
        if (response.ok) {
          const updated = [...variationValues, newVariationValue];
          setVariationValues(updated);
          setNewVariationValue("");
        }
      } catch (error) {
        console.error("Failed to add variation value:", error);
      }
    }
  };

  const addVariation = () => {
    const newVariation: Variation = {
      id: Date.now().toString(),
      name: "",
      value: "",
      area: "",
      channels: CHANNELS.reduce((acc, ch) => ({ ...acc, [ch]: 0 }), {}),
      price: 0,
      sapCode: "",
      profitMargin: 0,
      salesHistory: [],
    };
    setVariations([...variations, newVariation]);
  };

  const updateVariation = (id: string, field: string, value: any) => {
    setVariations(
      variations.map((v) => {
        if (v.id !== id) return v;

        const updated = { ...v, [field]: value };

        // Auto-calculate Zomato and Swiggy prices when base price changes
        if (field === "price") {
          const autoPrices = calculateAutoPrices(value);
          updated.channels = {
            ...updated.channels,
            Zomato: autoPrices.Zomato,
            Swiggy: autoPrices.Swiggy,
          };
        }

        return updated;
      })
    );
  };

  const updateChannelPrice = (id: string, channel: string, value: number) => {
    setVariations(
      variations.map((v) =>
        v.id === id
          ? { ...v, channels: { ...v.channels, [channel]: value } }
          : v
      )
    );
  };

  const removeVariation = (id: string) => {
    setVariations(variations.filter((v) => v.id !== id));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages([...images, ...files]);

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreviews((prev) => [...prev, event.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemName || !group || !category) {
      alert("Please fill all required fields");
      return;
    }

    const updatedItem = {
      itemId,
      itemName,
      shortCode,
      description,
      hsnCode,
      group,
      category,
      profitMargin: parseFloat(profitMargin) || 0,
      gst: parseFloat(gst) || 0,
      itemType,
      unitType,
      variations,
      images: imagePreviews,
    };

    try {
      setSaving(true);
      console.log("📤 Updating item:", itemId);

      const response = await fetch(`/api/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedItem),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API returned ${response.status}`);
      }

      console.log("✅ Item updated successfully");
      navigate(`/items/${itemId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Failed to update item:", errorMessage);
      alert(`Error updating item: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 sm:p-8">
        <button
          onClick={() => navigate(`/items/${itemId}`)}
          className="flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Item
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">Loading item...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6 sm:p-8">
        <button
          onClick={() => navigate("/items")}
          className="flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Items
        </button>
        <div className="bg-white rounded-xl border border-red-200 p-8">
          <div className="text-red-600">
            <p className="font-semibold text-lg">Error</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 sm:p-8">
      <button
        onClick={() => navigate(`/items/${itemId}`)}
        className="flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Item
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Edit Item</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item ID (Read-only)
              </label>
              <input
                type="text"
                value={itemId}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Name *
              </label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Short Code (Read-only)
              </label>
              <input
                type="text"
                value={shortCode}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HSN Code
              </label>
              <div className="flex gap-2">
                <select
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  <option value="">Select HSN Code</option>
                  {hsnCodes.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNewHsnCode("")}
                  className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-semibold"
                >
                  +
                </button>
              </div>
              {newHsnCode !== null && newHsnCode !== undefined && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newHsnCode}
                    onChange={(e) => setNewHsnCode(e.target.value)}
                    placeholder="Enter new HSN Code"
                    autoFocus
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={addHsnCode}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 font-semibold"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GST (%)
              </label>
              <select
                value={gst}
                onChange={(e) => setGst(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="">Select GST</option>
                {GST_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Group & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group *
              </label>
              <div className="flex gap-2">
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  required
                >
                  <option value="">Select Group</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNewGroup("")}
                  className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-semibold"
                >
                  +
                </button>
              </div>
              {newGroup !== null && newGroup !== undefined && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
                    placeholder="Enter new group"
                    autoFocus
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={addGroup}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 font-semibold"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNewCategory("")}
                  className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-semibold"
                >
                  +
                </button>
              </div>
              {newCategory !== null && newCategory !== undefined && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Enter new category"
                    autoFocus
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={addCategory}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 font-semibold"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Item Type & Unit Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profit Margin (%)
              </label>
              <input
                type="number"
                value={profitMargin}
                onChange={(e) => setProfitMargin(e.target.value)}
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Type
              </label>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                {ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit Type
              </label>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                {UNIT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Variations Section */}
          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Variations</h3>
              <button
                type="button"
                onClick={addVariation}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Variation
              </button>
            </div>

            {variations.map((variation) => (
              <div
                key={variation.id}
                className="mb-6 p-4 border border-gray-200 rounded-lg"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Variation Value
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={variation.value}
                        onChange={(e) =>
                          updateVariation(variation.id, "value", e.target.value)
                        }
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                      >
                        <option value="">Select Variation</option>
                        {variationValues.map((val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setNewVariationValue("")}
                        className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-semibold"
                      >
                        +
                      </button>
                    </div>
                    {newVariationValue !== null &&
                      newVariationValue !== undefined && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={newVariationValue}
                            onChange={(e) =>
                              setNewVariationValue(e.target.value)
                            }
                            placeholder="e.g., 300 Gms, 1.5 L"
                            autoFocus
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                          <button
                            type="button"
                            onClick={addVariationValue}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 font-semibold"
                          >
                            Add
                          </button>
                        </div>
                      )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price
                    </label>
                    <input
                      type="number"
                      value={variation.price}
                      onChange={(e) =>
                        updateVariation(
                          variation.id,
                          "price",
                          parseFloat(e.target.value)
                        )
                      }
                      placeholder="0"
                      step="0.01"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SAP Code
                    </label>
                    <input
                      type="text"
                      value={variation.sapCode}
                      onChange={(e) =>
                        updateVariation(variation.id, "sapCode", e.target.value)
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Profit Margin (%)
                    </label>
                    <input
                      type="number"
                      value={variation.profitMargin}
                      onChange={(e) =>
                        updateVariation(
                          variation.id,
                          "profitMargin",
                          parseFloat(e.target.value)
                        )
                      }
                      step="0.01"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>
                </div>

                {/* Channel Prices */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Channel Prices
                    </label>
                    <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      Zomato & Swiggy: auto +15% (rounded to 5)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {CHANNELS.map((channel) => {
                      const isAutoCalculated = ["Zomato", "Swiggy"].includes(channel);
                      return (
                        <div key={channel}>
                          <label className="text-xs text-gray-600 block mb-1">
                            {channel}
                            {isAutoCalculated && <span className="text-blue-600 font-semibold"> (auto)</span>}
                          </label>
                          <input
                            type="number"
                            value={variation.channels[channel]}
                            onChange={(e) =>
                              updateChannelPrice(
                                variation.id,
                                channel,
                                parseFloat(e.target.value)
                              )
                            }
                            placeholder="0"
                            step="0.01"
                            disabled={isAutoCalculated}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 ${
                              isAutoCalculated ? "bg-blue-50 text-gray-500 cursor-not-allowed" : ""
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeVariation(variation.id)}
                  className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Image Upload */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Images</h3>
            <div className="mb-4 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-input"
              />
              <label htmlFor="image-input" className="cursor-pointer block">
                <p className="text-gray-700 font-medium">
                  Click to upload or drag images
                </p>
                <p className="text-gray-500 text-sm">PNG, JPG up to 10MB</p>
              </label>
            </div>

            {/* Image Previews */}
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={preview}
                      alt={`Preview ${idx}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 border-t pt-6">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/items/${itemId}`)}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
