import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom"; //  Tambah useLocation
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import logoDaw from "@/assets/logo-daw.png";
import bgImage from "@/assets/hero-bg.jpg";
import api from "@/lib/api";
import { useSettings } from "@/contexts/SettingsContext";
import { getCleanImageUrl, getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { jwtDecode } from "jwt-decode";

export default function Login() {
  const { settings } = useSettings();

  const navigate = useNavigate();
  const location = useLocation(); //  Tangkap lokasi asal dari ProtectedRoute
  const from = location.state?.from?.pathname || "/admin"; // Ambil alamat asal, kalau tidak ada default ke /admin

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side Validation
    if (!email || !password) {
      toast.warning("Missing Credentials", {
        description: "Please enter both email and password.",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Ganti dawApi (OWL) jadi api (Backend Lokal lo)
      const response = await api.post("/auth/login", {
        uname: email,
        password: password,
      });

      const resData = response.data;
      if (resData.error) {
        throw new Error(
          resData.response || "Token tidak diterima dari server.",
        );
      }

      const token = resData.token;

      if (token) {
        const decoded: any = jwtDecode(token);

        const userData = {
          id: decoded.id,
          name: resData.user.name,
          email: email,
          role: decoded.role,
          permissions: resData.user.permissions,
        };
        login(userData, token);
        toast.success(`Welcome back, ${decoded.name}!`);
        navigate(from, { replace: true });
      } else {
        toast.error("Authentication Error", {
          description: "Token was not provided by the server.",
        });
      }
    } catch (err: unknown) {
      toast.error("Authentication Failed", {
        description: getErrorMessage(
          err,
          "Invalid credentials or server error",
        ),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white animate-in fade-in duration-700">
      <div className="w-full lg:w-[480px] xl:w-[500px] flex flex-col justify-center px-8 sm:px-12 md:px-16 py-12 shrink-0 relative z-10 border-r border-slate-100 shadow-[20px_0_40px_-15px_rgba(0,0,0,0.05)]">
        <div className="mb-16">
          <img
            src={
              settings?.logoUrl ? getCleanImageUrl(settings.logoUrl) : logoDaw
            }
            alt="DAW Group Logo"
            className="h-20 w-auto object-contain"
          />
        </div>

        <div className="mb-10">
          <h1 className="text-2xl font-serif font-bold text-slate-900 mb-2">
            Admin Portal
          </h1>
          <p className="text-slate-500 text-sm">
            Sign in using your <strong>Account</strong> to manage content.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-slate-400" />
              </div>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@daw.co.id"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-900 transition-all font-medium text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-slate-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-900 transition-all font-medium font-sans tracking-wide text-sm"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white py-3 rounded-lg font-bold transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed group text-sm">
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            <div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Authenticated by DAW System</span>
            </div>
          </div>
        </form>
      </div>

      <div className="hidden lg:flex flex-1 relative bg-[#081C15] overflow-hidden items-end p-12">
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center opacity-30 mix-blend-luminosity transform scale-105"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#081C15] via-[#081C15]/40 to-transparent" />
        <div className="relative z-10 w-full flex justify-between items-end border-t border-white/10 pt-6">
          <div>
            <h2 className="text-white/80 font-serif text-lg tracking-wide mb-1">
              Content Management System
            </h2>
            <p className="text-daw-green text-sm font-medium tracking-widest uppercase">
              PT Dharma Agung Wijaya
            </p>
          </div>
          <div className="text-right text-white/40 text-xs font-mono">
            {new Date().getFullYear()} © DAW Group
          </div>
        </div>
      </div>
    </div>
  );
}
