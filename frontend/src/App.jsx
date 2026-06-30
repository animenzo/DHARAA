import { Routes, Route, Navigate } from "react-router-dom";
// import Navbar from "./components/Navbar";

// import Dashboard from "./pages/Dashboard";
import Login from "./components/home/Login";
import PrivateRoute from "./routes/PrivateRoutes";
import Home from "./pages/Home";
import { useAuth } from "./context/AuthContext";
import FarmForm from "./components/forms/FarmForm";
import ScheduleCreate from "./components/schedules/ScheduleCreate";
import ScheduleList from "./pages/ScheduleList";
import ScheduleEdit from "./components/schedules/ScheduleEdit";
import FarmList from "./pages/FarmList";
import FarmEdit from "./components/forms/FarmEdit";
// import ResetPassword from "./components/home/ResetPassword";
// import ForgotPassword from "./components/home/ForgotPassword";
// Layouts
import DashboardLayout from './components/DashboardLayout';
import UserProfile from "./pages/UserProfile";
import WeatherPage from "./pages/WeatherPage";
;
import AICropAdvisor from "./pages/AICropAdvisor";

import IoTDashboard from "./pages/IoTDashboard";
import HowItWorks from "./pages/HowItWorks";
import AgriInfo from "./pages/AgriInfo";


function App() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {/* {isAuthenticated && <Navbar />} */}

      <Routes>
        {/* ROOT */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              // <Navigate to="/dashboard" replace />
              <Navigate to="/iot" replace />

            ) : (
              <Navigate to="/home" replace />
            )
          }
        />

        {/* PUBLIC */}
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/howitworks" element={<HowItWorks />} />
        <Route path="/agriinfo" element={<AgriInfo />} />


        
        {/* <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} /> */}

        {/* PROTECTED */}
        <Route element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }>
          <Route
            path="/dashboard"
            // element={
            //   <Dashboard />
            // }
            element={<Navigate to="/iot" replace />}
          />

          <Route
            path="/farms"
            element={

              <FarmList />

            }
          />
          <Route
            path="/farms/new"
            element={

              <FarmForm />

            }
          />
          <Route
            path="/farms/:id/edit"
            element={

              <FarmEdit />

            }
          />

          {/* create all schedules */}
          <Route
            path="/schedules"
            element={

              <ScheduleList />

            }
          />

          <Route
            path="/schedules/new"
            element={

              <ScheduleCreate />

            }
          />

          <Route
            path="/schedules/:id/edit"
            element={

              <ScheduleEdit />

            }
          />

          <Route
            path="/profile"
            element={

              <UserProfile />

            }
          />
          <Route
            path="/weather"
            element={

              <WeatherPage />

            }
          />
          {/* AI Crop Advisor (NEW) */}
          <Route
            path="/ai-advisor"
            element={<AICropAdvisor />}
          />
           <Route path="/iot"  element={<IoTDashboard />} />


        </Route>
        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
