import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom"; //  Tambah useLocation
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import logoDaw from "@/assets/logo-daw.png";
import bgImage from "@/assets/hero-bg.jpg";
import api from "@/lib/api";
import { Link } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation(); //  Tangkap lokasi asal dari ProtectedRoute

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Ambil alamat asal, kalau tidak ada default ke /admin
  const from = location.state?.from?.pathname || "/admin";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.warning("Missing Credentials", {
        description: "Please enter both email and password.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post("/auth/login", { email, password });
      const data = response.data;

      // 🕵️ DEBUG: Minta Pak Rama liat ini di Console Browser (F12)
      console.log("🔥 [DEBUG LOGIN] Data dari Server:", data);

      if (!data || !data.accessToken) {
        throw new Error("Token tidak diterima dari server.");
      }

      // Simpan satu per satu dengan aman
      localStorage.setItem("daw_token", data.accessToken);
      localStorage.setItem("userId", data.id || "");

      // Simpan User Info dengan Fallback (Cadangan)
      const userData = {
        id: data.id,
        name: data.name || "Admin DAW", // Kalau name undefined, kasih nama default
        email: data.email,
        role: data.role,
      };
      localStorage.setItem("daw_user", JSON.stringify(userData));

      if (data.needsPasswordChange) {
        toast.info("Security Check", {
          description: "Please change your password.",
        });
        navigate("/force-change-password");
      } else {
        // Gunakan userData.name yang sudah diproteksi fallback
        if (data.accessToken && data.name) {
          // Pastikan name ada
          localStorage.setItem("daw_token", data.accessToken);
          localStorage.setItem("daw_user", JSON.stringify(data));
          toast.success(`Welcome, ${data.name}!`);
          navigate(from, { replace: true });
        } else {
          // Kalau name atau token gak ada, refuse masuk!
          console.error("Data user tidak lengkap:", data);
          toast.error("Data user tidak lengkap dari server.");
        }
      }
    } catch (err: any) {
      toast.error("Authentication Failed", {
        description: err.response?.data?.message || "Invalid credentials",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ FIXED: Return sekarang berada di level atas komponen (bukan di dalam handleLogin)
  return (
    <div className="min-h-screen w-full flex bg-white animate-in fade-in duration-700">
      <div className="w-full lg:w-[480px] xl:w-[500px] flex flex-col justify-center px-8 sm:px-12 md:px-16 py-12 shrink-0 relative z-10 border-r border-slate-100 shadow-[20px_0_40px_-15px_rgba(0,0,0,0.05)]">
        <div className="mb-16">
          <img
            src={logoDaw}
            alt="DAW Group Logo"
            className="h-14 w-auto object-contain"
          />
        </div>

        <div className="mb-10">
          <h1 className="text-2xl font-serif font-bold text-slate-900 mb-2">
            Admin Portal
          </h1>
          <p className="text-slate-500 text-sm">
            Sign in to manage DAW Group content.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-slate-400" />
              </div>
              <input
                type="email"
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
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <div className="flex justify-end mb-4">
            <Link
              to="/forgot-password"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              Forgot Password?
            </Link>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white py-3 rounded-lg font-bold transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed group text-sm"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Authenticate</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            <div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Restricted Access</span>
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
