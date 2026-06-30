import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./SideBar";
import { FaBars } from "react-icons/fa";

const DashboardLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* 1. Sidebar Component */}
      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
        {/* Mobile Header (Only visible on small screens) */}
        <header className="lg:hidden bg-white h-16 border-b flex items-center justify-between px-4 shrink-0">
          <div className="font-bold text-lg text-emerald-800">DHARAA</div>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <FaBars size={24} />
          </button>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {/* The actual page (Dashboard, FarmList, etc.) renders here */}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
