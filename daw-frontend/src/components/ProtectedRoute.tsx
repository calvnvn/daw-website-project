import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

export default function ProtectedRoute() {
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const verifyUserSession = async () => {
      const token = localStorage.getItem("daw_token");
      if (!token) {
        setIsAuthenticated(false);
        setIsVerifying(false);
        return;
      }
      try {
        const response = await fetch("http://localhost:5000/api/auth/me", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          console.warn("Session expired or invalid token.");
          localStorage.removeItem("daw_token");
          localStorage.removeItem("daw_user");
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Auth verification failed:", error);
        setIsAuthenticated(false);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyUserSession();
  }, [location.pathname]);

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <ShieldCheck className="w-10 h-10 text-daw-green animate-pulse mb-4" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">
          Verifying Secure Session...
        </p>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/admin/login" replace />;
}
