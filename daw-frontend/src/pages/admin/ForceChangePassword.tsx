import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Key, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function ForceChangePassword() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi dasar
    if (newPassword.length < 6) {
      toast.warning("Password Terlalu Pendek", {
        description: "Password baru harus memiliki setidaknya 6 karakter.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Password Tidak Cocok", {
        description: "Pastikan konfirmasi password sama persis.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post("/auth/force-change-password", {
        newPassword,
      });

      // Ambil token yang tersimpan (karena di Login.tsx kita simpan token sementaranya)
      const currentToken = localStorage.getItem("daw_token");

      if (!currentToken)
        throw new Error("Sesi tidak valid, silakan login ulang.");

      // Panggil /auth/me untuk mendapatkan data user lengkap beserta permissions
      const meResponse = await api.get("/auth/me");
      const userData = meResponse.data;

      // SINKRONISASI KE AUTH CONTEXT
      login(userData, currentToken);

      toast.success("Password Updated!", {
        description: response.data.message || "Akun Anda kini sepenuhnya aman.",
      });
      navigate("/admin", { replace: true });
    } catch (error: any) {
      toast.error("Update Failed", {
        description:
          error.response?.data?.message ||
          "Gagal menghubungkan ke server. Silakan coba lagi",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Ornaments (Biar ga sepi) */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-daw-green/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="mx-auto w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-6">
          <ShieldCheck className="w-8 h-8 text-daw-green" />
        </div>
        <h2 className="text-center text-3xl font-serif font-bold text-slate-900">
          Secure Your Account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Ini adalah kali pertama Anda login. Silakan ubah kata sandi sementara
          Anda.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* New Password Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-sm transition-all"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-daw-green transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-sm transition-all"
                  placeholder="Type password again"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Update Password & Continue"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
