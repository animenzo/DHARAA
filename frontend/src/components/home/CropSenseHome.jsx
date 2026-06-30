import React, { useState, useEffect, useRef } from "react";
import Navbar from "./Navbar";
import { FiArrowRight } from "react-icons/fi";

// --- CONFIGURATION ---
const TOTAL_FRAMES = 240;
const FRAME_PREFIX = "/scroll/ezgif-frame-";
// Increased height significantly to allow comfortable reading of 16 sections
const SCROLL_HEIGHT_VH = 800;

// --- UPDATED CONTENT DATA (16 Sections) ---
const SCROLL_SECTIONS = [
  // 1. INTRO
  {
    id: "intro",
    align: "left",
    headline: "The Invisible Foundation.",
    subtext:
      "Every major crop failure starts where the eye cannot see. Soil health isn't static; it changes by the hour. Without real-time data, you are farming blind, relying on surface appearances while the root zone tells a different story.",
    from: 0,
    to: 0.0625,
  },
  // 2. PRECISION CONCEPT
  {
    id: "precision",
    align: "right",
    headline: "Precision Agriculture.",
    subtext:
      "Optimal growth requires exact timing. Our system tracks micro-climates and soil moisture gradients, ensuring your crops stay in the 'Goldilocks Zone' for maximum biomass production. A 2% moisture difference can define your harvest.",
    from: 0.0625,
    to: 0.125,
  },
  // 3. THE GAP PROBLEM
  {
    id: "gap",
    align: "left",
    headline: "Stop Guessing.",
    subtext:
      "Traditional manual testing is slow and often too late. By the time you see yellowing leaves, damage is done. We bridge the gap between intuition and data science, giving you a live pulse on your farm's vitals.",
    from: 0.125,
    to: 0.1875,
  },
  // 4. SMART IRRIGATION (New)
  {
    id: "irrigation",
    align: "right",
    headline: "Smart Irrigation.",
    subtext:
      "Save up to 40% water by irrigating only when the soil data says so. Stop over-watering and drowning your roots, and stop under-watering and stressing your yield. Every drop counts.",
    from: 0.1875,
    to: 0.25,
  },
  // 5. HARDWARE
  {
    id: "hardware",
    align: "left",
    headline: "Industrial-Grade Sensing.",
    subtext:
      "Meet the DHARAA Node. Engineered for harsh Indian summers and monsoons, featuring multi-depth sensors for Moisture, Temperature, pH, and NPK. 3-year battery, IP67 waterproof, deploy-and-forget.",
    from: 0.25,
    to: 0.3125,
  },
  // 6. CONNECTIVITY
  {
    id: "connectivity",
    align: "right",
    headline: "Works Anywhere.",
    subtext:
      "Farms don't always have Wi-Fi. Our devices utilize long-range LoRaWAN and GSM networks to transmit data from remote fields directly to the cloud. Encrypted, instant, and accessible worldwide.",
    from: 0.3125,
    to: 0.375,
  },
  // 7. HEALTH MONITORING (New)
  {
    id: "health",
    align: "left",
    headline: "Health Monitoring.",
    subtext:
      "Detect root stress and nutrient deficiencies days before they are visible to the naked eye. Early detection means early treatment, saving your crop from preventable diseases.",
    from: 0.375,
    to: 0.4375,
  },
  // 8. DATA TO INSIGHTS
  {
    id: "ai",
    align: "right",
    headline: "Actionable Insights.",
    subtext:
      "We don't just show graphs; we tell you what to do. AI analyzes trends and weather to recommend: 'Irrigate 30% less today' or 'High fungal risk detected.' It is an agronomist in your pocket.",
    from: 0.4375,
    to: 0.5,
  },
  // 9. INSTANT ALERTS (New)
  {
    id: "alerts",
    align: "left",
    headline: "Instant Alerts.",
    subtext:
      "Sleep easy. Get immediate SMS or App notifications for critical events like frost, incoming storms, or dangerous dry levels. Be the first to know, so you can be the first to act.",
    from: 0.5,
    to: 0.5625,
  },
  // 10. AUTOMATION
  {
    id: "automation",
    align: "right",
    headline: "Automate Labor.",
    subtext:
      "Link DHARAA to your existing irrigation controllers. Set dynamic triggers to turn on drip lines automatically when moisture drops below 40%. Reduce water waste and save manual labor.",
    from: 0.5625,
    to: 0.625,
  },
  // 11. IOT INTEGRATION (New)
  {
    id: "integration",
    align: "left",
    headline: "IoT Integration.",
    subtext:
      "Connect seamlessly with pumps, valves, and existing farm machinery. Our open ecosystem allows your legacy equipment to become smart, managed from a single digital platform.",
    from: 0.625,
    to: 0.6875,
  },
  // 12. REMOTE CONTROL (New)
  {
    id: "remote",
    align: "right",
    headline: "Remote Control.",
    subtext:
      "Turn pumps on or off and adjust schedules from anywhere in the world. Whether you are at the market or on vacation, your farm is always at your fingertips.",
    from: 0.6875,
    to: 0.75,
  },
  // 13. YIELD ANALYTICS (New)
  {
    id: "analytics",
    align: "left",
    headline: "Yield Analytics.",
    subtext:
      "Historical data modeling helps predict harvest volume and optimal timing. Use past seasons' data to plan better for the next one, maximizing your profitability year over year.",
    from: 0.75,
    to: 0.8125,
  },
  // 14. SIMPLE SETUP
  {
    id: "setup",
    align: "right",
    headline: "Zero Config Setup.",
    subtext:
      "Plug. Power. Grow. No technical skills required. We pre-configure every device so you just have to put it in the ground. It connects automatically within minutes.",
    from: 0.8125,
    to: 0.875,
  },
  // 15. PROFITABILITY
  {
    id: "profit",
    align: "left",
    headline: "Maximize Profit.",
    subtext:
      "Lower input costs (water, fertilizer, energy) + Higher Yields = Better Margins. DHARAA pays for itself in a single season by optimizing every resource you use.",
    from: 0.875,
    to: 0.9375,
  },
  // 16. DASHBOARD CTA
  {
    id: "dashboard",
    align: "center",
    headline: "Command Center.",
    subtext:
      "The Smart-Kheti Dashboard brings it all together. Track zones, manage alerts, export reports, and share access. Your entire farm, visible in your pocket.",
    from: 0.9375,
    to: 1.0,
  },
];

