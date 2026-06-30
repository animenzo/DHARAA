
import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import MqttStatusBadge from "./iot/MqttStatusBadge";   // ← Phase 10 addition
import {
  FaTachometerAlt,
  FaSeedling,
  FaCalendarAlt,
  FaUser,
  FaCloudSun,
  FaRobot,
  FaMicrochip,
  FaSignOutAlt,
} from "react-icons/fa";

const NAV_ITEMS = [
  { name: "Dashboard", path: "/iot", icon: FaTachometerAlt },
  { name: "Farms", path: "/farms", icon: FaSeedling },
  { name: "Schedules", path: "/schedules", icon: FaCalendarAlt },
  { name: "Weather", path: "/weather", icon: FaCloudSun },
  { name: "AI Advisor", path: "/ai-advisor", icon: FaRobot },
  // { name: "IoT Device", path: "/iot", icon: FaMicrochip },
  { name: "Profile", path: "/profile", icon: FaUser },
];

export default function SideBar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className={`flex flex-col h-full bg-white border-r border-gray-100
      transition-all duration-200 ${collapsed ? "w-16" : "w-56"}`}
    >
      {/* ── Logo area ──────────────────────────────────────────────────── */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌿</span>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-gray-800 leading-none">DHARAA</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Smart Irrigation</p>
            </div>
          )}
        </div>
        {/* Live connection badge — only visible when sidebar is expanded */}
        {/* {!collapsed && (
          <div className="mt-2">
            <MqttStatusBadge size="sm" />
          </div>
        )} */}
      </div>

      {/* ── Nav links ──────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {NAV_ITEMS.map(({ name, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
              ${isActive
                ? "bg-emerald-50 text-emerald-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"}`
            }
          >
            <Icon className="flex-shrink-0 text-base" />
            {!collapsed && <span>{name}</span>}
          </NavLink>
        ))}
      </nav>

      {/* ── Collapse toggle + Logout ───────────────────────────────────── */}
      <div className="px-2 py-4 border-t border-gray-100 space-y-1">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
            font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all"
        >
          <span className="text-base">{collapsed ? "→" : "←"}</span>
          {!collapsed && <span>Collapse</span>}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
            font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <FaSignOutAlt className="flex-shrink-0 text-base" />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );
}