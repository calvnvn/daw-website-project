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
  ChevronDown,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/utils";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  owl_username: string;
  roleId: string;
  roleData?: { name: string };
  status: "Active" | "Suspended";
  lastLogin: string | null;
  createdAt: string;
}

interface RoleData {
  id: string;
  name: string;
}

const timeAgo = (dateString: string | null) => {
  if (!dateString) return "Belum pernah login";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Baru saja";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m yang lalu`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}j yang lalu`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} hari lalu`;

  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleData[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fungsi Fetch Data dari API
  const fetchUsersAndRoles = async () => {
    setIsLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.allSettled([
        api.get("/users"),
        api.get("/roles"),
      ]);

      if (usersRes.status === "fulfilled") {
        setUsers(usersRes.value.data);
      } else {
        toast.error("Gagal memuat daftar user.");
      }

      if (rolesRes.status === "fulfilled") {
        setRoles(rolesRes.value.data);
      } else {
        console.warn(
          "Gagal memuat roles (403 Forbidden). Cek izin akses token Anda.",
        );
        setRoles([]); // Kosongkan agar tidak crash
      }

      if (rolesRes.status === "rejected") {
        console.error(
          "Roles fetch error details:",
          rolesRes.reason?.response?.data,
        );
      }
    } catch (error) {
      console.error("Critical Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  const [formData, setFormData] = useState({
    owl_username: "",
    email: "",
    roleId: "",
  });

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({ owl_username: "", email: "", roleId: "" }); // Reset form
  };

  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.name?.toLowerCase() || "").includes(searchLower) ||
      (user.email?.toLowerCase() || "").includes(searchLower) ||
      (user.owl_username?.toLowerCase() || "").includes(searchLower) // Tambahkan ini!
    );
  });

  const handleAddUser = async () => {
    if (!formData.owl_username || !formData.roleId) {
      return toast.error("OWL Username dan System Role wajib diisi!");
    }

    const loadingToast = toast.loading("Mendaftarkan akses user ke CMS...");
    try {
      await api.post("/users", formData);

      toast.success("User OWL berhasil didaftarkan!", {
        id: loadingToast,
        description:
          "User dapat langsung login menggunakan password DAW mereka.",
      });

      fetchUsersAndRoles();
      handleCloseModal();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Gagal mendaftarkan user.", {
        id: loadingToast,
      });
    }
  };

  const toggleUserStatus = async (user: AdminUser) => {
    if (user.id === currentUserId) {
      return toast.error("Safety Breach", {
        description: "You cannot suspend your own account.",
      });
    }

    const newStatus = user.status === "Active" ? "Suspended" : "Active";
    const actionText = newStatus === "Active" ? "mengaktifkan" : "menangguhkan";

    try {
      // SURGICAL UPDATE: Cukup kirim status saja
      await api.put(`/users/${user.id}`, { status: newStatus });
      toast.success(`Berhasil ${actionText} user ${user.owl_username}.`);
      fetchUsersAndRoles();
    } catch (error: unknown) {
      toast.error(
        getErrorMessage(error) || "Gagal mengubah status user.",
      );
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (String(id) === String(currentUserId)) {
      return toast.error("Safety Breach", {
        description: "Self-deletion is blocked.",
      });
    }

    const targetUser = users.find((u) => String(u.id) === String(id));
    if (targetUser?.roleData?.name === "superadmin") {
      return toast.error("Action Denied", {
        description: "superadmin accounts are immutable.",
      });
    }

    toast(`Hapus Akses: ${targetUser?.owl_username}?`, {
      // Gunakan username buat konteks
      description: `Seluruh akses CMS untuk ${targetUser?.name || targetUser?.owl_username} akan dicabut.`,
      duration: Infinity,
      action: {
        label: "Hapus Permanen",
        onClick: async () => {
          const loadingToast = toast.loading(`Mencabut akses...`);
          try {
            await api.delete(`/users/${id}`);
            toast.success("Akses Dicabut", { id: loadingToast });
            fetchUsersAndRoles();
          } catch (error: unknown) {
            toast.error("Gagal", {
              id: loadingToast,
              description: getErrorMessage(error),
            });
          }
        },
      },
      cancel: { label: "Batal", onClick: () => toast.dismiss() },
    });
  };

  // --- UBAH ROLE USER ---
  const handleUpdateRole = async (userId: string, newRoleId: string) => {
    // 1. Identifikasi Target & Scope Variable
    const targetUser = users.find((u) => String(u.id) === String(userId));
    const newRole = roles.find((r) => String(r.id) === String(newRoleId));

    // FIX: Definisikan isEditingSelf di dalam scope fungsi ini
    const isEditingSelf = String(userId) === String(currentUserId);

    // 2. GUARD: Anti-Self-Demotion
    if (isEditingSelf) {
      toast.error("Security Lock", {
        description:
          "You cannot demote your own superadmin status for safety reasons.",
      });
      return;
    }

    // 3. GUARD: Hierarchy Protection (superadmin vs superadmin)
    if (targetUser?.roleData?.name === "superadmin" && !isEditingSelf) {
      toast.error("Action Denied", {
        description:
          "Hierarchy Protection: superadmin accounts are immutable by other administrators.",
      });
      return;
    }

    // --- FUNGSI EKSEKUSI API ---
    const executeUpdate = async () => {
      const loadingToast = toast.loading(
        `Provisioning ${newRole?.name} access for ${targetUser?.name}...`,
      );

      try {
        // Pastikan payload bersih
        await api.put(`/users/${userId}`, { roleId: newRoleId });
        toast.success("Role Updated", {
          id: loadingToast,
          description: `${targetUser?.owl_username} sekarang adalah ${newRole?.name}.`,
        });
        fetchUsersAndRoles();
      } catch (error: unknown) {
        toast.error("Gagal Update", {
          id: loadingToast,
          description:
            getErrorMessage(error) || "Internal server error.",
        });
        fetchUsersAndRoles(); // Revert UI
      }
    };

    // --- LOGIKA KONFIRMASI ---
    if (newRole?.name === "superadmin") {
      toast("Elevate to superadmin?", {
        description: `This grants ${targetUser?.name} full administrative control. Proceed with caution.`,
        duration: Infinity,
        action: {
          label: "Confirm & Promote",
          onClick: () => executeUpdate(),
        },
        cancel: {
          label: "Abort",
          onClick: () => {
            toast.dismiss();
            fetchUsersAndRoles(); // Reset UI dropdown jika dibatalkan
          },
        },
      });
    } else {
      executeUpdate();
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "superadmin":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "Editor":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "Viewer":
        return "bg-slate-100 text-slate-700 border-slate-200";
    }

    const customPalette = [
      "bg-emerald-100 text-emerald-700 border-emerald-200", // Nature / Fresh
      "bg-amber-100 text-amber-700 border-amber-200", // Warm / Alert
      "bg-rose-100 text-rose-700 border-rose-200", // Passion / Urgent
      "bg-indigo-100 text-indigo-700 border-indigo-200", // Tech / Corporate
      "bg-cyan-100 text-cyan-700 border-cyan-200", // Modern / Clean
      "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200", // Creative / Pop
      "bg-teal-100 text-teal-700 border-teal-200", // Professional
      "bg-orange-100 text-orange-700 border-orange-200", // Energetic
    ];

    let hash = 0;
    for (let i = 0; i < role.length; i++) {
      hash = role.charCodeAt(i) + ((hash << 5) - hash);
    }

    const colorIndex = Math.abs(hash) % customPalette.length;

    return customPalette[colorIndex];
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
            Kelola akun admin dan izin akses sistem.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm">
          <UserPlus className="w-5 h-5" />
          <span>Tambah Pengguna</span>
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
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-black">
                <th className="px-6 py-4">Identitas</th>
                <th className="px-6 py-4">Role CMS</th>
                <th className="px-6 py-4">Status Akun</th>
                <th className="px-6 py-4">Aktivitas Terakhir</th>
                <th className="px-6 py-4 text-right">Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {isLoading ? (
                /* --- LOADING STATE --- */
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-6 h-6 border-2 border-daw-green border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-bold tracking-widest uppercase text-slate-400">
                        Sinkronisasi Data...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                /* --- DATA ITERATION --- */
                filteredUsers.map((user: any) => {
                  const isSelf = String(user.id) === String(currentUserId);
                  const roleName = user.roleData?.name || "Unknown Role";
                  const isSuperadmin = roleName === "superadmin";

                  // DETEKSI STATUS SYNC SSO
                  const isPendingSync = user.name === "Menunggu Sync Login...";

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50 transition-colors group">
                      {/* KOLOM 1: IDENTITAS (OWL + LOKAL) */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          {/* Avatar Cerdas */}
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-sm border shadow-sm
                            ${isPendingSync ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-700"}`}>
                            {isPendingSync
                              ? "?"
                              : user.name.charAt(0).toUpperCase()}
                          </div>

                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <p
                                className={`text-sm font-bold ${isPendingSync ? "text-slate-400 italic" : "text-slate-900"}`}>
                                {isPendingSync
                                  ? "Belum Login (No Data)"
                                  : user.name}
                              </p>
                              {isSelf && (
                                <span className="bg-daw-green/10 text-daw-green text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded">
                                  Anda
                                </span>
                              )}
                            </div>

                            {/* Pemasangan Identitas OWL & Email */}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-mono text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase">
                                ID: {user.owl_username || "UNKNOWN"}
                              </span>
                              {!isPendingSync && user.email && (
                                <span className="text-xs text-slate-500">
                                  {user.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* KOLOM 2: TINGKAT AKSES */}
                      <td className="px-6 py-4">
                        {currentUser?.role === "superadmin" && !isSelf ? (
                          <div className="relative inline-block">
                            <select
                              value={user.roleId}
                              onChange={(e) =>
                                handleUpdateRole(user.id, e.target.value)
                              }
                              className={`appearance-none outline-none pr-8 pl-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-sm
                                ${getRoleBadgeColor(roleName)} hover:shadow-md focus:ring-2 focus:ring-daw-green/30 active:scale-[0.98]`}>
                              {roles.map((r) => (
                                <option
                                  key={r.id}
                                  value={r.id}
                                  className="text-slate-700 bg-white font-medium">
                                  {r.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm ${getRoleBadgeColor(roleName)}`}>
                            {isSuperadmin && <Shield className="w-3.5 h-3.5" />}
                            {roleName}
                          </span>
                        )}
                      </td>

                      {/* KOLOM 3: STATUS AKUN */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => !isSelf && toggleUserStatus(user)}
                          disabled={isSelf}
                          title={
                            isSelf
                              ? "Tidak bisa mengubah status sendiri"
                              : "Klik untuk ubah status"
                          }
                          className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full transition-all border
                            ${
                              user.status === "Active"
                                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:border-green-300"
                                : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300"
                            } ${isSelf ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95 shadow-sm"}`}>
                          {user.status === "Active" ? (
                            <ShieldCheck className="w-3.5 h-3.5" />
                          ) : (
                            <ShieldAlert className="w-3.5 h-3.5" />
                          )}
                          {user.status}
                        </button>
                      </td>

                      {/* KOLOM 4:LAST LOGIN */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span
                            className={`text-sm font-medium ${user.lastLogin ? "text-slate-600" : "text-slate-400 italic"}`}>
                            {timeAgo(user.lastLogin)}
                          </span>
                          {user.lastLogin && (
                            <span className="text-[10px] text-slate-400">
                              {new Date(user.lastLogin).toLocaleTimeString(
                                "id-ID",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* KOLOM 5: DELETE ACTION */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() =>
                            !isSelf &&
                            !isSuperadmin &&
                            handleDeleteUser(user.id)
                          }
                          disabled={isSelf || isSuperadmin}
                          title={
                            isSelf
                              ? "Tidak bisa hapus diri sendiri"
                              : isSuperadmin
                                ? "superadmin dilindungi"
                                : "Hapus Akun"
                          }
                          className={`p-2 rounded-lg transition-all border shadow-sm flex items-center justify-center ml-auto
                            ${
                              isSelf || isSuperadmin
                                ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                                : "bg-white text-slate-500 border-slate-200 hover:text-red-600 hover:border-red-200 hover:bg-red-50 active:scale-95"
                            }`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                /* --- EMPTY STATE --- */
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <Search className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-600">
                        Tidak ada user ditemukan
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Coba gunakan kata kunci pencarian yang lain.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-daw-green" /> Daftarkan
                  Akses (SSO)
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Hubungkan akun ke sistem CMS.
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* INFO BOX PENTING */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800 text-sm">
                <ShieldCheck className="w-5 h-5 shrink-0 text-blue-600" />
                <p className="leading-relaxed">
                  Masukkan <strong>Username OWL</strong> yang valid.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  OWL Username (Wajib)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserPlus className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Contoh: amar.badu"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all uppercase placeholder:normal-case font-mono"
                    value={formData.owl_username}
                    onChange={(e) =>
                      setFormData({ ...formData, owl_username: e.target.value })
                    }
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  System Role (Wajib)
                </label>
                <div className="relative">
                  <select
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all appearance-none cursor-pointer font-medium text-slate-700"
                    value={formData.roleId}
                    onChange={(e) =>
                      setFormData({ ...formData, roleId: e.target.value })
                    }>
                    <option value="" disabled>
                      Pilih Tingkat Akses
                    </option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  Email Address{" "}
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded normal-case">
                    Opsional
                  </span>
                </label>
                <input
                  type="email"
                  placeholder="Hanya isi jika ingin override email dari OWL"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all text-sm"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
              <button
                onClick={handleCloseModal}
                className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors">
                Batal
              </button>
              <button
                onClick={handleAddUser}
                disabled={!formData.owl_username || !formData.roleId}
                className="px-6 py-2.5 text-sm font-bold text-white bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-2">
                <Key className="w-4 h-4" /> Daftarkan Akses
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
