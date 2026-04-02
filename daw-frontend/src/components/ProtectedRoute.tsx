import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ShieldCheck, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  permission?: string; // Fitur tambahan untuk kunci rute spesifik
}

export default function ProtectedRoute({ permission }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, can } = useAuth();
  const location = useLocation();

  // 1. Loading State: Tampilan saat AuthContext sedang sinkronisasi dengan Backend
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <ShieldCheck className="w-12 h-12 text-daw-green animate-pulse mb-4" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">
          Securing Environment...
        </p>
      </div>
    );
  }

  // 2. Not Authenticated: Tendang ke login jika tidak ada token/user
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // 3. Permission Denied: Jika user login tapi nekat nembak URL yang dia gak punya izinnya
  if (permission && !can(permission)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-500 max-w-xs mx-auto mb-6">
          You don't have the required permission to access this module.
        </p>
        <button
          onClick={() => (window.location.href = "/admin")}
          className="text-sm font-bold text-daw-green hover:underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // 4. All Green: Izinkan masuk
  return <Outlet />;
}
