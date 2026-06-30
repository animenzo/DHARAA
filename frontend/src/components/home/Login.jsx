import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../../services/api";
import { useAuth } from "../../context/AuthContext";

function Login() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isRightPanelActive, setIsRightPanelActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const [signupData, setSignupData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  // --- Handlers ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await API.post("/auth/login", loginData);
      login(res.data.token, res.data.user);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Login failed. Please check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await API.post("/auth/signup", signupData);
      // Auto-login after signup
      const res = await API.post("/auth/login", {
        email: signupData.email,
        password: signupData.password,
      });
      login(res.data.token, res.data.user);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || "Signup failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };
   const handleGoHome = ()=>{
    navigate("/home")
   }

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-green-50 to-green-100 font-poppins p-4">
      {/* Error Alert */}
       <button onClick={handleGoHome} style={{
              background: "#10b981", color: "#030f0a", border: "none",
              padding: "12px 28px", borderRadius: 30, fontSize: 14, fontWeight: 600,
              cursor: "pointer", letterSpacing: "0.01em", marginBottom:"10px"
            }}>
              Home →
            </button>
      {error && (
        <div className="absolute top-6 z-50 animate-bounce">
          <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-3 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Main Card Container */}
      <div
        className={`relative bg-white rounded-[20px] shadow-2xl overflow-hidden w-full max-w-2xl min-h-[600px] flex flex-col md:block transition-all duration-300`}
      >
        {/* --- Sign Up Form Container --- */}
        <div
          className={`absolute top-0 h-full transition-all duration-700 ease-in-out left-0 w-full md:w-1/2 
          ${
            isRightPanelActive
              ? "opacity-100 z-20 md:translate-x-full pointer-events-auto"
              : "opacity-0 z-0 md:opacity-0 pointer-events-none"
          }`}
        >
          <form
            onSubmit={handleSignup}
            className="bg-white flex flex-col items-center justify-center h-full px-8 md:px-12 text-center"
          >
            <h1 className="font-bold text-3xl text-gray-800 mb-6 tracking-tight">
              Create Account
            </h1>

            <span className="text-gray-400 text-sm mb-6">
              Use your email for registration
            </span>

            <div className="w-full flex flex-col gap-4">
              <input
                type="text"
                placeholder="Name"
                value={signupData.name}
                onChange={(e) =>
                  setSignupData({ ...signupData, name: e.target.value })
                }
                className="bg-gray-50 border border-gray-200 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all"
              />
              <input
                type="email"
                placeholder="Email"
                value={signupData.email}
                onChange={(e) =>
                  setSignupData({ ...signupData, email: e.target.value })
                }
                className="bg-gray-50 border border-gray-200 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all"
              />
              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={signupData.password}
                  onChange={(e) =>
                    setSignupData({ ...signupData, password: e.target.value })
                  }
                  className="bg-gray-50 border border-gray-200 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              className="mt-8 rounded-full bg-green-600 text-white text-xs font-bold py-3 px-12 uppercase tracking-widest hover:bg-green-700 active:scale-95 transition-all shadow-lg shadow-green-600/30"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating..." : "Sign Up"}
            </button>

            {/* Mobile Toggle */}
            <div className="md:hidden mt-8 text-sm text-gray-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setIsRightPanelActive(false)}
                className="text-green-600 font-bold hover:underline"
              >
                Sign In
              </button>
            </div>
          </form>
        </div>

        {/* --- Sign In Form Container --- */}
        <div
          className={`absolute top-0 h-full transition-all duration-700 ease-in-out left-0 w-full md:w-1/2 z-10
          ${
            isRightPanelActive
              ? "md:translate-x-full opacity-0 pointer-events-none"
              : "translate-x-0 opacity-100 pointer-events-auto"
          }`}
        >
          <form
            onSubmit={handleLogin}
            className="bg-white flex flex-col items-center justify-center h-full px-8 md:px-12 text-center"
          >
            <h1 className="font-bold text-3xl text-gray-800 mb-6 tracking-tight">
              Sign in
            </h1>

            <span className="text-gray-400 text-sm mb-6">
              Welcome back to your dashboard
            </span>

            <div className="w-full flex flex-col gap-4">
              <input
                type="email"
                placeholder="Email"
                value={loginData.email}
                onChange={(e) =>
                  setLoginData({ ...loginData, email: e.target.value })
                }
                className="bg-gray-50 border border-gray-200 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all"
              />
              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                  className="bg-gray-50 border border-gray-200 p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <Link
              to="/forgot-password"
              className="text-sm text-gray-500 hover:text-green-600 mt-4 mb-8 transition-colors"
            >
              Forgot your password?
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-green-600 text-white text-xs font-bold py-3 px-12 uppercase tracking-widest hover:bg-green-700 active:scale-95 transition-all shadow-lg shadow-green-600/30"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            {/* Mobile Toggle */}
            <div className="md:hidden mt-8 text-sm text-gray-500">
              New here?{" "}
              <button
                type="button"
                onClick={() => setIsRightPanelActive(true)}
                className="text-green-600 font-bold hover:underline"
              >
                Sign Up
              </button>
            </div>
          </form>
        </div>

        {/* --- Overlay / Slider (Desktop Only) --- */}
        <div
          className={`hidden md:block absolute top-0 left-1/2 w-1/2 h-full overflow-hidden transition-transform duration-700 ease-in-out z-30 
          ${isRightPanelActive ? "-translate-x-full" : ""}`}
        >
          <div
            className={`relative -left-full h-full w-[200%] transform transition-transform duration-700 ease-in-out 
            bg-gradient-to-r from-emerald-600 to-green-500 text-white
            ${isRightPanelActive ? "translate-x-1/2" : "translate-x-0"}`}
          >
            {/* Left Overlay (Shown when panel is active/right - prompts Sign In) */}
            <div
              className={`absolute top-0 flex flex-col items-center justify-center h-full w-1/2 transform transition-transform duration-700 ease-in-out ${isRightPanelActive ? "translate-x-0" : "-translate-x-[20%]"}`}
            >
              <h1 className="font-bold text-3xl mb-4">Welcome Back!</h1>
              <p className="text-sm font-light leading-relaxed px-12 mb-8 opacity-90">
                To keep connected with your farm's progress, please login with
                your personal info.
              </p>
              <button
                className="rounded-full border-2 border-white bg-transparent text-white text-xs font-bold py-3 px-12 uppercase tracking-widest hover:bg-white hover:text-green-600 transition-all active:scale-95"
                onClick={() => setIsRightPanelActive(false)}
              >
                Sign In
              </button>
            </div>

            {/* Right Overlay (Shown when panel is inactive/left - prompts Sign Up) */}
            <div
              className={`absolute top-0 right-0 flex flex-col items-center justify-center h-full w-1/2 transform transition-transform duration-700 ease-in-out ${isRightPanelActive ? "translate-x-[20%]" : "translate-x-0"}`}
            >
              <h1 className="font-bold text-3xl mb-4">New Harvest?</h1>
              <p className="text-sm font-light leading-relaxed px-12 mb-8 opacity-90">
                Enter your details and start your journey with our modern
                farming platform.
              </p>
              <button
                className="rounded-full border-2 border-white bg-transparent text-white text-xs font-bold py-3 px-12 uppercase tracking-widest hover:bg-white hover:text-green-600 transition-all active:scale-95"
                onClick={() => setIsRightPanelActive(true)}
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
