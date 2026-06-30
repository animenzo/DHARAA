import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import toast, { Toaster } from "react-hot-toast";
import {
  FaTree,
  FaMapMarkerAlt,
  FaRulerCombined,
  FaWater,
  FaSeedling,
  FaLayerGroup,
  FaCheckCircle,
  FaEdit,
} from "react-icons/fa";
import { GiWaterTank } from "react-icons/gi";


// --- API Function ---
const createFarm = async (farmData) => {
  const response = await API.post("/farms/farm", farmData);
  return response.data;
};
const InputGroup = ({ label, icon: Icon, children }) => (
  <div className="flex flex-col space-y-2">
    <label className="text-sm font-semibold text-gray-600 flex items-center gap-2">
      {Icon && <Icon className="text-emerald-500" />} {label}
    </label>
    {children}
  </div>
);


const StyledInput = (props) => (
  <input
    {...props}
    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all duration-200 bg-gray-50 focus:bg-white"
  />
);

const asArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.soils)) return data.soils;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getSoilLabel = (soil) =>
  soil?.["Soil type"] ||
  soil?.soilType ||
  soil?.soil_type ||
  soil?.name ||
  "";

const FarmForm = ({ initialData, isEditMode = false }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLocating, setIsLocating] = useState(false);
  // const [newDeviceCredentials, setNewDeviceCredentials] = useState(null);
  // --- Form State ---
  const { data: crops = [] } = useQuery({
    queryKey: ["crops"],
    queryFn: API.getAllCrops,
  });

  const { data: soilsResponse = [] } = useQuery({
    queryKey: ["soils"],
    queryFn: API.getAllSoils,
  });
  const soils = asArray(soilsResponse);
  const [formData, setFormData] = useState({
    name: "",
    farmShape: "circle",

    farmDimensions: {
      diameter: "",
      length: "",
      width: ""
    },

    location: "",
    pincode: "",

    current_crop: "",      // ObjectId
    soilType: "",          // ObjectId

    irrigationMethod: "",

    dateOfSowing: "",

    mobileNumber: "",

    deviceId: "",

    coordinates: {
      lat: "",
      lng: ""
    },

    tankDetails: {
      type: "circle",
      dimensions: {
        diameter: "",
        length: "",
        width: "",
        height: ""
      }
    }
  });
  useEffect(() => {
    if (!initialData) return;

    setFormData({
      ...initialData,

      current_crop:
        initialData.current_crop?._id ||
        initialData.current_crop ||
        "",

      soilType:
        initialData.soilType?._id ||
        initialData.soilType ||
        "",

      farmShape:
        initialData.farmShape || "circle",

      farmDimensions:
        initialData.farmDimensions || {
          diameter: "",
          length: "",
          width: "",
        },

      coordinates:
        initialData.coordinates || {
          lat: "",
          lng: "",
        },

      tankDetails: {
        type:
          initialData.tankDetails?.type ||
          "circle",

        dimensions:
          initialData.tankDetails?.dimensions || {
            diameter: "",
            length: "",
            width: "",
            height: "",
          },
      },
    });
  }, [initialData]);

  // --- 2. UPDATED: Dynamic Mutation ---
  const mutation = useMutation({
    mutationFn: (data) => {
      // If editing, call updateFarm. If creating, call createFarm.
      return isEditMode
        ? API.updateFarm({ id: initialData._id, data })
        : createFarm(data);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries(["farms"]);

      if (isEditMode) {
        toast.success("Farm updated!");
        setTimeout(() => navigate("/farms"), 1200);
        return;
      }

      // result shape from createFarm: { farm, device: { deviceId, topics, authToken } }
      // authToken is ONLY present when a brand-new device was provisioned.
      // Hold the screen here so the farmer can copy it — it is never shown again.
      toast.success("Farm created!");
      navigate("/profile", {
        state: {
          ewFarmId: result.farm?._id,
        },
      });
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Operation failed";
      toast.error(message);
    },
  });

  // --- Handlers ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    // Handle nested coordinates
    if (name === "lat" || name === "lng") {
      setFormData((prev) => ({
        ...prev,
        coordinates: { ...prev.coordinates, [name]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleTankChange = (e) => {
    const { name, value } = e.target;
    if (name === "type") {
      setFormData((prev) => ({
        ...prev,
        tankDetails: { ...prev.tankDetails, type: value },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        tankDetails: {
          ...prev.tankDetails,
          dimensions: { ...prev.tankDetails.dimensions, [name]: value },
        },
      }));
    }
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // 1. Set Coordinates immediately
        setFormData((prev) => ({
          ...prev,
          coordinates: {
            lat: latitude.toFixed(6),
            lng: longitude.toFixed(6),
          },
        }));

        try {
          // 2. Call OpenStreetMap API to get address details
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          );
          const data = await response.json();

          if (data && data.address) {
            // Extract relevant details
            const village =
              data.address.village ||
              data.address.town ||
              data.address.city ||
              "";
            const district =
              data.address.state_district || data.address.county || "";
            const state = data.address.state || "";
            const pincode = data.address.postcode || "";

            // 3. Auto-fill Form Data
            setFormData((prev) => ({
              ...prev,
              location: `${village}, ${district}, ${state}`, // Formats as: "Rampur, Udaipur, Rajasthan"
              pincode: pincode,
            }));

            toast.success("Address & Pincode fetched!");
          }
        } catch (error) {
          console.error("Reverse Geocoding Failed", error);
          toast.error("Could not fetch address details.");
        }

        setIsLocating(false);
      },
      (error) => {
        console.error("Error fetching location:", error);
        toast.error("Unable to retrieve location.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true },
    );
  };

  const handleFarmDimensionChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      farmDimensions: {
        ...prev.farmDimensions,
        [name]: value,
      },
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (
      !formData.name ||
      !formData.current_crop ||
      !formData.soilType ||
      !formData.irrigationMethod ||
      !formData.dateOfSowing ||
      !formData.mobileNumber
    ) {
      toast.error("Name and Size are required!");
      return;
    }
    if (!isEditMode && !formData.deviceId.trim()) {
      toast.error("Device ID is required!");
      return;
    }
    mutation.mutate(formData);
  };

  // --- UI Helpers ---

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <Toaster position="top-right" />

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl flex items-center justify-center gap-3">
            {isEditMode ? (
              <FaEdit className="text-emerald-600" />
            ) : (
              <FaTree className="text-emerald-600" />
            )}
            {isEditMode ? "Edit Farm Details" : "Add New Farm"}
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            {isEditMode
              ? "Update your land information below."
              : "Register your land details to start monitoring."}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          {/* Progress Bar (Visual Only) */}
          <div className="h-2 bg-gray-100 w-full">
            <div className="h-full bg-emerald-500 w-1/3 rounded-r-full"></div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 sm:p-12 space-y-10">
            {/* SECTION 1: Basic Details */}
            <section>
              <h3 className="text-xl font-bold text-gray-800 border-b pb-2 mb-6 flex items-center gap-2">
                <FaLayerGroup className="text-emerald-500" /> Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label="Farm Name" icon={FaTree}>
                  <StyledInput
                    type="text"
                    name="name"
                    placeholder="e.g. Green Acres"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </InputGroup>

                <InputGroup
                  label="Farm Shape"
                  icon={FaRulerCombined}
                >
                  <select
                    name="farmShape"
                    value={formData.farmShape}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200"
                  >
                    <option value="circle">
                      Circle
                    </option>

                    <option value="rectangle">
                      Rectangle
                    </option>
                  </select>
                </InputGroup>

                {formData.farmShape === "circle" ? (
                  <InputGroup label="Diameter (meters)">
                    <StyledInput
                      type="number"
                      name="diameter"
                      value={formData.farmDimensions.diameter}
                      onChange={handleFarmDimensionChange}
                    />
                  </InputGroup>
                ) : (
                  <>
                    <InputGroup label="Length (meters)">
                      <StyledInput
                        type="number"
                        name="length"
                        value={formData.farmDimensions.length}
                        onChange={handleFarmDimensionChange}
                      />
                    </InputGroup>

                    <InputGroup label="Width (meters)">
                      <StyledInput
                        type="number"
                        name="width"
                        value={formData.farmDimensions.width}
                        onChange={handleFarmDimensionChange}
                      />
                    </InputGroup>
                  </>
                )}

                <InputGroup label="Location / Village" icon={FaMapMarkerAlt}>
                  <StyledInput
                    type="text"
                    name="location"
                    placeholder="e.g. Udaipur, Rajasthan"
                    value={formData.location}
                    onChange={handleChange}
                  />
                </InputGroup>
                {!isEditMode && (
                  <InputGroup label="ESP32 Device ID" icon={FaCheckCircle}>
                    <StyledInput
                      type="text"
                      name="deviceId"
                      placeholder="e.g. north-field-esp"
                      value={formData.deviceId}
                      onChange={handleChange}
                      pattern="[a-zA-Z0-9_-]+"
                      title="Letters, numbers, hyphens, and underscores only"
                      required
                    />
                    <p className="text-xs text-gray-400">
                      Choose any unique ID for your ESP32 — you'll flash this
                      same ID to your device's firmware. Cannot be changed later.
                    </p>
                  </InputGroup>
                )}
                <InputGroup label="Pincode" icon={FaMapMarkerAlt}>
                  <StyledInput
                    type="text"
                    name="pincode"
                    placeholder="e.g. 313001"
                    value={formData.pincode}
                    onChange={handleChange}
                  />
                </InputGroup>
              </div>
            </section>

            {/* SECTION 2: Crop & Soil */}
            <section>
              <h3 className="text-xl font-bold text-gray-800 border-b pb-2 mb-6 flex items-center gap-2">
                <FaSeedling className="text-emerald-500" /> Crop & Soil Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <select
                  name="current_crop"
                  value={formData.current_crop}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200"
                >
                  <option value="">
                    Select Crop
                  </option>

                  {crops.map((crop) => (
                    <option
                      key={crop._id}
                      value={crop._id}
                    >
                      {crop.Crop}
                    </option>
                  ))}
                </select>

                <select
                  name="soilType"
                  value={formData.soilType}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg border text-black bg-white border-gray-200"
                >
                  <option value="">
                    Select Soil Type
                  </option>

                  {soils.map((soil) => {
                    const label = getSoilLabel(soil);

                    return (
                    <option className="text-black bg-white"
                      style={{ color: "#111827", backgroundColor: "#ffffff" }}
                      key={soil._id}
                      value={soil._id}
                    >
                      {label || "Unnamed soil type"}
                    </option>
                    );
                  })}
                </select>


              </div>
               <InputGroup
  label="Irrigation Method"
  icon={FaWater}
>
  <select
    name="irrigationMethod"
    value={formData.irrigationMethod}
    onChange={handleChange}
    className="w-full px-4 py-3 rounded-lg border border-gray-200"
  >
    <option value="">
      Select Method
    </option>

    <option value="drip">
      Drip
    </option>

    <option value="sprinkler">
      Sprinkler
    </option>

    <option value="surface">
      Surface
    </option>
  </select>
</InputGroup>
<InputGroup
  label="Date Of Sowing"
  icon={FaSeedling}
>
  <StyledInput
    type="date"
    name="dateOfSowing"
    value={formData.dateOfSowing}
    onChange={handleChange}
    required
  />
</InputGroup>
<InputGroup
  label="Mobile Number"
>
  <StyledInput
    type="tel"
    name="mobileNumber"
    value={formData.mobileNumber}
    onChange={handleChange}
    required
  />
</InputGroup>
            </section>

            {/* SECTION 3: Water Tank */}
            <section className="bg-emerald-50/50 p-6 rounded-xl border border-emerald-100">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <GiWaterTank className="text-blue-500" /> Water Tank
                Configuration
              </h3>

              <div className="mb-6">
                <label className="text-sm font-semibold text-gray-600 block mb-2">
                  Tank Shape
                </label>
                <div className="flex gap-4">
                  {["circle", "rectangle"].map((type) => (
                    <label
                      key={type}
                      className={`flex-1 cursor-pointer py-3 px-4 rounded-lg border-2 text-center capitalize transition-all ${formData.tankDetails.type === type
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-bold"
                        : "border-gray-200 hover:border-emerald-200 text-gray-600"
                        }`}
                    >
                      <input
                        type="radio"
                        name="type"
                        value={type}
                        checked={formData.tankDetails.type === type}
                        onChange={handleTankChange}
                        className="hidden"
                      />
                      {type}
                    </label>
                  ))}
                </div>
               
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {formData.tankDetails.type === "circle" ? (
                  <>
                    <InputGroup label="Diameter (meters)">
                      <StyledInput
                        type="number"
                        name="diameter"
                        placeholder="0"
                        value={formData.tankDetails.dimensions.diameter}
                        onChange={handleTankChange}
                      />
                    </InputGroup>
                    <InputGroup label="Depth/Height (meters)">
                      <StyledInput
                        type="number"
                        name="height"
                        placeholder="0"
                        value={formData.tankDetails.dimensions.height}
                        onChange={handleTankChange}
                      />
                    </InputGroup>
                  </>
                ) : (
                  <>
                    <InputGroup label="Length (meters)">
                      <StyledInput
                        type="number"
                        name="length"
                        placeholder="0"
                        value={formData.tankDetails.dimensions.length}
                        onChange={handleTankChange}
                      />
                    </InputGroup>
                    <InputGroup label="Width (meters)">
                      <StyledInput
                        type="number"
                        name="width"
                        placeholder="0"
                        value={formData.tankDetails.dimensions.width}
                        onChange={handleTankChange}
                      />
                    </InputGroup>
                    <InputGroup label="Depth (meters)">
                      <StyledInput
                        type="number"
                        name="height"
                        placeholder="0"
                        value={formData.tankDetails.dimensions.height}
                        onChange={handleTankChange}
                      />
                    </InputGroup>
                  </>
                )}
              </div>
            </section>

            {/* SECTION 4: Coordinates (Optional) */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                  GPS Coordinates{" "}
                  <span className="text-xs font-normal text-gray-400">
                    (Optional)
                  </span>
                </h3>

                <button
                  type="button"
                  onClick={handleUseLocation}
                  disabled={isLocating}
                  className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline font-semibold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLocating ? (
                    <>
                      <svg
                        className="animate-spin h-3 w-3 text-emerald-600"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Locating...
                    </>
                  ) : (
                    <>
                      <FaMapMarkerAlt /> Use Current Location
                    </>
                  )}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <StyledInput
                  type="number"
                  name="lat"
                  placeholder="Latitude"
                  value={formData.coordinates.lat}
                  onChange={handleChange}
                />
                <StyledInput
                  type="number"
                  name="lng"
                  placeholder="Longitude"
                  value={formData.coordinates.lng}
                  onChange={handleChange}
                />
              </div>
            </section>

            {/* Submit Actions */}
            <div className="pt-6 flex items-center justify-end gap-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="px-6 py-3 rounded-lg text-gray-600 hover:bg-gray-100 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className={`
                    flex items-center gap-2 px-8 py-3 rounded-lg text-white font-bold shadow-lg shadow-emerald-500/30 transition-all transform active:scale-95
                    ${mutation.isPending ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-1"}
                  `}
              >
                {mutation.isPending ? (
                  "Processing..."
                ) : (
                  <>
                    {isEditMode ? <FaEdit /> : <FaCheckCircle />}
                    {isEditMode ? "Update Farm" : "Save Farm"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── One-time device credentials screen ──────────────────────────── */}
      {/* {newDeviceCredentials && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <FaCheckCircle className="text-emerald-500 text-2xl" />
              <h3 className="text-xl font-bold text-slate-800">Farm Created</h3>
            </div>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
              ⚠️ Copy this auth token now — it will not be shown again. Flash
              it to your ESP32 firmware along with the Device ID below.
            </p>

            <div className="space-y-3 mb-6">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Device ID</p>
                <code className="text-sm font-mono text-slate-800 break-all">
                  {newDeviceCredentials.deviceId}
                </code>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Auth Token</p>
                <code className="text-sm font-mono text-slate-800 break-all">
                  {newDeviceCredentials.authToken}
                </code>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 font-bold uppercase mb-1">MQTT Topics</p>
                <ul className="text-xs font-mono text-slate-600 space-y-0.5">
                  <li>Data: {newDeviceCredentials.topics?.data}</li>
                  <li>Status: {newDeviceCredentials.topics?.status}</li>
                  <li>Cmd: {newDeviceCredentials.topics?.cmd}</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => navigate("/farms")}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-all"
            >
              I've copied it — Continue to My Farms
            </button>
          </div>
        </div>
      )} */}
    </div>
  );
};

export default FarmForm;
