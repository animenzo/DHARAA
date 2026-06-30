// import { StrictMode } from "react";
// import { createRoot } from "react-dom/client";
// import "./index.css";
// import App from "./App.jsx";
// import { AuthProvider } from "./context/AuthContext.jsx";
// import { BrowserRouter } from "react-router-dom";
// import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// // import * as serviceWorkerRegistration from './serviceWorkerRegistration';
// const queryClient = new QueryClient();
// createRoot(document.getElementById("root")).render(
//   <StrictMode>
//     <BrowserRouter>
//     <QueryClientProvider client={queryClient}>
//       <AuthProvider>
//         <App />
//       </AuthProvider>
//       </QueryClientProvider>
//     </BrowserRouter>
//   </StrictMode>,
// );


// // serviceWorkerRegistration.register();

// frontend/src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx"; // ← NEW Phase 3
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus — real-time data comes via Socket.IO
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000, // 30 seconds
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {/*
          Provider order matters:
          1. AuthProvider   — provides user + isAuthenticated
          2. SocketProvider — reads user from AuthContext to join the right room
          3. App            — all pages have access to both contexts
        */}
        <AuthProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);