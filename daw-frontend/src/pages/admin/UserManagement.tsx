import { useState, useEffect } from "react";
import {
  Search,
  UserPlus,
  Shield,
  Key,
  ShieldAlert,
  ShieldCheck,
  X,
  Trash2,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "Superadmin" | "Editor" | "Viewer";
  status: "Active" | "Suspended";
  lastLogin: string | null;
  createdAt: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = localStorage.getItem("userId");

  // Fungsi Fetch Data dari API
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Api instance (Token otomatis terbawa)
      const response = await api.get("/users");
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Gagal memuat daftar user.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Role otomatis di-set (hardcoded) ke Editor
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "Editor",
  });

  const [tempCredentials, setTempCredentials] = useState<{
    email: string;
    pass: string;
  } | null>(null);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTempCredentials(null);
    setFormData({ name: "", email: "", role: "Editor" }); // Reset form
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleAddUser = async () => {
    if (!formData.name || !formData.email) {
      return toast.error("Please fill in all required fields.");
    }

    const loadingToast = toast.loading("Creating user account...");
    try {
      const response = await api.post("/users", formData);
      const result = response.data;

      // Tampilkan password sementara
      toast.success("User account created successfully!", {
        id: loadingToast,
      });

      fetchUsers();

      setTempCredentials({ email: formData.email, pass: result.tempPassword });
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to invite User.", {
        id: loadingToast,
      });
    }
  };

  const toggleUserStatus = async (user: AdminUser) => {
    if (user.id === currentUserId) {
      return toast.error("Safety Breach", {
        description:
          "You cannot suspend your own account to prevent system lockout.",
      });
    }

    const newStatus = user.status === "Active" ? "Suspended" : "Active";
    const actionText = newStatus === "Active" ? "mengaktifkan" : "menangguhkan";

    try {
      await api.put(`/users/${user.id}`, { ...user, status: newStatus });
      toast.success(`Berhasil ${actionText} user.`);
      fetchUsers();
    } catch (error) {
      toast.error("Gagal mengubah status user.");
      console.error(error);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    const loadingToast = toast.loading("Menghapus user...");
    const targetUser = users.find((u) => u.id === id);

    // 🛡️ Guard: Jangan hapus diri sendiri atau Superadmin
    if (id === currentUserId) {
      return toast.error("Action Denied", {
        description: "Suicide prevention active: You cannot delete yourself.",
      });
    }
    if (targetUser?.role === "Superadmin") {
      return toast.error("Action Denied", {
        description: "Superadmin accounts are immutable and cannot be deleted.",
      });
    }
    try {
      await api.delete(`/users/${id}`);
      toast.success("User deleted successfully.", { id: loadingToast });
      fetchUsers();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Cannot delete Superadmin.",
        {
          id: loadingToast,
        },
      );
    }
  };
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Superadmin":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "Editor":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "Viewer":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            User Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage admin accounts and system access permissions.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
        >
          <UserPlus className="w-5 h-5" />
          <span>Invite New User</span>
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search users by name or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">System Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Login</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                /* --- LOADING STATE --- */
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-6 h-6 border-2 border-daw-green border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-slate-500">Loading users...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                /* --- DATA ITERATION --- */
                filteredUsers.map((user) => {
                  // 🛡️ LOGIKA PROTEKSI (Dihitung per baris user)
                  const isSelf = user.id === currentUserId;
                  const isSuperadmin = user.role === "Superadmin";

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 text-slate-500 font-bold uppercase">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 group-hover:text-daw-green transition-colors">
                              {user.name}{" "}
                              {isSelf && (
                                <span className="text-xs text-slate-400 ml-1">
                                  (You)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${getRoleBadgeColor(user.role)}`}
                        >
                          {isSuperadmin && <Shield className="w-3.5 h-3.5" />}
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.status === "Active" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-600">
                            <ShieldCheck className="w-4 h-4" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-500">
                            <ShieldAlert className="w-4 h-4" /> Suspended
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600">
                          {user.lastLogin
                            ? new Date(user.lastLogin).toLocaleDateString()
                            : "Never"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {/* --- ACTION BUTTONS --- */}
                        <div className="flex items-center justify-end gap-3 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300">
                          {/* 1. SUSPEND BUTTON */}
                          <div className="relative flex items-center justify-center group/tooltip">
                            <button
                              onClick={() => !isSelf && toggleUserStatus(user)}
                              disabled={isSelf}
                              className={`p-2 rounded-lg transition-colors ${
                                isSelf
                                  ? "opacity-20 cursor-not-allowed text-slate-300"
                                  : user.status === "Active"
                                    ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                    : "text-slate-400 hover:text-green-600 hover:bg-green-50"
                              }`}
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                            <span className="absolute -top-8 scale-0 transition-all rounded bg-slate-800 p-2 text-[10px] text-white group-hover/tooltip:scale-100 z-10 whitespace-nowrap shadow-lg">
                              {isSelf
                                ? "Cannot suspend yourself"
                                : user.status === "Active"
                                  ? "Suspend User"
                                  : "Reactivate User"}
                            </span>
                          </div>
                          {/* 2. RESET PASSWORD BUTTON */}
                          <div className="relative flex items-center justify-center group/tooltip">
                            <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Key className="w-4 h-4" />
                            </button>
                            <span className="absolute -top-8 scale-0 transition-all rounded bg-slate-800 p-2 text-[10px] text-white group-hover/tooltip:scale-100 z-10 whitespace-nowrap shadow-lg">
                              Reset Password
                            </span>
                          </div>
                          {/* 3. DELETE BUTTON */}
                          <div className="relative flex items-center justify-center group/tooltip">
                            <button
                              onClick={() =>
                                !isSelf &&
                                !isSuperadmin &&
                                handleDeleteUser(user.id)
                              }
                              disabled={isSelf || isSuperadmin}
                              className={`p-2 rounded-lg transition-colors ${
                                isSelf || isSuperadmin
                                  ? "opacity-20 cursor-not-allowed text-slate-300"
                                  : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <span className="absolute -top-8 scale-0 transition-all rounded bg-slate-800 p-2 text-[10px] text-white group-hover/tooltip:scale-100 z-10 whitespace-nowrap shadow-lg">
                              {isSelf
                                ? "Cannot delete yourself"
                                : isSuperadmin
                                  ? "Superadmin is protected"
                                  : "Delete User"}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                /* --- EMPTY STATE --- */
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-sm text-slate-500">
                      No users found matching your search.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* CONDITIONAL RENDERING: Cek apakah ada kredensial sementara */}
            {tempCredentials ? (
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-in zoom-in duration-300">
                  <ShieldCheck className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-serif font-bold text-slate-900">
                    User Created!
                  </h3>
                  <p className="text-sm text-slate-500 mt-2">
                    Please securely share this temporary credential with the new
                    user. It will not be shown again.
                  </p>
                </div>

                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-left space-y-3 relative">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Email Address
                    </p>
                    <p className="text-sm font-medium text-slate-900">
                      {tempCredentials.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Temporary Password
                    </p>
                    <p className="text-xl font-mono font-bold text-slate-900 tracking-wider bg-white px-3 py-2 rounded border border-slate-200 inline-block w-full text-center shadow-inner select-all">
                      {tempCredentials.pass}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    // Logika Copy & Cleanup
                    const copyText = `Login to DAW Group Admin:\nEmail: ${tempCredentials.email}\nPassword: ${tempCredentials.pass}`;
                    navigator.clipboard.writeText(copyText);

                    toast.success("Credentials copied to clipboard!", {
                      description: "You can now paste it securely to the user.",
                    });

                    // Tutup modal & bersihkan sisa data
                    setIsModalOpen(false);
                    setTempCredentials(null);
                    setFormData({ name: "", email: "", role: "Editor" });
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-daw-green hover:bg-[#003b1c] text-white rounded-xl font-bold transition-colors shadow-md"
                >
                  <Key className="w-5 h-5" /> Copy Credentials & Close
                </button>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h2 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-daw-green" /> Invite User
                  </h2>
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      setFormData({ name: "", email: "", role: "Editor" }); // Reset form saat cancel
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. john@daw.co.id"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      System Role
                    </label>
                    <div className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed">
                      <Shield className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">
                        Editor (Default)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" /> A secure temporary
                      password will be generated.
                    </p>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      setFormData({ name: "", email: "", role: "Editor" }); // Reset form saat cancel
                    }}
                    className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddUser}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
                  >
                    Generate Credentials
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
