import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";
import UploadTab from "@/components/UploadTab";

const UPLOAD_TYPES = [
  { id: "petpooja", label: "Petpooja Upload", color: "from-purple-600 to-blue-600" },
  { id: "pain_lebs", label: "Pain Labs Upload", color: "from-blue-600 to-cyan-600" },
  { id: "website", label: "Website Upload", color: "from-cyan-600 to-green-600" }
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  const currentTab = UPLOAD_TYPES[activeTab];

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Data Upload Portal</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your data uploads efficiently</p>
        </div>
        <button
          onClick={() => navigate("/items")}
          className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg font-medium transition text-sm sm:text-base"
        >
          <Package className="w-4 h-4" />
          Items Page
        </button>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-2 sm:gap-4 mb-8 border-b border-gray-200 overflow-x-auto">
          {UPLOAD_TYPES.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(idx)}
              className={`px-3 sm:px-6 py-3 font-medium text-sm sm:text-base transition-all relative whitespace-nowrap ${
                activeTab === idx
                  ? "text-transparent bg-clip-text " + `bg-gradient-to-r ${tab.color}`
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
              {activeTab === idx && (
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${tab.color}`} />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <UploadTab type={currentTab.id} />
      </div>
    </div>
  );
}
