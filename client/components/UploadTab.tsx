import { useState, useEffect } from "react";
import { Upload, FileUp, AlertCircle, CheckCircle2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { UPLOAD_FORMATS, validateFileFormat } from "@shared/formats";
import type { UploadType } from "@shared/formats";
import UploadLoader from "./UploadLoader";
import ConfirmUploadDialog from "./ConfirmUploadDialog";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface MonthStatus {
  month: number;
  status: "uploaded" | "pending";
}

interface UploadTabProps {
  type: UploadType | string;
}

interface ValidationResult {
  validCount: number;
  invalidCount: number;
  validRows: any[];
  invalidRows: any[];
}

export default function UploadTab({ type }: UploadTabProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [monthsStatus, setMonthsStatus] = useState<MonthStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [fileData, setFileData] = useState<any>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isUpdatingExisting, setIsUpdatingExisting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [selectedValidRowIndices, setSelectedValidRowIndices] = useState<number[]>([]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  // Fetch month statuses when type or selectedYear changes
  useEffect(() => {
    const fetchMonthStatus = async () => {
      try {
        console.log(`Fetching month status for ${type} year ${selectedYear}`);

        const response = await fetch(`/api/uploads?type=${type}&year=${selectedYear}`);

        if (!response.ok) {
          console.warn(`API returned status ${response.status}`);
          setMonthsStatus(Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            status: "pending" as const
          })));
          return;
        }

        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          setMonthsStatus(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch month status:", error);
        // Set default pending status on fetch error - don't block UI
        setMonthsStatus(Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          status: "pending" as const
        })));
      }
    };

    fetchMonthStatus();
  }, [type, selectedYear]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result;
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          setMessage({ type: "error", text: "CSV/Excel file must contain at least header row and 1 row of data" });
          return;
        }

        // Get headers from first row
        const headers = jsonData[0] as string[];

        // Validate file format
        const validation = validateFileFormat(headers, type as UploadType);

        if (!validation.valid) {
          setMessage({
            type: "error",
            text: `Invalid file format. Missing columns: ${validation.missing.join(", ")}. Expected columns: ${UPLOAD_FORMATS[type as UploadType].requiredColumns.join(", ")}`
          });
          return;
        }

        const parsedFileData = {
          rows: jsonData.length - 1,
          columns: jsonData[0]?.length || 0,
          data: jsonData
        };

        setFileData(parsedFileData);
        setShowUploadForm(true);

        // Validate data against database
        if (type === "petpooja") {
          await validateData(jsonData);
        } else {
          setMessage(null);
        }
      } catch (error) {
        setMessage({ type: "error", text: "Failed to parse file. Please use valid CSV/Excel format." });
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const simulateProgress = (duration: number = 2000) => {
    setUploadProgress(0);
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 95);
      setUploadProgress(Math.round(progress));
      if (elapsed >= duration) {
        clearInterval(interval);
      }
    }, 100);
  };

  const validateData = async (data: any[]) => {
    try {
      setIsValidating(true);
      const response = await fetch("/api/upload/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data })
      });

      if (!response.ok) {
        const error = await response.json();
        setMessage({ type: "error", text: error.error || "Validation failed" });
        setIsValidating(false);
        return;
      }

      const result = await response.json();
      if (result.invalidCount > 0) {
        setValidationResult(result);
        // Select all valid rows by default
        setSelectedValidRowIndices(result.validRows.map((r: any) => r.rowIndex));
        setMessage({
          type: "warning",
          text: `Found ${result.invalidCount} invalid row(s) that will be removed on upload. Review and confirm below.`
        });
      } else {
        setValidationResult(null);
        setSelectedValidRowIndices([]);
        setMessage(null);
      }
      setIsValidating(false);
    } catch (error) {
      console.error("Validation error:", error);
      setMessage({ type: "error", text: "Failed to validate data" });
      setIsValidating(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedYear || !selectedMonth || !fileData) {
      setMessage({ type: "error", text: "Please select year, month and upload a file" });
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);
    setMessage(null);
    simulateProgress(2000);

    try {
      console.log("Starting upload for", type, selectedYear, selectedMonth);

      // Prepare upload body
      const uploadBody: any = {
        type,
        year: selectedYear,
        month: selectedMonth,
        rows: fileData.rows,
        columns: fileData.columns,
        data: fileData.data
      };

      // If there are invalid rows, pass the valid row indices
      if (validationResult && selectedValidRowIndices.length > 0) {
        uploadBody.validRowIndices = selectedValidRowIndices;
      }

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(uploadBody)
      });

      console.log("Upload response status:", response.status);

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error("Failed to parse response:", parseError);
        result = { error: "Invalid response from server" };
      }

      if (response.status === 409) {
        setIsLoading(false);
        setShowConfirmDialog(true);
        setMessage(null);
      } else if (response.ok) {
        setUploadProgress(100);
        setMessage({ type: "success", text: "Data uploaded successfully!" });
        setFileData(null);
        setSelectedMonth(null);
        setShowUploadForm(false);

        // Fetch updated status without timeout
        try {
          const statusResponse = await fetch(`/api/uploads?type=${type}&year=${selectedYear}`);
          if (statusResponse.ok) {
            const data = await statusResponse.json();
            if (data.data) {
              setMonthsStatus(data.data);
            }
          }
        } catch (statusError) {
          console.error("Failed to refresh status:", statusError);
        }

        // Auto-refresh page after 2 seconds
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        const errorText = result.error || `Upload failed with status ${response.status}`;
        console.error("Upload failed:", errorText);
        setMessage({ type: "error", text: errorText });
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Upload error:", error);
      setIsLoading(false);

      if (error instanceof TypeError && error.message === "Failed to fetch") {
        setMessage({
          type: "error",
          text: "Cannot connect to server. Please check your internet connection and try again."
        });
      } else {
        setMessage({
          type: "error",
          text: `Error: ${error instanceof Error ? error.message : "Unknown error during upload"}`
        });
      }
    }
  };

  const handleConfirmUpdate = async () => {
    if (!selectedYear || !selectedMonth || !fileData) {
      setMessage({ type: "error", text: "Please select year, month and upload a file" });
      return;
    }

    setIsUpdatingExisting(true);
    setUploadProgress(0);
    setMessage(null);
    simulateProgress(2000);

    try {
      console.log("Updating existing data for", type, selectedYear, selectedMonth);

      // Prepare update body
      const updateBody: any = {
        type,
        year: selectedYear,
        month: selectedMonth,
        rows: fileData.rows,
        columns: fileData.columns,
        data: fileData.data
      };

      // If there are invalid rows, pass the valid row indices
      if (validationResult && selectedValidRowIndices.length > 0) {
        updateBody.validRowIndices = selectedValidRowIndices;
      }

      const response = await fetch("/api/upload", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateBody)
      });

      console.log("Update response status:", response.status);

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error("Failed to parse response:", parseError);
        result = { error: "Invalid response from server" };
      }

      if (response.ok) {
        setUploadProgress(100);
        setShowConfirmDialog(false);
        setMessage({ type: "success", text: "Data updated successfully!" });
        setFileData(null);
        setSelectedMonth(null);
        setShowUploadForm(false);

        // Fetch updated status
        try {
          const statusResponse = await fetch(`/api/uploads?type=${type}&year=${selectedYear}`);
          if (statusResponse.ok) {
            const data = await statusResponse.json();
            if (data.data) {
              setMonthsStatus(data.data);
            }
          }
        } catch (statusError) {
          console.error("Failed to refresh status:", statusError);
        }

        // Auto-refresh page after 2 seconds
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        const errorText = result.error || `Update failed with status ${response.status}`;
        console.error("Update failed:", errorText);
        setMessage({ type: "error", text: errorText });
        setShowConfirmDialog(false);
        setIsUpdatingExisting(false);
      }
    } catch (error) {
      console.error("Update error:", error);
      setShowConfirmDialog(false);
      setIsUpdatingExisting(false);

      if (error instanceof TypeError && error.message === "Failed to fetch") {
        setMessage({
          type: "error",
          text: "Cannot connect to server. Please check your internet connection and try again."
        });
      } else {
        setMessage({
          type: "error",
          text: `Error: ${error instanceof Error ? error.message : "Unknown error during update"}`
        });
      }
    }
  };

  const getMonthStatus = (monthNum: number) => {
    return monthsStatus.find(m => m.month === monthNum)?.status || "pending";
  };

  const format = UPLOAD_FORMATS[type as UploadType];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Upload Loader Animation */}
      <UploadLoader isVisible={isLoading || isUpdatingExisting} progress={uploadProgress} />

      {/* Confirm Update Dialog */}
      <ConfirmUploadDialog
        isVisible={showConfirmDialog}
        month={selectedMonth ? MONTHS[selectedMonth - 1] : ""}
        year={selectedYear}
        onConfirm={handleConfirmUpdate}
        onCancel={() => {
          setShowConfirmDialog(false);
          setIsUpdatingExisting(false);
        }}
        isLoading={isUpdatingExisting}
      />

      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <Upload className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-900">Upload Data</h2>
        </div>

        {/* Year and Month Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
            <select
              value={selectedMonth || ""}
              onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              <option value="">-- Choose Month --</option>
              {MONTHS.map((month, idx) => (
                <option key={month} value={idx + 1}>{month}</option>
              ))}
            </select>
          </div>
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Upload CSV/Excel File</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-600 transition">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="file-input"
            />
            <label htmlFor="file-input" className="cursor-pointer">
              <FileUp className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-700 font-medium">Click to upload or drag & drop</p>
              <p className="text-gray-500 text-sm">CSV or Excel files</p>
            </label>
          </div>
        </div>

        {/* File Info */}
        {fileData && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">File loaded:</span> {fileData.rows} rows, {fileData.columns} columns
            </p>
          </div>
        )}

        {/* Validation Results */}
        {validationResult && validationResult.invalidCount > 0 && (
          <div className="mb-6 space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800">
                    {validationResult.invalidCount} row(s) found that don't match the database
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Only {validationResult.validCount} valid row(s) will be uploaded. Invalid rows are listed below.
                  </p>
                </div>
              </div>
            </div>

            {/* Invalid Rows List */}
            {validationResult.invalidRows.length > 0 && (
              <div className="border border-red-200 rounded-lg overflow-hidden">
                <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                  <p className="text-sm font-semibold text-red-900">Invalid Rows to be Removed</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {validationResult.invalidRows.map((row: any, idx: number) => (
                    <div key={idx} className="px-4 py-3 border-b border-red-100 last:border-b-0 hover:bg-red-50">
                      <div className="flex items-start gap-3">
                        <X className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm">
                          <p className="font-medium text-gray-900">Row {row.rowIndex}</p>
                          <p className="text-red-700 text-xs mt-1">{row.reason}</p>
                          <p className="text-gray-600 text-xs mt-1 font-mono truncate">
                            {row.data.slice(0, 3).join(" | ")}...
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex gap-3 ${
            message.type === "success" ? "bg-green-50 border border-green-200" :
            message.type === "error" ? "bg-red-50 border border-red-200" :
            "bg-yellow-50 border border-yellow-200"
          }`}>
            {message.type === "success" && <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />}
            {message.type === "error" && <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
            {message.type === "warning" && <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />}
            <p className={`text-sm ${
              message.type === "success" ? "text-green-700" :
              message.type === "error" ? "text-red-700" :
              "text-yellow-700"
            }`}>
              {message.text}
            </p>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={isLoading || !fileData || !selectedMonth}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? "Uploading..." : "Upload Data"}
        </button>
      </div>

      {/* Months Status Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Upload Status</h2>
          <p className="text-gray-500 text-sm mt-1">Status for {selectedYear}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Month</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((month, idx) => {
                const monthNum = idx + 1;
                const status = getMonthStatus(monthNum);
                const isUploaded = status === "uploaded";

                return (
                  <tr key={month} className="border-b border-gray-200 hover:bg-gray-50 transition">
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 font-medium">{month}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                        isUploaded
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {isUploaded ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Uploaded
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 rounded-full bg-gray-400" />
                            Pending
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
