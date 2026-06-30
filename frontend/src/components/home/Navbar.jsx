import React, { useState, useEffect } from "react";
import { FiMenu, FiX, FiArrowRight } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const handleGetStarted = () => {
    navigate("/login");
    setIsMobileMenuOpen(false);
  };

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "How platform works?", href: "/howitworks" },
    { name: "AgriInfo", href: "/agriinfo" },
    // { name: "Impact", href: "#" },
    // { name: "About", href: "#" },
  ];

  return (
    <nav className="fixed top-0 left-0 w-full z-50 transition-all duration-300  bg-transparent py-6">
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">
        {/* LOGO */}
        <div className="flex items-center gap-2 cursor-pointer z-50">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <span className="text-neutral-900 font-bold text-xl">D</span>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            DHARAA
          </span>
        </div>

        {/* DESKTOP NAV */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-white/70 hover:text-white transition-colors"
            >
              {link.name}
            </a>
          ))}
        </div>

        {/* CTA BUTTON */}
        <div className="hidden md:block">
          <button
            onClick={handleGetStarted}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              isScrolled
                ? "bg-white text-neutral-900 hover:bg-neutral-200"
                : "bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/10"
            }`}
          >
            Get Started
          </button>
        </div>

        {/* MOBILE MENU TOGGLE */}
        <button
          className="md:hidden text-white z-50 p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>
      </div>

      {/* MOBILE MENU OVERLAY */}
      <div
        className={`fixed inset-0 bg-neutral-950 flex flex-col items-center justify-center gap-8 transition-transform duration-300 md:hidden ${
          isMobileMenuOpen
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0"
        }`}
      >
        {navLinks.map((link) => (
          <a
            key={link.name}
            href={link.href}
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-2xl font-medium text-white/90 hover:text-emerald-400 transition-colors"
          >
            {link.name}
          </a>
        ))}
        <button
          onClick={handleGetStarted}
          className="mt-4 px-8 py-3 rounded-full bg-emerald-500 text-neutral-900 font-bold flex items-center gap-2"
        >
          Get Started <FiArrowRight />
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
