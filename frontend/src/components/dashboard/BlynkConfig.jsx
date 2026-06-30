// import React, { useState, useEffect } from "react";
// import { useMutation, useQueryClient } from "@tanstack/react-query";
// import API from "../../services/api";
// import toast, { Toaster } from "react-hot-toast";
// import {
//   FaWifi,
//   FaPlug,
//   FaCheckCircle,
//   FaExclamationTriangle,
//   FaEye,
//   FaEyeSlash,
// } from "react-icons/fa";

// const BlynkConfig = ({ isConfigured, existingToken }) => {
//   const [token, setToken] = useState("");
//   const [showToken, setShowToken] = useState(false);
//   const queryClient = useQueryClient();

//   // 1. Pre-fill the token if it exists (so it doesn't vanish)
//   useEffect(() => {
//     if (existingToken) {
//       setToken(existingToken);
//     }
//   }, [existingToken]);

//   const mutation = useMutation({
//     mutationFn: async (authToken) => {
//       return API.post("/device/config", { authToken });
//     },
//     onSuccess: () => {
//       toast.success("Device Connected Successfully!");
//       // 2. CRITICAL: Refetch the 'userProfile' query to update the UI instantly
//       queryClient.invalidateQueries(["userProfile"]);
//       queryClient.invalidateQueries(["dashboard"]);
//     },
//     onError: (error) => {
//       toast.error(error.response?.data?.message || "Connection Failed");
//     },
//   });

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     if (!token.trim()) return toast.error("Please enter a valid token");
//     mutation.mutate(token);
//   };

//   return (
//     <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
//       <Toaster position="top-right" />

//       {/* Header Status */}
//       <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
//         <div>
//           <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
//             <FaWifi className="text-emerald-500" /> IoT Configuration
//           </h2>
//           <p className="text-sm text-gray-500 mt-1">
//             Link your hardware to enable dashboard monitoring.
//           </p>
//         </div>

//         {/* Dynamic Badge */}
//         {isConfigured ? (
//           <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold uppercase rounded-full flex items-center gap-1">
//             <FaCheckCircle /> Connected
//           </span>
//         ) : (
//           <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold uppercase rounded-full flex items-center gap-1">
//             <FaExclamationTriangle /> Not Linked
//           </span>
//         )}
//       </div>

//       <div className="p-6">
//         <form onSubmit={handleSubmit} className="space-y-4">
//           <div>
//             <label className="block text-sm font-bold text-gray-700 mb-2">
//               Blynk Auth Token
//             </label>
//             <div className="relative">
//               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//                 <FaPlug className="text-gray-400" />
//               </div>

//               {/* Input Field with Masking */}
//               <input
//                 type={showToken ? "text" : "password"}
//                 value={token}
//                 onChange={(e) => setToken(e.target.value)}
//                 placeholder="Paste your 32-character token here..."
//                 className="w-full pl-10 pr-12 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all font-mono text-sm tracking-wide text-gray-700"
//               />

//               {/* Eye Icon to Show/Hide */}
//               <button
//                 type="button"
//                 onClick={() => setShowToken(!showToken)}
//                 className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
//               >
//                 {showToken ? <FaEyeSlash /> : <FaEye />}
//               </button>
//             </div>

//             <p className="text-xs text-gray-400 mt-2">
//               Found in Blynk App:{" "}
//               <span className="font-semibold">
//                 Settings {">"} Devices {">"} Device Info
//               </span>
//             </p>
//           </div>

//           <button
//             type="submit"
//             disabled={mutation.isPending}
//             className={`
//               w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all
//               ${
//                 mutation.isPending
//                   ? "bg-emerald-400 cursor-not-allowed"
//                   : "bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5 shadow-lg shadow-emerald-500/30"
//               }
//             `}
//           >
//             {mutation.isPending
//               ? "Connecting..."
//               : isConfigured
//                 ? "Update Token"
//                 : "Connect Device"}
//           </button>
//         </form>

//         {!isConfigured && (
//           <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
//             <FaExclamationTriangle className="text-amber-500 mt-0.5" />
//             <div>
//               <h4 className="text-sm font-bold text-amber-800">
//                 No Device Linked
//               </h4>
//               <p className="text-xs text-amber-700 mt-1">
//                 You must connect a device to see live data on your dashboard.
//               </p>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default BlynkConfig;


export default function BlynkConfig() {
  return null;
}
