import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

// ─── Theme tokens (dark emerald) ───────────────────────────────────────────
// bg-[#030f0a]   page background  (near-black green)
// bg-[#071a10]   surface          (dark green card)
// bg-[#0a2416]   elevated         (slightly lighter card)
// border-[#1a3d28]  default border
// border-[#2a6645]  accent border
// text-[#e4f5ec]  primary text
// text-[#7eb89a]  secondary text
// text-[#3ddc84]  accent green (bright)
// #10b981 / emerald-500  CTA / highlights

// ─── DATA ───────────────────────────────────────────────────────────────────
const CONTENT = {
  en: {
    hero: {
      eyebrow: "Complete platform guide",
      title: "How Crop Sense works",
      subtitle: "From a tiny sensor in your soil to an AI decision on your phone — every step, explained.",
    },
    sections: [
      {
        id: "overview",
        icon: "🌱",
        tag: "Overview",
        tagColor: "emerald",
        title: "What is Crop Sense?",
        body: "Crop Sense is an end-to-end precision agriculture platform. IoT sensors buried in your field continuously collect soil and environment data. That data travels wirelessly to our cloud, where AI processes it and delivers plain-language decisions to your phone — so you act before problems occur.",
        type: "flow",
        flow: [
          { icon: "📡", label: "Sensor node", sub: "In-field device" },
          { icon: "📶", label: "GSM / 4G", sub: "Data uplink" },
          { icon: "☁️", label: "MQTT cloud", sub: "IoT server" },
          { icon: "🧠", label: "AI engine", sub: "Decisions" },
          { icon: "📱", label: "Your phone", sub: "Dashboard" },
        ],
      },
      {
        id: "hardware",
        icon: "🔧",
        tag: "Hardware",
        tagColor: "amber",
        title: "Hardware you need",
        body: "Every device ships pre-configured. No technician required — just place and power on.",
        type: "hardware",
        items: [
          {
            icon: "📡",
            name: "Crop Sense Node",
            spec: "IP67 · 3-yr battery · multi-depth",
            desc: "Reads soil moisture, temperature, pH, and NPK at multiple depths. Transmits via GSM 4G. Waterproof and deploy-and-forget.",
          },
          {
            icon: "📶",
            name: "GSM 4G SIM module",
            spec: "Works anywhere with mobile signal",
            desc: "Built into every node. Uses a standard nano-SIM. Works across India on any carrier. No Wi-Fi needed.",
          },
          {
            icon: "⚡",
            name: "Irrigation controller",
            spec: "Optional · connects existing pumps",
            desc: "Bridges between Crop Sense and your existing drip lines or pump motors. Enables fully automatic AI-driven irrigation.",
          },
          {
            icon: "📱",
            name: "Smartphone / tablet",
            spec: "Android or iOS",
            desc: "Access the dashboard app or web portal from any device. Full control, alerts, and AI recommendations.",
          },
        ],
      },
      {
        id: "setup",
        icon: "⚙️",
        tag: "Setup",
        tagColor: "emerald",
        title: "Setup in 5 steps",
        body: null,
        type: "steps",
        steps: [
          {
            n: "01",
            title: "Insert SIM card",
            desc: "Open the node's SIM slot and insert your carrier nano-SIM. The node auto-connects to 4G.",
          },
          {
            n: "02",
            title: "Deploy sensor nodes",
            desc: "Push nodes into the soil at root depth (15–30 cm). One node covers up to 1 acre. No wires.",
          },
          {
            n: "03",
            title: "Scan QR in the app",
            desc: "Open the Crop Sense app → Add Device → scan the QR on each node. It registers instantly.",
          },
          {
            n: "04",
            title: "Name your zones",
            desc: "Label each node (e.g. 'Wheat North'). Select crop type so the AI tunes its recommendations.",
          },
          {
            n: "05",
            title: "Go live",
            desc: "Data flows within 2 minutes. Alerts and AI scheduling activate automatically.",
          },
        ],
      },
      {
        id: "iot",
        icon: "☁️",
        tag: "IoT server",
        tagColor: "blue",
        title: "IoT server & data architecture",
        body: "Your data travels through a secure, encrypted pipeline — sensor to screen in under 30 seconds.",
        type: "layers",
        layers: [
          {
            label: "Sensor node",
            sub: "Edge device",
            desc: "Reads sensor data every 15 min (or on-demand). Compresses and encrypts the payload.",
            color: "#0a2416",
            accent: "#3ddc84",
          },
          {
            label: "GSM 4G uplink",
            sub: "Transport layer",
            desc: "Encrypted HTTPS packet sent over mobile network to our cloud endpoint.",
            color: "#071a10",
            accent: "#10b981",
          },
          {
            label: "MQTT broker",
            sub: "Message queue",
            desc: "High-throughput message broker receives, validates, and distributes packets in real-time.",
            color: "#0a2416",
            accent: "#3ddc84",
          },
          {
            label: "Time-series DB",
            sub: "Storage",
            desc: "All readings stored with timestamps. Powers historical charts, trend detection, and AI training.",
            color: "#071a10",
            accent: "#10b981",
          },
          {
            label: "AI / API server",
            sub: "Intelligence layer",
            desc: "Runs scheduling models, anomaly detection, and recommendation engine. Triggers alerts.",
            color: "#0a2416",
            accent: "#3ddc84",
          },
          {
            label: "Dashboard & app",
            sub: "Presentation layer",
            desc: "WebSocket push delivers live updates to your browser and mobile app.",
            color: "#071a10",
            accent: "#10b981",
          },
        ],
      },
      {
        id: "ai",
        icon: "🧠",
        tag: "AI scheduling",
        tagColor: "purple",
        title: "AI irrigation scheduling system",
        body: "The heart of Crop Sense. Our AI doesn't just show you data — it decides when and how much to irrigate, automatically.",
        type: "ai",
        inputs: [
          { icon: "💧", label: "Live soil moisture" },
          { icon: "🌡️", label: "Temperature & humidity" },
          { icon: "🌧️", label: "Weather forecast API" },
          { icon: "🌿", label: "Crop growth stage" },
          { icon: "📅", label: "Historical patterns" },
          { icon: "🧪", label: "Soil type & pH" },
        ],
        outputs: [
          { icon: "⏰", label: "Irrigation start time" },
          { icon: "📊", label: "Duration & volume" },
          { icon: "🗓️", label: "7-day schedule" },
          { icon: "⚡", label: "Auto pump trigger" },
        ],
        howItWorks: [
          "Every 15 minutes, the AI re-evaluates all inputs and updates the schedule.",
          "If rain is forecast in the next 6 hours, irrigation is automatically postponed.",
          "Soil moisture targets are crop-specific — rice gets more, wheat gets less.",
          "The controller opens/closes valves automatically. You can override anytime.",
        ],
      },
      {
        id: "dashboard",
        icon: "📊",
        tag: "Dashboard",
        tagColor: "emerald",
        title: "What farmers can see & do",
        body: null,
        type: "features",
        features: [
          { icon: "💧", label: "Live soil moisture", desc: "Per-zone % with live trend. Red alert if critically dry or waterlogged." },
          { icon: "🌡️", label: "Temperature", desc: "Soil & air at multiple depths. Frost warning before it happens." },
          { icon: "🌿", label: "NPK nutrients", desc: "Nitrogen, Phosphorus, Potassium levels. AI tells you exactly what to add." },
          { icon: "🧪", label: "Soil pH", desc: "Real-time acidity reading with AI correction suggestion (lime/sulfur)." },
          { icon: "🔔", label: "Smart alerts", desc: "SMS + push for drought, frost, storm, and pest risk events." },
          { icon: "🧠", label: "AI recommendations", desc: "'Irrigate 20% less today' — plain language decisions, not raw numbers." },
          { icon: "⚡", label: "Remote pump control", desc: "Turn pumps on/off from anywhere. Set auto-rules or manual override." },
          { icon: "📈", label: "Yield analytics", desc: "Historical trends, harvest volume predictions, and cost-saving reports." },
        ],
      },
      {
        id: "connectivity",
        icon: "📶",
        tag: "Connectivity",
        tagColor: "blue",
        title: "Connectivity options",
        body: "Crop Sense works wherever there is mobile network coverage.",
        type: "connect",
        options: [
          {
            icon: "📶",
            name: "GSM / 4G SIM (built-in)",
            badge: "Recommended",
            badgeColor: "emerald",
            desc: "Every node has a built-in SIM slot. Use any Indian carrier (Jio, Airtel, Vi). Works in most villages and remote areas. No extra hardware needed.",
            range: "Any mobile network area",
          },
          {
            icon: "📡",
            name: "Wi-Fi",
            badge: "Near farmhouse only",
            badgeColor: "amber",
            desc: "If your field is within range of your home router. Fastest data refresh (every 5 minutes) but limited by Wi-Fi range.",
            range: "~50 m from router",
          },
        ],
      },
      {
        id: "workflow",
        icon: "🔄",
        tag: "Daily use",
        tagColor: "emerald",
        title: "Farmer's daily routine",
        body: "Using Crop Sense takes under 5 minutes a day.",
        type: "steps",
        steps: [
          { n: "AM", title: "Morning check (2 min)", desc: "Open app. See overnight alerts and today's AI irrigation schedule across all zones." },
          { n: "→", title: "Review AI decisions", desc: "Tap any recommendation to see why it was made. Approve, modify, or dismiss." },
          { n: "→", title: "AI handles irrigation", desc: "If auto-mode is on, pumps run on schedule. You get a notification when done." },
          { n: "→", title: "Log field activity", desc: "Add notes: fertilizer applied, pest spotted, manual observation." },
          { n: "PM", title: "Weekly report (auto)", desc: "Platform emails a PDF: water saved, nutrient trends, cost saved, yield forecast." },
        ],
      },
    ],
  },
  hi: {
    hero: {
      eyebrow: "पूरा प्लेटफ़ॉर्म गाइड",
      title: "Crop Sense कैसे काम करता है",
      subtitle: "मिट्टी में लगे सेंसर से लेकर आपके फोन पर AI के फैसले तक — हर कदम समझाया गया।",
    },
    sections: [
      {
        id: "overview",
        icon: "🌱",
        tag: "अवलोकन",
        tagColor: "emerald",
        title: "Crop Sense क्या है?",
        body: "Crop Sense एक स्मार्ट खेती प्लेटफ़ॉर्म है। खेत में लगे IoT सेंसर लगातार मिट्टी और वातावरण का डेटा इकट्ठा करते हैं। यह डेटा वायरलेस तरीके से हमारे क्लाउड पर जाता है, जहाँ AI इसे प्रोसेस करके सरल भाषा में आपके फोन पर फैसला भेजता है।",
        type: "flow",
        flow: [
          { icon: "📡", label: "सेंसर नोड", sub: "खेत में डिवाइस" },
          { icon: "📶", label: "GSM / 4G", sub: "डेटा अपलिंक" },
          { icon: "☁️", label: "MQTT क्लाउड", sub: "IoT सर्वर" },
          { icon: "🧠", label: "AI इंजन", sub: "फैसले" },
          { icon: "📱", label: "आपका फोन", sub: "डैशबोर्ड" },
        ],
      },
      {
        id: "hardware",
        icon: "🔧",
        tag: "हार्डवेयर",
        tagColor: "amber",
        title: "जरूरी हार्डवेयर",
        body: "हर डिवाइस पहले से कॉन्फ़िगर है। कोई तकनीशियन नहीं चाहिए — बस लगाएं और चालू करें।",
        type: "hardware",
        items: [
          { icon: "📡", name: "Crop Sense नोड", spec: "IP67 · 3 साल बैटरी · मल्टी-डेप्थ", desc: "मिट्टी की नमी, तापमान, pH और NPK कई गहराइयों पर पढ़ता है। GSM 4G से डेटा भेजता है। वाटरप्रूफ।" },
          { icon: "📶", name: "GSM 4G SIM मॉड्यूल", spec: "मोबाइल नेटवर्क हो तो काम करे", desc: "हर नोड में बिल्ट-इन। नैनो-SIM लगाएं। Jio, Airtel, Vi — कोई भी चलेगा। Wi-Fi की जरूरत नहीं।" },
          { icon: "⚡", name: "सिंचाई कंट्रोलर", spec: "वैकल्पिक · मौजूदा पंप से जोड़ें", desc: "Crop Sense को आपके ड्रिप लाइन या पंप मोटर से जोड़ता है। AI-संचालित स्वचालित सिंचाई के लिए।" },
          { icon: "📱", name: "स्मार्टफोन / टैबलेट", spec: "Android या iOS", desc: "डैशबोर्ड ऐप या वेब पोर्टल किसी भी डिवाइस से चलाएं। पूरा कंट्रोल, अलर्ट और AI सुझाव।" },
        ],
      },
      {
        id: "setup",
        icon: "⚙️",
        tag: "सेटअप",
        tagColor: "emerald",
        title: "5 स्टेप में सेटअप",
        body: null,
        type: "steps",
        steps: [
          { n: "01", title: "SIM कार्ड डालें", desc: "नोड का SIM स्लॉट खोलें और नैनो-SIM डालें। नोड खुद 4G से कनेक्ट हो जाएगा।" },
          { n: "02", title: "सेंसर नोड लगाएं", desc: "नोड को जड़ की गहराई (15–30 सेमी) पर मिट्टी में दबाएं। एक नोड 1 एकड़ तक कवर करता है।" },
          { n: "03", title: "ऐप में QR स्कैन करें", desc: "Crop Sense ऐप खोलें → डिवाइस जोड़ें → हर नोड का QR स्कैन करें। तुरंत रजिस्टर होगा।" },
          { n: "04", title: "जोन का नाम रखें", desc: "हर नोड को नाम दें (जैसे 'गेहूं उत्तर')। फसल का प्रकार चुनें ताकि AI सही सुझाव दे।" },
          { n: "05", title: "लाइव हो जाएं", desc: "2 मिनट में डेटा आना शुरू। अलर्ट और AI शेड्यूलिंग अपने आप चालू हो जाती है।" },
        ],
      },
      {
        id: "iot",
        icon: "☁️",
        tag: "IoT सर्वर",
        tagColor: "blue",
        title: "IoT सर्वर और डेटा आर्किटेक्चर",
        body: "आपका डेटा एक सुरक्षित, एन्क्रिप्टेड पाइपलाइन से गुज़रता है — सेंसर से स्क्रीन तक 30 सेकंड से कम में।",
        type: "layers",
        layers: [
          { label: "सेंसर नोड", sub: "एज डिवाइस", desc: "हर 15 मिनट में डेटा पढ़ता है। पेलोड कंप्रेस और एन्क्रिप्ट करता है।", color: "#0a2416", accent: "#3ddc84" },
          { label: "GSM 4G अपलिंक", sub: "ट्रांसपोर्ट लेयर", desc: "मोबाइल नेटवर्क से एन्क्रिप्टेड HTTPS पैकेट हमारे क्लाउड को भेजता है।", color: "#071a10", accent: "#10b981" },
          { label: "MQTT ब्रोकर", sub: "मैसेज क्यू", desc: "हाई-थ्रूपुट मैसेज ब्रोकर रियल-टाइम में पैकेट प्राप्त और वितरित करता है।", color: "#0a2416", accent: "#3ddc84" },
          { label: "टाइम-सीरीज़ DB", sub: "स्टोरेज", desc: "सभी रीडिंग टाइमस्टैम्प के साथ स्टोर। हिस्टोरिकल चार्ट और AI ट्रेनिंग के लिए।", color: "#071a10", accent: "#10b981" },
          { label: "AI / API सर्वर", sub: "इंटेलिजेंस लेयर", desc: "शेड्यूलिंग मॉडल, अनोमाली डिटेक्शन और रिकमेंडेशन इंजन चलाता है।", color: "#0a2416", accent: "#3ddc84" },
          { label: "डैशबोर्ड और ऐप", sub: "प्रेजेंटेशन लेयर", desc: "WebSocket पुश से ब्राउज़र और मोबाइल ऐप को लाइव अपडेट मिलते हैं।", color: "#071a10", accent: "#10b981" },
        ],
      },
      {
        id: "ai",
        icon: "🧠",
        tag: "AI शेड्यूलिंग",
        tagColor: "purple",
        title: "AI सिंचाई शेड्यूलिंग सिस्टम",
        body: "Crop Sense का दिल। हमारा AI सिर्फ डेटा नहीं दिखाता — यह खुद तय करता है कि कब और कितनी सिंचाई करनी है।",
        type: "ai",
        inputs: [
          { icon: "💧", label: "लाइव मिट्टी नमी" },
          { icon: "🌡️", label: "तापमान और नमी" },
          { icon: "🌧️", label: "मौसम पूर्वानुमान API" },
          { icon: "🌿", label: "फसल वृद्धि चरण" },
          { icon: "📅", label: "ऐतिहासिक पैटर्न" },
          { icon: "🧪", label: "मिट्टी का प्रकार और pH" },
        ],
        outputs: [
          { icon: "⏰", label: "सिंचाई शुरू समय" },
          { icon: "📊", label: "अवधि और मात्रा" },
          { icon: "🗓️", label: "7-दिन शेड्यूल" },
          { icon: "⚡", label: "ऑटो पंप ट्रिगर" },
        ],
        howItWorks: [
          "हर 15 मिनट में AI सभी इनपुट फिर से जांचता है और शेड्यूल अपडेट करता है।",
          "अगर 6 घंटे में बारिश का अनुमान है तो सिंचाई अपने आप टल जाती है।",
          "मिट्टी की नमी का लक्ष्य फसल के अनुसार — धान को ज्यादा, गेहूं को कम।",
          "कंट्रोलर खुद वाल्व खोलता/बंद करता है। आप कभी भी ओवरराइड कर सकते हैं।",
        ],
      },
      {
        id: "dashboard",
        icon: "📊",
        tag: "डैशबोर्ड",
        tagColor: "emerald",
        title: "किसान क्या देख और कर सकता है",
        body: null,
        type: "features",
        features: [
          { icon: "💧", label: "लाइव मिट्टी नमी", desc: "हर जोन की % और लाइव ट्रेंड। बहुत सूखी/भीगी हो तो रेड अलर्ट।" },
          { icon: "🌡️", label: "तापमान", desc: "मिट्टी और हवा का तापमान। पाले से पहले चेतावनी।" },
          { icon: "🌿", label: "NPK पोषक तत्व", desc: "नाइट्रोजन, फॉस्फोरस, पोटेशियम। AI बताता है क्या डालना है।" },
          { icon: "🧪", label: "मिट्टी pH", desc: "रियल-टाइम अम्लता। AI चूना या सल्फर का सुझाव देता है।" },
          { icon: "🔔", label: "स्मार्ट अलर्ट", desc: "सूखा, पाला, तूफान, कीट जोखिम के लिए SMS + ऐप नोटिफ़िकेशन।" },
          { icon: "🧠", label: "AI सुझाव", desc: "'आज 20% कम सिंचाई करें' — सरल भाषा में, केवल नंबर नहीं।" },
          { icon: "⚡", label: "रिमोट पंप कंट्रोल", desc: "कहीं से भी पंप चालू/बंद करें। ऑटो-नियम या मैन्युअल ओवरराइड।" },
          { icon: "📈", label: "उपज विश्लेषण", desc: "ऐतिहासिक ट्रेंड, फसल अनुमान और लागत बचत रिपोर्ट।" },
        ],
      },
      {
        id: "connectivity",
        icon: "📶",
        tag: "कनेक्टिविटी",
        tagColor: "blue",
        title: "कनेक्टिविटी विकल्प",
        body: "Crop Sense जहाँ भी मोबाइल नेटवर्क है, वहाँ काम करता है।",
        type: "connect",
        options: [
          { icon: "📶", name: "GSM / 4G SIM (बिल्ट-इन)", badge: "अनुशंसित", badgeColor: "emerald", desc: "हर नोड में बिल्ट-इन SIM स्लॉट। कोई भी भारतीय कैरियर (Jio, Airtel, Vi)। ज्यादातर गाँव और दूरदराज के खेतों में काम करता है।", range: "मोबाइल नेटवर्क क्षेत्र" },
          { icon: "📡", name: "Wi-Fi", badge: "केवल घर के पास", badgeColor: "amber", desc: "अगर खेत घर के राउटर की रेंज में हो। सबसे तेज़ डेटा रिफ्रेश (हर 5 मिनट) लेकिन सीमित रेंज।", range: "राउटर से ~50 मीटर" },
        ],
      },
      {
        id: "workflow",
        icon: "🔄",
        tag: "रोज़ाना उपयोग",
        tagColor: "emerald",
        title: "किसान की रोज़ाना दिनचर्या",
        body: "Crop Sense इस्तेमाल करने में रोज़ 5 मिनट से कम लगते हैं।",
        type: "steps",
        steps: [
          { n: "AM", title: "सुबह की जांच (2 मिनट)", desc: "ऐप खोलें। रात के अलर्ट और आज का AI सिंचाई शेड्यूल देखें।" },
          { n: "→", title: "AI के फैसले देखें", desc: "किसी भी सुझाव पर टैप करें — क्यों बना देखें। स्वीकार, बदलें या खारिज करें।" },
          { n: "→", title: "AI सिंचाई संभालता है", desc: "ऑटो-मोड चालू हो तो पंप शेड्यूल पर खुद चलते हैं। काम होने पर नोटिफ़िकेशन मिलती है।" },
          { n: "→", title: "खेत की गतिविधि लॉग करें", desc: "नोट जोड़ें: खाद डाली, कीट दिखा, मैन्युअल निरीक्षण।" },
          { n: "PM", title: "साप्ताहिक रिपोर्ट (ऑटो)", desc: "प्लेटफ़ॉर्म PDF रिपोर्ट भेजता है: पानी बचत, पोषक तत्व ट्रेंड, उपज अनुमान।" },
        ],
      },
    ],
  },
};

