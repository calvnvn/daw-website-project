import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

/**
 * APPLICATION: Core Entry & Routing Engine
 * Orchestrates global providers, asynchronous module resolution, and granular access control.
 */

// CORE LAYOUTS
const MainLayout = lazy(() => import("./layouts/MainLayout"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));

// PUBLIC DOMAINS
const Home = lazy(() => import("./pages/public/Home"));
const AboutUs = lazy(() => import("./pages/public/AboutUs"));
const OurBusinesses = lazy(() => import("./pages/public/OurBusinesses"));
const ContactUs = lazy(() => import("./pages/public/ContactUs"));
const ProjectDetail = lazy(() => import("./pages/public/ProjectDetail"));
const DynamicPage = lazy(() => import("./pages/public/DynamicPage"));
const NotFound = lazy(() => import("./pages/public/NotFound"));

// ADMINISTRATIVE DOMAINS
const Login = lazy(() => import("./pages/admin/system/auth/Login"));
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
const ProjectForm = lazy(() => import("./pages/admin/ProjectForm"));
const RoleManagement = lazy(
  () => import("./pages/admin/system/RoleManagement"),
);
const ApprovalCenter = lazy(
  () => import("./pages/admin/approvals/ApprovalCenter"),
);

// Resolve specialized content management module with context injection
const ContentManagerWrapper = lazy(async () => {
  const [ContentContextModule, ContentManagerModule] = await Promise.all([
    import("@/contexts/ContentContext"),
    import("./pages/admin/content/ContentManager"),
  ]);

  return {
    default: () => (
      <ContentContextModule.ContentProvider>
        <ContentManagerModule.default />
      </ContentContextModule.ContentProvider>
    ),
  };
});

// Initialize global fallback state for network-suspended components
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
          {/* ROUTE DEFINITION: Public Consumer Facing */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/businesses" element={<OurBusinesses />} />
            <Route path="/contact-us" element={<ContactUs />} />
            <Route path="/projects/:slug" element={<ProjectDetail />} />
            <Route path="page/:slug" element={<DynamicPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* ROUTE DEFINITION: Administrative Access Portal */}
          <Route path="/admin/login" element={<Login />} />

          {/* ROUTE DEFINITION: Protected Administrative Workspace */}
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />

              {/* Enforce modular project lifecycle management */}
              <Route path="projects">
                <Route index element={<ProjectManagement />} />
                <Route path="create" element={<ProjectForm />} />
                <Route path="edit/:id" element={<ProjectForm />} />
              </Route>

              {/* Enforce granular access control via permission-based guards */}
              <Route element={<ProtectedRoute permission="manage_content" />}>
                <Route path="content" element={<ContentManagerWrapper />} />
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
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
