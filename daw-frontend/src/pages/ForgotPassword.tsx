import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Please enter your email address.");

    setIsLoading(true);
    try {
      // ✅ FIX: Gunakan prefix /auth/ agar tidak 404
      await api.post("/auth/forgot-password", { email });
      setIsSuccess(true);
      toast.success("Recovery email sent!");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to process request.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {isSuccess ? (
          <div className="text-center space-y-6 animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-black text-slate-900 tracking-tight">
                Check Your Inbox
              </h2>
              <p className="text-sm text-slate-500 mt-2">
                We've sent a recovery link to{" "}
                <strong className="text-slate-900">{email}</strong>.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-block mt-4 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              &larr; Back to Login
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-serif font-black text-slate-900 tracking-tight">
                Forgot Password?
              </h2>
              <p className="text-sm text-slate-500 mt-2">
                Enter your DAW Group email to reset your instructions.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    disabled={isLoading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 font-medium"
                    placeholder="e.g. john@daw.co.id"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-md"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>
            <div className="text-center">
              <Link
                to="/admin/login"
                className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
