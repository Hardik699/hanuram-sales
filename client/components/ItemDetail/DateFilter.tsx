import { useState, useEffect } from "react";
import { Calendar } from "lucide-react";

interface DateFilterProps {
  onDateRangeChange: (startDate: string, endDate: string) => void;
}

export default function DateFilter({ onDateRangeChange }: DateFilterProps) {
  // Default to last 365 days to capture more data
  const [startDate, setStartDate] = useState(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Call the callback on component mount with initial dates
  useEffect(() => {
    onDateRangeChange(startDate, endDate);
  }, [startDate, endDate]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value;
    setStartDate(newStartDate);
    onDateRangeChange(newStartDate, endDate);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndDate = e.target.value;
    setEndDate(newEndDate);
    onDateRangeChange(startDate, newEndDate);
  };

  const handlePresetRange = (days: number) => {
    const newEndDate = new Date().toISOString().split('T')[0];
    const newStartDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    onDateRangeChange(newStartDate, newEndDate);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-bold text-gray-900">Date Range</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Start Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={handleStartDateChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={handleEndDateChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>

        {/* Summary */}
        <div className="flex items-end">
          <div className="bg-purple-50 rounded-lg p-3 w-full">
            <p className="text-xs font-semibold text-purple-700 uppercase">Selected Range</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {startDate} to {endDate}
            </p>
          </div>
        </div>
      </div>

      {/* Preset Buttons */}
      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase mb-3">Quick Select</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handlePresetRange(7)}
            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition"
          >
            Last 7 days
          </button>
          <button
            onClick={() => handlePresetRange(30)}
            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition"
          >
            Last 30 days
          </button>
          <button
            onClick={() => handlePresetRange(90)}
            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition"
          >
            Last 90 days
          </button>
          <button
            onClick={() => handlePresetRange(365)}
            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition"
          >
            Last Year
          </button>
        </div>
      </div>
    </div>
  );
}
