import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { ShieldCheck } from "lucide-react";
import api from "@/lib/api";

export default function ProtectedRoute() {
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();
  const hasVerified = useRef(false); // Ref untuk memastikan verifikasi hanya 1x di awal

  useEffect(() => {
    const verifyUserSession = async () => {
      const token = localStorage.getItem("daw_token");

      if (!token) {
        setIsAuthenticated(false);
        setIsVerifying(false);
        return;
      }

      // Jika sudah pernah diverifikasi di sesi ini, jangan tanya server lagi
      // Biarkan Axios Interceptor yang handle jika token mati mendadak
      if (hasVerified.current) {
        setIsVerifying(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");
        if (response.status === 200) {
          setIsAuthenticated(true);
          hasVerified.current = true; // Tandai sukses
        }
      } catch (error) {
        console.warn("Session invalid. ", error);
        localStorage.removeItem("daw_token");
        localStorage.removeItem("daw_user");
        setIsAuthenticated(false);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyUserSession();
    // Dependency kosongan [] agar verifikasi API hanya jalan pas Page Refresh / First Load
  }, []);

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <ShieldCheck className="w-10 h-10 text-daw-green animate-pulse mb-4" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
          Verifying Secure Session...
        </p>
      </div>
    );
  }

  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/admin/login" state={{ from: location }} replace />
  );
}