// ─── Tag color map ─────────────────────────────────────────────────────────
const TAG_STYLES = {
  emerald: { bg: "rgba(16,185,129,0.15)", color: "#3ddc84", border: "rgba(61,220,132,0.3)" },
  amber:   { bg: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "rgba(251,191,36,0.3)" },
  blue:    { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "rgba(96,165,250,0.3)" },
  purple:  { bg: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "rgba(167,139,250,0.3)" },
};

// ─── useInView hook ────────────────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

// ─── AnimatedSection wrapper ───────────────────────────────────────────────
function AnimSection({ children, delay = 0 }) {
  const [ref, visible] = useInView();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(32px)",
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────────────
function SectionHeader({ icon, tag, tagColor, title }) {
  const ts = TAG_STYLES[tagColor] || TAG_STYLES.emerald;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
          padding: "3px 10px", borderRadius: 20,
          background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`,
        }}>{tag}</span>
      </div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#e4f5ec", letterSpacing: "-0.01em" }}>{title}</h2>
    </div>
  );
}

// ─── Flow diagram ──────────────────────────────────────────────────────────
function FlowDiagram({ flow }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 16 }}>
      {flow.map((f, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{
            background: "#0a2416", border: "1px solid #1a3d28",
            borderRadius: 10, padding: "12px 14px", textAlign: "center", minWidth: 80,
          }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{f.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#e4f5ec", lineHeight: 1.2 }}>{f.label}</div>
            <div style={{ fontSize: 11, color: "#7eb89a", marginTop: 2 }}>{f.sub}</div>
          </div>
          {i < flow.length - 1 && (
            <div style={{ color: "#3ddc84", fontSize: 18, flexShrink: 0 }}>→</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Hardware grid ─────────────────────────────────────────────────────────
function HardwareGrid({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: "#071a10", border: "1px solid #1a3d28", borderRadius: 10, padding: "14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e4f5ec" }}>{item.name}</div>
              <div style={{ fontSize: 11, color: "#3ddc84", marginTop: 1 }}>{item.spec}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#7eb89a", lineHeight: 1.5 }}>{item.desc}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Steps ─────────────────────────────────────────────────────────────────
function Steps({ steps }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 12 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(61,220,132,0.12)", border: "1px solid rgba(61,220,132,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#3ddc84",
            }}>{s.n}</div>
            {i < steps.length - 1 && (
              <div style={{ width: 1, height: 24, background: "#1a3d28", margin: "4px 0" }} />
            )}
          </div>
          <div style={{
            background: "#071a10", border: "1px solid #1a3d28", borderRadius: 10,
            padding: "12px 14px", flex: 1, marginBottom: i < steps.length - 1 ? 0 : 0,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e4f5ec", marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: "#7eb89a", lineHeight: 1.5 }}>{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── IoT Layers ────────────────────────────────────────────────────────────
function Layers({ layers }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
      {layers.map((l, i) => (
        <div key={i}>
          <div style={{
            background: l.color, border: `1px solid ${l.accent}44`,
            borderRadius: 10, padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: l.accent, flexShrink: 0,
              boxShadow: `0 0 6px ${l.accent}`,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e4f5ec" }}>{l.label}</span>
                <span style={{ fontSize: 11, color: l.accent }}>{l.sub}</span>
              </div>
              <div style={{ fontSize: 12, color: "#7eb89a", lineHeight: 1.4 }}>{l.desc}</div>
            </div>
          </div>
          {i < layers.length - 1 && (
            <div style={{ display: "flex", justifyContent: "center", padding: "2px 0" }}>
              <div style={{ color: "#2a6645", fontSize: 14 }}>↓</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── AI Section ────────────────────────────────────────────────────────────
function AISection({ section }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#a78bfa", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Inputs</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {section.inputs.map((inp, i) => (
              <div key={i} style={{
                background: "#0a2416", border: "1px solid #1a3d28",
                borderRadius: 8, padding: "8px 10px",
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 12, color: "#b4d4c0",
              }}>
                <span>{inp.icon}</span>{inp.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "rgba(139,92,246,0.15)", border: "2px solid rgba(167,139,250,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          }}>🧠</div>
          <div style={{ fontSize: 10, color: "#a78bfa", fontWeight: 600, textAlign: "center", letterSpacing: "0.05em" }}>AI ENGINE</div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#3ddc84", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Outputs</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {section.outputs.map((out, i) => (
              <div key={i} style={{
                background: "rgba(16,185,129,0.08)", border: "1px solid rgba(61,220,132,0.25)",
                borderRadius: 8, padding: "8px 10px",
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 12, color: "#b4d4c0",
              }}>
                <span>{out.icon}</span>{out.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 16, background: "rgba(139,92,246,0.06)",
        border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10, padding: "14px 16px",
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#a78bfa", marginBottom: 8, letterSpacing: "0.04em" }}>
          HOW IT WORKS
        </div>
        {section.howItWorks.map((line, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < section.howItWorks.length - 1 ? 6 : 0 }}>
            <span style={{ color: "#a78bfa", flexShrink: 0, fontSize: 12 }}>◆</span>
            <span style={{ fontSize: 12, color: "#b4d4c0", lineHeight: 1.5 }}>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Features grid ─────────────────────────────────────────────────────────
function FeaturesGrid({ features }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
      {features.map((f, i) => (
        <div key={i} style={{
          background: "#071a10", border: "1px solid #1a3d28",
          borderRadius: 10, padding: "12px",
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{f.icon}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e4f5ec", marginBottom: 3 }}>{f.label}</div>
            <div style={{ fontSize: 12, color: "#7eb89a", lineHeight: 1.4 }}>{f.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Connectivity ──────────────────────────────────────────────────────────
function ConnectOptions({ options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      {options.map((o, i) => {
        const ts = TAG_STYLES[o.badgeColor] || TAG_STYLES.emerald;
        return (
          <div key={i} style={{
            background: "#071a10", border: `1px solid ${i === 0 ? "rgba(61,220,132,0.35)" : "#1a3d28"}`,
            borderRadius: 10, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>{o.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#e4f5ec" }}>{o.name}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 12,
                background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`,
              }}>{o.badge}</span>
            </div>
            <div style={{ fontSize: 12, color: "#7eb89a", lineHeight: 1.5, marginBottom: 6 }}>{o.desc}</div>
            <div style={{ fontSize: 11, color: "#3ddc84" }}>📍 {o.range}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section renderer ──────────────────────────────────────────────────────
