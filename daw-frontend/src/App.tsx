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

import GlobalSettings from "./pages/admin/GlobalSettings";
import AboutUsManager from "./pages/admin/AboutUsManager";
import Inbox from "./pages/admin/Inbox";
import HomepageManager from "./pages/admin/HomePageManager";
import Login from "./pages/admin/Login";
import UserManagement from "./pages/admin/UserManagement";
import InvestmentsManager from "./pages/admin/InvestmentsManager";
import { Toaster } from "sonner";
import ProtectedRoute from "./components/ProtectedRoute";
import ForceChangePassword from "./pages/admin/ForceChangePassword";
import ManageBusinesses from "./pages/admin/ManageBusinesses";
import ContentManager from "./pages/admin/ContentManager";
import DynamicPage from "./pages/public/DynamicPage";
import ForgotPassword from "./pages/admin/ForgotPassword";
import ResetPassword from "./pages/admin/ResetPassword";
import ProjectForm from "./pages/admin/ProjectForm";
import RoleManagement from "./pages/admin/RoleManagement";
import { AuthProvider } from "./contexts/AuthContext";

function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          style: { border: "1px solid #004B23" },
        }}
      />
      <Routes>
        {/* Public Route */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/businesses" element={<OurBusinesses />} />
          <Route path="/contact-us" element={<ContactUs />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="page/:slug" element={<DynamicPage />} />
        </Route>

        {/* Auth Route */}
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/force-change-password"
          element={<ForceChangePassword />}
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Admin Route */}
        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<ProjectManagement />} />
            <Route path="/admin/projects/create" element={<ProjectForm />} />
            <Route path="/admin/projects/edit/:id" element={<ProjectForm />} />
            <Route element={<ProtectedRoute permission="manage_content" />}>
              <Route path="content" element={<ContentManager />} />
            </Route>

            <Route element={<ProtectedRoute permission="manage_settings" />}>
              <Route path="settings" element={<GlobalSettings />} />
            </Route>

            <Route element={<ProtectedRoute permission="manage_homepage" />}>
              <Route path="home" element={<HomepageManager />} />
            </Route>

            <Route element={<ProtectedRoute permission="manage_businesses" />}>
              <Route path="businesses" element={<ManageBusinesses />} />
            </Route>

            <Route element={<ProtectedRoute permission="manage_about" />}>
              <Route path="about" element={<AboutUsManager />} />
            </Route>

            <Route element={<ProtectedRoute permission="manage_inbox" />}>
              <Route path="inbox" element={<Inbox />} />
            </Route>

            <Route element={<ProtectedRoute permission="manage_investments" />}>
              <Route path="investments" element={<InvestmentsManager />} />
            </Route>

            {/* User & Role Management (Kunci dengan manage_users) */}
            <Route element={<ProtectedRoute permission="manage_users" />}>
              <Route path="users" element={<UserManagement />} />
              <Route path="roles" element={<RoleManagement />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
