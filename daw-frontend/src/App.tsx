import { Routes, Route } from "react-router-dom";
import Home from "./pages/public/Home";
import MainLayout from "./pages/public/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import AboutUs from "./pages/public/AboutUs";
import OurBusinesses from "./pages/public/OurBusinesses";
import ContactUs from "./pages/public/ContactUs";
import ProjectDetail from "./pages/public/ProjectDetail";
import Dashboard from "./pages/admin/Dashboard";
import ProjectManagement from "./pages/admin/ProjectManagement";
import CreateProject from "./pages/admin/CreateProject";
import GlobalSettings from "./pages/admin/GlobalSettings";
import AboutUsManager from "./pages/admin/AboutUsManager";
import Inbox from "./pages/admin/Inbox";
import HomepageManager from "./pages/admin/HomePageManager";
import Login from "./pages/admin/Login";
import UserManagement from "./pages/admin/UserManagement";
import InvestmentsManager from "./pages/admin/InvestmentsManager";
import { Toaster } from "sonner";
import EditProject from "./pages/admin/EditProject";
import ProtectedRoute from "./components/ProtectedRoute";
import ForceChangePassword from "./pages/admin/ForceChangePassword";

function App() {
  return (
    <>
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          style: { border: "1px solid #004B23" },
        }}
      />
      {/* Public Route */}
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/businesses" element={<OurBusinesses />} />
          <Route path="/contact-us" element={<ContactUs />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
        </Route>

        {/* Admin Login */}
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/force-change-password"
          element={<ForceChangePassword />}
        />
        {/* Admin Route */}
        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<ProjectManagement />} />
            <Route path="projects/create" element={<CreateProject />} />
            <Route path="settings" element={<GlobalSettings />} />
            <Route path="home" element={<HomepageManager />} />
            <Route path="about" element={<AboutUsManager />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="investments" element={<InvestmentsManager />} />
            <Route path="/admin/projects/edit/:id" element={<EditProject />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}

export default App;