function Section({ section, delay }) {
  return (
    <AnimSection delay={delay}>
      <div style={{
        background: "#071a10",
        border: "1px solid #1a3d28",
        borderRadius: 14,
        padding: "20px",
        marginBottom: 16,
      }}>
        <SectionHeader icon={section.icon} tag={section.tag} tagColor={section.tagColor} title={section.title} />
        {section.body && (
          <p style={{ fontSize: 14, color: "#7eb89a", lineHeight: 1.7, margin: "0 0 4px" }}>{section.body}</p>
        )}
        {section.type === "flow" && <FlowDiagram flow={section.flow} />}
        {section.type === "hardware" && <HardwareGrid items={section.items} />}
        {section.type === "steps" && <Steps steps={section.steps} />}
        {section.type === "layers" && <Layers layers={section.layers} />}
        {section.type === "ai" && <AISection section={section} />}
        {section.type === "features" && <FeaturesGrid features={section.features} />}
        {section.type === "connect" && <ConnectOptions options={section.options} />}
      </div>
    </AnimSection>
  );
}

// ─── Pulsing dot ───────────────────────────────────────────────────────────
function PulseDot() {
  return (
    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#3ddc84", marginRight: 8, animation: "pulseDot 1.4s ease-in-out infinite" }} />
  );
}

