import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";

import MainLayout from "./pages/public/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";

// Lazy Import Public Frontend
const Home = lazy(() => import("./pages/public/Home"));
const AboutUs = lazy(() => import("./pages/public/AboutUs"));
const OurBusinesses = lazy(() => import("./pages/public/OurBusinesses"));
const ContactUs = lazy(() => import("./pages/public/ContactUs"));
const ProjectDetail = lazy(() => import("./pages/public/ProjectDetail"));
const DynamicPage = lazy(() => import("./pages/public/DynamicPage"));

// Lazy Import Auth
const Login = lazy(() => import("./pages/admin/Login"));
const ForceChangePassword = lazy(
  () => import("./pages/admin/ForceChangePassword"),
);
const ForgotPassword = lazy(() => import("./pages/admin/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/admin/ResetPassword"));

// Lazy Import Admin Dashboard
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const ProjectManagement = lazy(() => import("./pages/admin/ProjectManagement"));
const GlobalSettings = lazy(() => import("./pages/admin/GlobalSettings"));
const AboutUsManager = lazy(() => import("./pages/admin/AboutUsManager"));
const Inbox = lazy(() => import("./pages/admin/Inbox"));
const HomepageManager = lazy(() => import("./pages/admin/HomePageManager"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const InvestmentsManager = lazy(
  () => import("./pages/admin/InvestmentsManager"),
);
const ManageBusinesses = lazy(
  () => import("./pages/admin/business/ManageBusinesses"),
);
const ContentManager = lazy(
  () => import("./pages/admin/content/ContentManager"),
);
const ProjectForm = lazy(() => import("./pages/admin/ProjectForm"));
const RoleManagement = lazy(() => import("./pages/admin/RoleManagement"));

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-slate-50">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-daw-green border-t-transparent"></div>
  </div>
);

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
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Route */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/businesses" element={<OurBusinesses />} />
            <Route path="/contact-us" element={<ContactUs />} />
            <Route path="/projects/:slug" element={<ProjectDetail />} />
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
              <Route
                path="/admin/projects/edit/:id"
                element={<ProjectForm />}
              />
              <Route element={<ProtectedRoute permission="manage_content" />}>
                <Route path="content" element={<ContentManager />} />
              </Route>

              <Route element={<ProtectedRoute permission="manage_settings" />}>
                <Route path="settings" element={<GlobalSettings />} />
              </Route>

              <Route element={<ProtectedRoute permission="manage_homepage" />}>
                <Route path="home" element={<HomepageManager />} />
              </Route>

              <Route
                element={<ProtectedRoute permission="manage_businesses" />}
              >
                <Route path="businesses" element={<ManageBusinesses />} />
              </Route>

              <Route element={<ProtectedRoute permission="manage_about" />}>
                <Route path="about" element={<AboutUsManager />} />
              </Route>

              <Route element={<ProtectedRoute permission="manage_inbox" />}>
                <Route path="inbox" element={<Inbox />} />
              </Route>

              <Route
                element={<ProtectedRoute permission="manage_investments" />}
              >
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
      </Suspense>
    </AuthProvider>
  );
}

export default App;