// --- UTILITIES ---
function pad(num) {
  return String(num).padStart(3, "0");
}
function getFrameSrc(index) {
  const frame = Math.min(Math.max(0, Math.floor(index)), TOTAL_FRAMES - 1);
  return `${FRAME_PREFIX}${pad(frame + 1)}.webp`;
}

// --- SUB-COMPONENTS ---

const ScrollParallaxHero = ({ renderOverlay }) => {
  const containerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      const windowH = window.innerHeight;
      const start = containerRef.current.offsetTop;
      const end = start + containerRef.current.offsetHeight - windowH;
      const scrollY = window.scrollY;

      let p = (scrollY - start) / (end - start);
      p = Math.max(0, Math.min(1, p));

      setProgress(p);
      setFrameIndex(Math.floor(p * (TOTAL_FRAMES - 1)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative bg-neutral-950"
      style={{ height: `${SCROLL_HEIGHT_VH}vh` }}
    >
      <div className="sticky top-0 left-0 w-full h-screen overflow-hidden">
        {/* BACKGROUND IMAGE SEQUENCE */}
        <div className="absolute inset-0 z-0">
          <img
            src={getFrameSrc(frameIndex)}
            alt="Cinematic Sequence"
            className="w-full h-full object-cover transition-opacity duration-75"
            style={{ opacity: 1, willChange: "contents" }}
          />
          {/* Enhanced Gradient for readability on both sides */}
          {/* <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/30 to-black/90 z-[1]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 z-[1]" /> */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/90 via-emerald-950/30 to-emerald-950/90 z-[1]" />
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-emerald-950/50 z-[1]" />

          {/* ADD THIS — radial green glow in center */}
          <div className="absolute inset-0 z-[1]" style={{
            background: "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(4, 121, 51, 0.6) 0%, transparent 70%)"
          }} />
        </div>

        {/* CONTENT OVERLAY */}
        <div className="absolute inset-0 z-10 w-full h-full">
          {renderOverlay(progress)}
        </div>
      </div>
    </div>
  );
};

// 2. The Zig-Zag Overlay
const HeroOverlay = (progress) => {
  const activeIndex = SCROLL_SECTIONS.findIndex(
    (s) => progress >= s.from && progress < s.to,
  );
  const safeIndex =
    activeIndex === -1 ? SCROLL_SECTIONS.length - 1 : activeIndex;

  return (
    <div className="w-full h-full max-w-[1600px] mx-auto flex relative px-6 md:px-12">
      {/* CENTER STAGE: Dynamic Text Content (Zig-Zag) */}
      <div className="flex-1 relative w-full h-full">
        {SCROLL_SECTIONS.map((section, idx) => {
          const isActive = idx === safeIndex;

          // Determine positioning classes based on 'align'
          let positionClass = "";
          let animationClass = "";
          let alignText = "";

          if (section.align === "left") {
            positionClass = "lg:items-start lg:pl-25 lg:pr-0 items-center px-4";
            animationClass = isActive ? "translate-x-0" : "-translate-x-24";
            alignText = "text-left";
          } else if (section.align === "right") {
            positionClass = "lg:items-end lg:pr-20 lg:pl-0 items-center px-4";
            animationClass = isActive ? "translate-x-0" : "translate-x-24";
            alignText = "text-right";
          } else {
            positionClass = "items-center justify-center px-4 text-center";
            animationClass = isActive ? "scale-100" : "scale-95";
            alignText = "text-center mx-auto";
          }

          return (
            <div
              key={section.id}
              className={`
                absolute top-0 left-0 w-full h-full flex flex-col justify-center
                transition-all duration-700 ease-in-out
                ${positionClass}
                ${isActive
                  ? "opacity-100 blur-0 pointer-events-auto"
                  : "opacity-0 blur-lg pointer-events-none"
                }
              `}
            >
              <div
                className={`max-w-xl transition-transform duration-700 ${animationClass} ${alignText}`}
              >
                {/* Decorative Line */}
                <div
                  className={`h-1 w-20 bg-emerald-500 mb-6 ${section.align === "right" ? "ml-auto" : "mr-auto"} ${section.align === "center" ? "mx-auto" : ""}`}
                />

                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tighter mb-6 leading-[1.1] drop-shadow-2xl">
                  {section.headline}
                </h2>
                <p className="text-lg md:text-xl text-white/80 font-light leading-relaxed drop-shadow-xl">
                  {section.subtext}
                </p>

                {/* Buttons for Specific Sections */}
                {idx === SCROLL_SECTIONS.length - 1 && (
                  <div
                    className={`mt-10 flex gap-4 ${section.align === "center" ? "justify-center" : ""}`}
                  >
                    <button className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 px-10 rounded-full transition-all hover:scale-105 shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-2">
                      Launch Dashboard <FiArrowRight size={20} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 3. White Background Content Section (Cleaned up duplications)
const WhiteContent = () => (
  <section className="bg-white py-4 px-6 relative z-20 shadow-[0_-20px_40px_rgba(0,0,0,0.1)] rounded-t-[3rem] -mt-20">
    <div className="mx-auto w-20 h-1.5 bg-neutral-200 rounded-full mt-6 mb-6" />

    <div className="max-w-4xl mx-auto text-center">
      <h2 className="text-neutral-900 text-4xl md:text-5xl font-bold tracking-tight mb-4">
        Farming is complex. <br />{" "}
        <span className="text-emerald-600">We make it simple.</span>
      </h2>
      <p className="text-lg text-neutral-600 mb-4">
        DHARAA is built for the reality of Indian agriculture. We understand
        the soil, the climate, and the connectivity challenges.
      </p>

      <div className="flex flex-wrap justify-center gap-4">
        <button className="bg-neutral-900 text-white px-8 py-3 rounded-full font-medium hover:bg-neutral-800 transition-all">
          Get Your Sensor Kit
        </button>
        <button className="border border-neutral-300 text-neutral-900 px-8 py-3 rounded-full font-medium hover:bg-neutral-50 transition-all">
          View Demo Dashboard
        </button>
      </div>
    </div>

    <div className="max-w-7xl mx-auto mt-4 pt-3 border-t border-neutral-100 flex justify-between items-center text-xs text-neutral-400">
      <p>© 2026 DHARAA Inc.</p>
      <div className="flex gap-4">
        <a href="#">Privacy</a>
        <a href="#">Terms</a>
      </div>
    </div>
  </section>
);

export default function CropSenseHome() {
  return (
    <div className="min-h-screen font-sans selection:bg-emerald-500 selection:text-white">
      <Navbar />

      {/* 1. Cinematic Dark Start */}
      <ScrollParallaxHero renderOverlay={HeroOverlay} />

      {/* 2. White Clean Content */}
      <WhiteContent />
    </div>
  );
}
