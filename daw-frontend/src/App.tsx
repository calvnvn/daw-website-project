import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { ContentProvider } from "@/contexts/ContentContext";

import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ApprovalCenter from "./pages/admin/approvals/ApprovalCenter";

// Lazy Import Public Frontend
const Home = lazy(() => import("./pages/public/Home"));
const AboutUs = lazy(() => import("./pages/public/AboutUs"));
const OurBusinesses = lazy(() => import("./pages/public/OurBusinesses"));
const ContactUs = lazy(() => import("./pages/public/ContactUs"));
const ProjectDetail = lazy(() => import("./pages/public/ProjectDetail"));
const DynamicPage = lazy(() => import("./pages/public/DynamicPage"));

// Lazy Import Auth
const Login = lazy(() => import("./pages/admin/system/auth/Login"));

// Lazy Import Admin Dashboard
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const ProjectManagement = lazy(() => import("./pages/admin/ProjectManagement"));
const GlobalSettings = lazy(
  () => import("./pages/admin/system/GlobalSettings"),
);
const AboutUsManager = lazy(() => import("./pages/admin/about/AboutUsManager"));
const Inbox = lazy(() => import("./pages/admin/Inbox"));
const HomepageManager = lazy(() => import("./pages/admin/HomePageManager"));
const UserManagement = lazy(
  () => import("./pages/admin/system/UserManagement"),
);
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
const RoleManagement = lazy(
  () => import("./pages/admin/system/RoleManagement"),
);

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-slate-50">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-daw-green border-t-transparent"></div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" richColors />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* 1. Public Routes */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/businesses" element={<OurBusinesses />} />
            <Route path="/contact-us" element={<ContactUs />} />
            <Route path="/projects/:slug" element={<ProjectDetail />} />
            <Route path="page/:slug" element={<DynamicPage />} />
          </Route>

          {/* 2. Authentication Route (SSO OWL) */}
          <Route path="/admin/login" element={<Login />} />
          {/* Note: Password management routes commented out as per OWL integration */}

          {/* 3. Admin Routes (Protected) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              {/* Dashboard - Terbuka untuk semua Authenticated User */}
              <Route index element={<Dashboard />} />

              {/* Projects - Relative Paths */}
              <Route path="projects">
                <Route index element={<ProjectManagement />} />
                <Route path="create" element={<ProjectForm />} />
                <Route path="edit/:id" element={<ProjectForm />} />
              </Route>

              {/* Module-Specific Permissions */}
              <Route element={<ProtectedRoute permission="manage_content" />}>
                <Route
                  path="content"
                  element={
                    <ContentProvider>
                      <ContentManager />
                    </ContentProvider>
                  }
                />
              </Route>

              <Route element={<ProtectedRoute permission="manage_settings" />}>
                <Route path="settings" element={<GlobalSettings />} />
              </Route>

              <Route element={<ProtectedRoute permission="manage_homepage" />}>
                <Route path="home" element={<HomepageManager />} />
              </Route>

              <Route
                element={<ProtectedRoute permission="manage_businesses" />}>
                <Route path="businesses" element={<ManageBusinesses />} />
              </Route>

              <Route element={<ProtectedRoute permission="manage_about" />}>
                <Route path="about" element={<AboutUsManager />} />
              </Route>

              <Route element={<ProtectedRoute permission="manage_inbox" />}>
                <Route path="inbox" element={<Inbox />} />
              </Route>

              <Route
                element={<ProtectedRoute permission="manage_investments" />}>
                <Route path="investments" element={<InvestmentsManager />} />
              </Route>

              <Route element={<ProtectedRoute permission="manage_users" />}>
                <Route path="users" element={<UserManagement />} />
                <Route path="roles" element={<RoleManagement />} />
              </Route>
              <Route element={<ProtectedRoute permission="manage_approvals" />}>
                <Route path="approvals" element={<ApprovalCenter />} />
              </Route>
            </Route>
          </Route>

          {/* 4. Catch-all 404 Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