// ─── Main export ───────────────────────────────────────────────────────────
export default function HowItWorks() {
  const [lang, setLang] = useState("en");
  const data = CONTENT[lang];
  const navigate = useNavigate()
  const handleLogin = ()=>{
    navigate("/login")
  }
  return (
    <div style={{
      minHeight: "100vh",
      background: "#030f0a",
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      color: "#e4f5ec",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }
        @keyframes heroFadeUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #030f0a; }
        ::-webkit-scrollbar-thumb { background: #1a3d28; border-radius: 3px; }
      `}</style>

      {/* ── Hero ── */}
      <div style={{
        maxWidth: 720, margin: "0 auto", padding: "56px 24px 32px",
        animation: "heroFadeUp 0.8s ease both",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <PulseDot />
            <span style={{ fontSize: 12, color: "#7eb89a", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {data.hero.eyebrow}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["en", "hi"].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: "6px 18px", borderRadius: 20, cursor: "pointer",
                fontSize: 13, fontWeight: 500, transition: "all 0.15s",
                background: lang === l ? "rgba(61,220,132,0.12)" : "transparent",
                border: lang === l ? "1px solid rgba(61,220,132,0.4)" : "1px solid #1a3d28",
                color: lang === l ? "#3ddc84" : "#7eb89a",
              }}>
                {l === "en" ? "English" : "हिंदी"}
              </button>
            ))}
          </div>
        </div>

        <h1 style={{
          fontSize: 32, fontWeight: 600, color: "#e4f5ec",
          letterSpacing: "-0.02em", lineHeight: 1.2, margin: "0 0 14px",
        }}>
          {data.hero.title}
        </h1>
        <p style={{ fontSize: 16, color: "#7eb89a", lineHeight: 1.7, margin: 0 }}>
          {data.hero.subtitle}
        </p>

        {/* progress dots */}
        <div style={{ display: "flex", gap: 6, marginTop: 24 }}>
          {data.sections.map((_, i) => (
            <div key={i} style={{
              width: i === 0 ? 20 : 6, height: 6, borderRadius: 3,
              background: i === 0 ? "#3ddc84" : "#1a3d28",
              transition: "all 0.3s",
            }} />
          ))}
        </div>
      </div>

      {/* ── Sections ── */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 80px" }}>
        {data.sections.map((section, i) => (
          <Section key={section.id + lang} section={section} delay={i * 40} />
        ))}

        {/* Footer CTA */}
        <AnimSection delay={100}>
          <div style={{
            background: "linear-gradient(135deg, #071a10 0%, #0a2416 100%)",
            border: "1px solid rgba(61,220,132,0.25)",
            borderRadius: 14, padding: "28px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>🚀</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#e4f5ec", marginBottom: 8 }}>
              {lang === "en" ? "Ready to transform your farm?" : "क्या आप अपने खेत को बदलने के लिए तैयार हैं?"}
            </div>
            <div style={{ fontSize: 14, color: "#7eb89a", marginBottom: 20, lineHeight: 1.6 }}>
              {lang === "en"
                ? "Get your Crop Sense kit. Setup in under 10 minutes. AI irrigation active from day one."
                : "अपना Crop Sense किट लें। 10 मिनट में सेटअप। पहले दिन से AI सिंचाई चालू।"}
            </div>
            <button onClick={handleLogin} style={{
              background: "#10b981", color: "#030f0a", border: "none",
              padding: "12px 28px", borderRadius: 30, fontSize: 14, fontWeight: 600,
              cursor: "pointer", letterSpacing: "0.01em",
            }}>
              {lang === "en" ? "Get started →" : "शुरू करें →"}
            </button>
          </div>
        </AnimSection>
      </div>
    </div>
  );
}