import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Edit, RotateCcw } from "lucide-react";
import SalesSummaryCards from "@/components/ItemDetail/SalesSummaryCards";
import DateFilter from "@/components/ItemDetail/DateFilter";
import SalesDataTable from "@/components/ItemDetail/SalesDataTable";
import SalesCharts from "@/components/ItemDetail/SalesCharts";

console.log("📄 ItemDetail module loaded");

export default function ItemDetail() {
  console.log("🎯 ItemDetail component rendering");
  const params = useParams<{ itemId: string }>();
  const itemId = params.itemId;
  const navigate = useNavigate();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "sales">("details");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const [restaurants, setRestaurants] = useState<string[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Debug logging
  console.log("🔧 ItemDetail mounted, params:", params, "itemId:", itemId);

  // Fetch unique restaurants
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setRestaurantsLoading(true);
        console.log("🔄 Fetching restaurants from /api/sales/restaurants");
        const response = await fetch("/api/sales/restaurants");

        if (!response.ok) {
          console.error(`❌ Restaurants API returned ${response.status}: ${response.statusText}`);
          // Try to get error details
          const errorText = await response.text();
          console.error("Error details:", errorText);
          return;
        }

        const result = await response.json();
        console.log("✅ Restaurants API response:", result);

        if (result.success && Array.isArray(result.data)) {
          setRestaurants(result.data);
          console.log(`📝 Found ${result.data.length} restaurants:`, result.data);
          // Set first restaurant as default if available
          if (result.data.length > 0 && !selectedRestaurant) {
            setSelectedRestaurant(result.data[0]);
          }
        } else {
          console.warn("⚠️ Unexpected response format:", result);
        }
      } catch (error) {
        console.error("❌ Failed to fetch restaurants:", error);
        console.error("Error details:", error instanceof Error ? error.message : String(error));
      } finally {
        setRestaurantsLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log(`🔍 Fetching item with ID: "${itemId}"`);

        // Fetch all items and find the one we need with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch("/api/items", { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ API returned ${response.status}: ${response.statusText}`);
          console.error("Response:", errorText);
          throw new Error(`Failed to fetch items: ${response.status} ${response.statusText}`);
        }

        const items = await response.json();

        if (!Array.isArray(items)) {
          console.error("❌ Invalid response format, expected array but got:", typeof items);
          throw new Error("Invalid response format from server");
        }

        console.log(`📦 Received ${items.length} items from API`);
        console.log("Available item IDs:", items.map((i: any) => i.itemId).join(", "));

        const foundItem = items.find((i: any) => i.itemId === itemId);

        if (!foundItem) {
          console.error(`❌ Item with ID "${itemId}" not found in database`);
          setError(`Item with ID "${itemId}" not found. Make sure you've created this item first.`);
          setItem(null);
        } else {
          console.log(`✅ Found item: ${foundItem.itemName}`);
          setItem(foundItem);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch item";
        console.error("❌ Error fetching item:", errorMessage);
        console.error("Full error:", error);
        setError(errorMessage);
        setItem(null);
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [itemId]);

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        const response = await fetch(`/api/items/${itemId}`, {
          method: "DELETE",
        });
        if (response.ok) {
          navigate("/items");
        }
      } catch (error) {
        console.error("Failed to delete item:", error);
      }
    }
  };

  const handleResetSalesData = async () => {
    try {
      setIsResetting(true);
      const response = await fetch(`/api/sales/item/${itemId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${result.message}`);
        setShowResetConfirm(false);
        // Refresh the page to show updated data
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`❌ Failed to reset data: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to reset sales data:", error);
      alert("❌ Error resetting sales data");
    } finally {
      setIsResetting(false);
    }
  };

  // Fetch real sales data from API
  const [salesData, setSalesData] = useState<any>(null);
  const [salesLoading, setSalesLoading] = useState(false);

  useEffect(() => {
    const fetchSalesData = async () => {
      if (!itemId || !dateRange.start || !dateRange.end) {
        setSalesData(null);
        return;
      }

      try {
        setSalesLoading(true);
        const url = new URL(`/api/sales/item/${itemId}`, window.location.origin);
        url.searchParams.set("startDate", dateRange.start);
        url.searchParams.set("endDate", dateRange.end);
        if (selectedRestaurant) {
          url.searchParams.set("restaurant", selectedRestaurant);
        }

        console.log(`🔄 Fetching sales data: ${url.toString()}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch(url.toString(), { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Sales API returned ${response.status}: ${response.statusText}`);
          console.error("Error details:", errorText);
          return;
        }

        const result = await response.json();
        console.log("✅ Sales data response:", result);

        if (result.success && result.data) {
          // The server now returns pre-aggregated data!
          const data = result.data;
          console.log("✅ Pre-aggregated data from server:", {
            monthlyData: data.monthlyData?.length || 0,
            dateWiseData: data.dateWiseData?.length || 0,
            restaurantSales: Object.keys(data.restaurantSales || {}).length,
          });

          // Transform monthly data from YYYY-MM format to month names
          const monthlyData = (data.monthlyData || []).map((item: any) => {
            const [year, month] = item.month.split("-");
            const monthNum = parseInt(month) - 1;
            const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][monthNum];
            return {
              month: monthName,
              zomatoQty: item.zomatoQty || 0,
              swiggyQty: item.swiggyQty || 0,
              diningQty: item.diningQty || 0,
              parcelQty: item.parcelQty || 0,
              totalQty: item.totalQty || 0,
            };
          });

          // Use pre-aggregated date-wise data
          const dateWiseDataWithTotals = (data.dateWiseData || []).map((item: any) => ({
            date: item.date,
            zomatoQty: item.zomatoQty || 0,
            swiggyQty: item.swiggyQty || 0,
            diningQty: item.diningQty || 0,
            parcelQty: item.parcelQty || 0,
            totalQty: item.totalQty || 0,
          }));

          const restaurantSales = data.restaurantSales || {};

          // Create sales data table from aggregated area data
          const salesTableData: any[] = [];
          const addedVariations = new Set<string>();
          const allVariations = new Set<string>();

          // Collect all variation names
          [data.zomatoData, data.swiggyData, data.diningData, data.parcelData].forEach((areaData: any) => {
            if (areaData?.variations) {
              areaData.variations.forEach((v: any) => allVariations.add(v.name));
            }
          });

          // Build table rows
          allVariations.forEach((variationName) => {
            if (!addedVariations.has(variationName)) {
              addedVariations.add(variationName);
              const zomatoVar = data.zomatoData?.variations?.find((v: any) => v.name === variationName);
              const swiggyVar = data.swiggyData?.variations?.find((v: any) => v.name === variationName);
              const diningVar = data.diningData?.variations?.find((v: any) => v.name === variationName);
              const parcelVar = data.parcelData?.variations?.find((v: any) => v.name === variationName);

              salesTableData.push({
                variationName,
                sapCode: variationName,
                zomato: {
                  quantity: zomatoVar?.quantity || 0,
                  value: zomatoVar?.value || 0,
                },
                swiggy: {
                  quantity: swiggyVar?.quantity || 0,
                  value: swiggyVar?.value || 0,
                },
                dining: {
                  quantity: diningVar?.quantity || 0,
                  value: diningVar?.value || 0,
                },
                parcel: {
                  quantity: parcelVar?.quantity || 0,
                  value: parcelVar?.value || 0,
                },
                total: {
                  quantity: (zomatoVar?.quantity || 0) + (swiggyVar?.quantity || 0) + (diningVar?.quantity || 0) + (parcelVar?.quantity || 0),
                  value: (zomatoVar?.value || 0) + (swiggyVar?.value || 0) + (diningVar?.value || 0) + (parcelVar?.value || 0),
                },
              });
            }
          });

          setSalesData({
            monthlyData,
            dateWiseData: dateWiseDataWithTotals,
            zomatoData: data.zomatoData || { quantity: 0, value: 0, variations: [] },
            swiggyData: data.swiggyData || { quantity: 0, value: 0, variations: [] },
            diningData: data.diningData || { quantity: 0, value: 0, variations: [] },
            parcelData: data.parcelData || { quantity: 0, value: 0, variations: [] },
            salesTableData,
            restaurantSales,
          });
        }
      } catch (error) {
        console.error("Error fetching sales data:", error);
        setSalesData(null);
      } finally {
        setSalesLoading(false);
      }
    };

    fetchSalesData();
  }, [itemId, dateRange, selectedRestaurant]);

  if (loading) {
    return (
      <div className="flex-1 p-6 sm:p-8">
        <button
          onClick={() => navigate("/items")}
          className="flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Items
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">Loading item details...</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
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
          <div className="text-red-600 mb-6">
            <p className="font-semibold text-lg">⚠️ Item Not Found</p>
            <p className="text-sm mt-2">{error || "Item not found"}</p>
            <p className="text-xs mt-2 text-red-500 font-mono bg-red-50 p-2 rounded">
              Looking for ID: {itemId}
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-900 mb-2">
              <strong>Common causes:</strong>
            </p>
            <ul className="text-sm text-yellow-800 space-y-1 ml-4 list-disc">
              <li>The item might not be properly saved in the database</li>
              <li>MongoDB connection might be failing</li>
              <li>The item ID might have changed</li>
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-900 mb-2">
              <strong>What to do:</strong>
            </p>
            <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
              <li>Open browser console (F12) and check for error messages</li>
              <li>Go back to Items list and create a new item</li>
              <li>Check if MongoDB is accessible and working</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate("/items")}
              className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition"
            >
              Return to Items List
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  const CHANNELS = ["Dining", "Parcale", "Swiggy", "Zomato", "GS1"];

  return (
    <div className="flex-1 p-6 sm:p-8">
      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 rounded-lg">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Reset Sales Data?</h2>
            <p className="text-gray-600 mb-6">
              This will permanently delete all sales history for <strong>{item?.itemName}</strong> across all variations. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetSalesData}
                disabled={isResetting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isResetting ? "Resetting..." : "Reset Data"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back Button */}
      <button
        onClick={() => navigate("/items")}
        className="flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Items
      </button>

      {/* Header with Tabs */}
      <div className="bg-white rounded-t-xl border border-gray-200 border-b-0 p-6 mb-0">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{item.itemName}</h1>
            <p className="text-gray-600">{item.description}</p>
          </div>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-blue-50 rounded-lg transition text-blue-600">
              <Edit className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="p-2 hover:bg-yellow-50 rounded-lg transition text-yellow-600"
              title="Reset sales data"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 hover:bg-red-50 rounded-lg transition text-red-600"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-t border-gray-200 pt-4 mt-4">
          <button
            onClick={() => setActiveTab("details")}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === "details"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Item Details
          </button>
          <button
            onClick={() => setActiveTab("sales")}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === "sales"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Sales Information
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-xl border border-gray-200 border-t-0 p-6">
        {activeTab === "details" ? (
          /* Details Tab Content */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Section - Images */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {item.images && item.images.length > 0 ? (
                  <div className="space-y-2 p-4">
                    <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                      <img
                        src={item.images[0]}
                        alt={item.itemName}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                    {item.images.length > 1 && (
                      <div className="grid grid-cols-3 gap-2">
                        {item.images.slice(1).map((img: string, idx: number) => (
                          <div
                            key={idx}
                            className="w-full h-20 bg-gray-100 rounded-lg flex items-center justify-center"
                          >
                            <img
                              src={img}
                              alt={`${item.itemName} ${idx + 2}`}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                    No images
                  </div>
                )}
              </div>
            </div>

            {/* Right Section - Item Info */}
            <div className="lg:col-span-2">
              {/* Basic Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Item ID
                  </p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {item.itemId}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Short Code
                  </p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {item.shortCode}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Group
                  </p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {item.group}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Category
                  </p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {item.category}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Item Type
                  </p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {item.itemType}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Unit Type
                  </p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {item.unitType}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    HSN Code
                  </p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {item.hsnCode || "-"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    GST (%)
                  </p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {item.gst || 0}%
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Profit Margin (%)
                  </p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {item.profitMargin || 0}%
                  </p>
                </div>
              </div>

              {/* Variations Section */}
              {item.variations && item.variations.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Variations
                  </h2>

                  <div className="space-y-4">
                    {item.variations.map((variation: any, idx: number) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              Variation Value
                            </p>
                            <p className="text-base font-semibold text-gray-900 mt-1">
                              {variation.value}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              Price
                            </p>
                            <p className="text-base font-semibold text-gray-900 mt-1">
                              ₹{variation.price}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              SAP Code
                            </p>
                            <p className="text-base font-semibold text-gray-900 mt-1">
                              {variation.sapCode || "-"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              Profit Margin (%)
                            </p>
                            <p className="text-base font-semibold text-gray-900 mt-1">
                              {variation.profitMargin || 0}%
                            </p>
                          </div>
                        </div>

                        {/* Channel Prices */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
                            Channel Prices
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {CHANNELS.map((channel) => (
                              <div
                                key={channel}
                                className="bg-gray-50 rounded-lg p-3 text-center"
                              >
                                <p className="text-xs text-gray-600 mb-1">
                                  {channel}
                                </p>
                                <p className="text-base font-bold text-gray-900">
                                  ₹{variation.channels[channel] || "-"}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Sales Tab Content */
          <div className="space-y-6">
            {/* Restaurant & Date Filter */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Restaurant
                </label>
                <select
                  value={selectedRestaurant}
                  onChange={(e) => setSelectedRestaurant(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={restaurantsLoading || restaurants.length === 0}
                >
                  <option value="">All Restaurants</option>
                  {restaurants.map((restaurant) => (
                    <option key={restaurant} value={restaurant}>
                      {restaurant}
                    </option>
                  ))}
                </select>
              </div>

              <DateFilter
                onDateRangeChange={(start, end) => {
                  setDateRange({ start, end });
                }}
              />
            </div>

            {/* Sales Summary Cards */}
            {salesLoading ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <p className="text-blue-900">Loading sales data...</p>
              </div>
            ) : salesData ? (
              <>
                <SalesSummaryCards
                  zomatoData={salesData.zomatoData}
                  swiggyData={salesData.swiggyData}
                  diningData={salesData.diningData}
                  parcelData={salesData.parcelData}
                />

                {/* Sales Data Table */}
                <SalesDataTable
                  data={salesData.salesTableData}
                  itemName={item.itemName}
                />

                {/* Sales Charts */}
                <SalesCharts
                  monthlyData={salesData.monthlyData}
                  dateWiseData={salesData.dateWiseData}
                  restaurantSales={salesData.restaurantSales}
                />
              </>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <p className="text-yellow-900">
                  {dateRange.start && dateRange.end
                    ? "No sales data found for the selected date range"
                    : "Please select a date range to view sales data"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
