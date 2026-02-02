import { useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

const CHANNELS = ["Dining", "Parcale", "Swiggy", "Zomato"];
const ITEMS_PER_PAGE = 5;

interface ItemsTableProps {
  items: any[];
}

export default function ItemsTable({ items }: ItemsTableProps) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const startIdx = currentPage * ITEMS_PER_PAGE;
  const paginatedItems = items.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const allVariations = Array.from(
    new Set(
      items.flatMap((item) =>
        item.variations.map((v: any) => JSON.stringify({ name: v.name, value: v.value }))
      )
    )
  ).map((v) => JSON.parse(v));

  const toggleRowSelection = (itemId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedRows(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === paginatedItems.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedItems.map((item) => item.itemId)));
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No items added yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Table Header */}
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {/* Checkbox */}
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={
                    paginatedItems.length > 0 &&
                    selectedRows.size === paginatedItems.length
                  }
                  onChange={toggleSelectAll}
                  className="w-4 h-4"
                />
              </th>

              {/* Basic Info */}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 bg-gray-100 sticky left-0 z-10">
                Item ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 bg-gray-100 sticky left-20 z-10">
                Group
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 bg-gray-100 sticky left-48 z-10">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 bg-gray-100 sticky left-96 z-10">
                Item Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 bg-gray-100">
                Description
              </th>

              {/* Variation Columns */}
              {allVariations.map((variation) => (
                <th
                  key={`${variation.name}-${variation.value}`}
                  colSpan={CHANNELS.length}
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-700 border-l border-gray-200"
                >
                  {variation.value}
                </th>
              ))}
            </tr>

            {/* Sub-header for Channels */}
            {allVariations.length > 0 && (
              <tr className="bg-gray-50 border-b border-gray-200">
                <th colSpan={5} className="sticky left-0 z-10"></th>
                {allVariations.map((variation) => (
                  <React.Fragment key={`${variation.name}-${variation.value}`}>
                    {CHANNELS.map((channel) => (
                      <th
                        key={`${variation.value}-${channel}`}
                        className="px-4 py-3 text-center text-xs font-medium text-gray-600 border-l border-gray-200"
                      >
                        {channel}
                      </th>
                    ))}
                  </React.Fragment>
                ))}
              </tr>
            )}
          </thead>

          {/* Table Body */}
          <tbody>
            {paginatedItems.map((item, idx) => (
              <tr
                key={item.itemId}
                onClick={() => navigate(`/items/${item.itemId}`)}
                className={`border-b border-gray-200 hover:bg-gray-50 transition cursor-pointer ${
                  selectedRows.has(item.itemId) ? "bg-blue-50" : ""
                }`}
              >
                {/* Checkbox */}
                <td className="px-4 py-3 text-center w-10" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedRows.has(item.itemId)}
                    onChange={() => toggleRowSelection(item.itemId)}
                    className="w-4 h-4"
                  />
                </td>

                {/* Basic Info */}
                <td className="px-4 py-3 text-sm text-gray-900 font-medium bg-gray-50 sticky left-0 z-10">
                  {item.itemId}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 bg-gray-50 sticky left-20 z-10">
                  {item.group}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 bg-gray-50 sticky left-48 z-10">
                  {item.category}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 font-medium bg-gray-50 sticky left-96 z-10">
                  {item.itemName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                  {item.description}
                </td>

                {/* Variation Prices */}
                {allVariations.map((variation) => {
                  const itemVariation = item.variations.find(
                    (v: any) =>
                      v.name === variation.name && v.value === variation.value
                  );

                  return (
                    <React.Fragment
                      key={`${item.itemId}-${variation.value}`}
                    >
                      {CHANNELS.map((channel) => (
                        <td
                          key={`${item.itemId}-${variation.value}-${channel}`}
                          className="px-4 py-3 text-center text-sm font-medium text-gray-900 border-l border-gray-200"
                        >
                          {itemVariation
                            ? `₹${itemVariation.channels[channel] || "-"}`
                            : "-"}
                        </td>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with Pagination */}
      <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {selectedRows.size > 0 && (
            <span className="font-medium">{selectedRows.size} selected · </span>
          )}
          Showing {startIdx + 1} to{" "}
          {Math.min(startIdx + ITEMS_PER_PAGE, items.length)} of {items.length}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx)}
                className={`w-8 h-8 rounded-lg font-medium transition ${
                  currentPage === idx
                    ? "bg-purple-600 text-white"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
            className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
