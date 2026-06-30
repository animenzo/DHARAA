// frontend/src/components/iot/WaterTankCard.jsx
// Displays backend-calculated tank values. No tank math belongs in the UI.

import { GiWaterTank } from "react-icons/gi";

export default function WaterTankCard({
  percent = null,
  liters = null,
  isLoading = false,
}) {
  const pct = percent != null && Number.isFinite(Number(percent))
    ? Math.round(Number(percent))
    : null;
  const displayLiters = liters != null && Number.isFinite(Number(liters))
    ? Math.round(Number(liters))
    : null;

    console.log("percent",percent)
    console.log("litres",liters)


  if (isLoading) {
    return (
      <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm h-[340px] flex items-center justify-center">
        <div className="w-24 h-24 rounded-full bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between h-[340px] relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="z-10 flex justify-between items-start">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <GiWaterTank className="text-blue-500 text-xl" /> Tank Level
        </h3>
        <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-md">
          {displayLiters != null ? `${displayLiters}L` : "-"}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 w-full z-0 h-full overflow-hidden opacity-20 group-hover:opacity-30 transition-opacity">
        <style>{`@keyframes wave { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }`}</style>
        <div
          className="bg-blue-500 absolute w-[200%] h-[200%] rounded-[40%]"
          style={{
            bottom: `${(pct ?? 0) - 110}%`,
            animation: "wave 10s infinite linear",
          }}
        />
      </div>

      <div className="z-10 mt-auto text-center">
        <span className="text-6xl font-black text-slate-800 tracking-tighter">
          {pct != null ? `${pct}%` : "-"}
        </span>
        <p className="text-xs text-slate-400 font-bold uppercase mt-2">Current Water</p>
      </div>
    </div>
  );
}
