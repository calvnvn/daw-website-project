import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import logoDaw from "@/assets/logo-daw.png";
import bgImage from "@/assets/hero-bg.jpg";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Simulasi proses autentikasi
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
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("daw_token", data.accessToken);

        localStorage.setItem(
          "daw_user",
          JSON.stringify({
            name: data.name,
            email: data.email,
            role: data.role,
          }),
        );

        toast.success(`Welcome back, ${data.name}!`, {
          description: "Successfully authenticated to DAW Admin Portal.",
        });

        navigate("/admin");
      } else {
        toast.error("Authentication Failed", {
          description: data.message || "Invalid email or password.",
        });
      }
    } catch {
      toast.error("Server Error", {
        description: "Connection to backend failed. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white animate-in fade-in duration-700">
      {/* KOLOM KIRI: Form Login */}
      <div className="w-full lg:w-[480px] xl:w-[500px] flex flex-col justify-center px-8 sm:px-12 md:px-16 py-12 shrink-0 relative z-10 border-r border-slate-100 shadow-[20px_0_40px_-15px_rgba(0,0,0,0.05)]">
        {/* Logo Area */}
        <div className="mb-16">
          <img
            src={logoDaw}
            alt="DAW Group Logo"
            className="h-14 w-auto object-contain"
          />
        </div>

        {/* Heading */}
        <div className="mb-10">
          <h1 className="text-2xl font-serif font-bold text-slate-900 mb-2">
            Admin Portal
          </h1>
          <p className="text-slate-500 text-sm">
            Sign in to manage DAW Group content and configurations.
          </p>
        </div>

        {/* Form Area */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email Input */}
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

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Password
              </label>
            </div>
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

          {/* Security Badge & Submit Button */}
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
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Restricted Access</span>
            </div>
          </div>
        </form>
      </div>

      {/* KOLOM KANAN: Visual Image (Lebih Sepi, Lebih Mahal) */}
      <div className="hidden lg:flex flex-1 relative bg-[#081C15] overflow-hidden items-end p-12">
        {/* Gambar Latar Belakang dari Aset Lokal */}
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center opacity-30 mix-blend-luminosity transform scale-105"
          style={{ backgroundImage: `url(${bgImage})` }}
        />

        {/* Gradient Overlay untuk meredam gambar agar teks terbaca */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#081C15] via-[#081C15]/40 to-transparent" />

        {/* Content Overlay (Sangat Minimalis) */}
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
