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

interface AdminUser {
  id: string;
  name: string;
  email: string;
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
    name: "",
    email: "",
    roleId: "",
  });

  const [tempCredentials, setTempCredentials] = useState<{
    email: string;
    pass: string;
  } | null>(null);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTempCredentials(null);
    setFormData({ name: "", email: "", roleId: "" }); // Reset form
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleAddUser = async () => {
    if (!formData.name || !formData.email || !formData.roleId) {
      return toast.error("Please fill in all required fields, including Role.");
    }
    const loadingToast = toast.loading("Creating user account...");
    try {
      const response = await api.post("/users", formData);
      const result = response.data;

      // Tampilkan password sementara
      toast.success("User account created successfully!", {
        id: loadingToast,
      });

      fetchUsersAndRoles();

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
      fetchUsersAndRoles();
    } catch (error) {
      toast.error("Gagal mengubah status user.");
      console.error(error);
    }
  };

  const handleDeleteUser = async (id: string) => {
    // Guard 1: Suicide Prevention (Cegah hapus diri sendiri)
    if (String(id) === String(currentUserId)) {
      return toast.error("Safety Breach", {
        description:
          "You cannot delete your own account to prevent system lockout.",
      });
    }

    const targetUser = users.find((u) => String(u.id) === String(id));

    // Guard 2: Superadmin Protection
    if (targetUser?.roleData?.name === "Superadmin") {
      return toast.error("Action Denied", {
        description: "Superadmin accounts are immutable and cannot be deleted.",
      });
    }

    //  TAHAP 1: Konfirmasi menggunakan Sonner Toast Action
    toast("Confirm Deletion", {
      description: `Are you sure you want to permanently delete ${targetUser?.name}?`,
      duration: Infinity, // Agar toast tidak hilang sampai user memilih
      action: {
        label: "Delete User",
        onClick: async () => {
          //  TAHAP 2: Jalankan proses hapus setelah dikonfirmasi
          const loadingToast = toast.loading(
            `Terminating ${targetUser?.name}...`,
          );

          try {
            await api.delete(`/users/${id}`);

            toast.success("User Terminated", {
              id: loadingToast,
              description: `${targetUser?.name} has been removed from the DAW database.`,
            });

            fetchUsersAndRoles(); // Refresh data
          } catch (error: any) {
            toast.error("Operation Failed", {
              id: loadingToast,
              description:
                error.response?.data?.message || "Internal Server Error",
            });
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => toast.dismiss(),
      },
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
          "You cannot demote your own Superadmin status for safety reasons.",
      });
      return;
    }

    // 3. GUARD: Hierarchy Protection (Superadmin vs Superadmin)
    if (targetUser?.roleData?.name === "Superadmin" && !isEditingSelf) {
      toast.error("Action Denied", {
        description:
          "Hierarchy Protection: Superadmin accounts are immutable by other administrators.",
      });
      return;
    }

    // --- FUNGSI EKSEKUSI API ---
    const executeUpdate = async () => {
      const loadingToast = toast.loading(
        `Provisioning ${newRole?.name} access for ${targetUser?.name}...`,
      );

      try {
        await api.put(`/users/${userId}`, { roleId: newRoleId });

        toast.success("Access Level Updated", {
          id: loadingToast,
          description: `${targetUser?.name} is now a ${newRole?.name}.`,
        });

        await fetchUsersAndRoles();
      } catch (error: any) {
        toast.error("Update Failed", {
          id: loadingToast,
          description:
            error.response?.data?.message || "Internal server error.",
        });

        fetchUsersAndRoles(); // Kembalikan ke state database jika gagal
      }
    };

    // --- LOGIKA KONFIRMASI ---
    if (newRole?.name === "Superadmin") {
      toast("Elevate to Superadmin?", {
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

  // --- SENIOR FULLSTACK MAGIC: DETERMINISTIC COLOR ASSIGNMENT ---
  const getRoleBadgeColor = (role: string) => {
    // 1. CORE SYSTEM ROLES (Pertahankan identitas aslinya)
    switch (role) {
      case "Superadmin":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "Editor":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "Viewer":
        return "bg-slate-100 text-slate-700 border-slate-200";
    }

    // 2. CURATED PALETTE (Palet warna premium untuk role kustom)
    // Kita kurasi agar tidak ada warna jelek (seperti kuning stabilo) yang merusak mata.
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

    // 3. THE HASHING ALGORITHM
    // Mengubah string (contoh: "Marketing") menjadi angka integer unik secara konsisten
    let hash = 0;
    for (let i = 0; i < role.length; i++) {
      hash = role.charCodeAt(i) + ((hash << 5) - hash);
    }

    // 4. MAPPING TO PALETTE
    // Gunakan absolute & modulo agar angka hash selalu muat di dalam index array palet kita
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
                  // LOGIKA PROTEKSI (Dihitung per baris user)
                  const isSelf = String(user.id) === String(currentUserId);
                  const roleName = user.roleData?.name || "Unknown Role";
                  const isSuperadmin = roleName === "Superadmin";
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
                      {/* --- SYSTEM ROLE CELL --- */}
                      <td className="px-6 py-4">
                        {currentUser?.role === "Superadmin" && !isSelf ? (
                          <div className="relative inline-block group/role">
                            {/* Highlight Background saat Hover */}
                            <div className="absolute inset-0 bg-slate-100 rounded-lg opacity-0 group-hover/role:opacity-100 transition-opacity duration-200" />

                            <select
                              value={user.roleId}
                              onChange={(e) =>
                                handleUpdateRole(user.id, e.target.value)
                              }
                              className={`relative appearance-none outline-none pr-8 pl-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer w-full min-w-[130px] shadow-sm
                                ${getRoleBadgeColor(roleName)} 
                                hover:border-daw-green hover:shadow-md focus:ring-2 focus:ring-daw-green/30 active:scale-[0.98]`}
                            >
                              {roles.map((r) => (
                                <option
                                  key={r.id}
                                  value={r.id}
                                  className="text-slate-700 bg-white font-medium"
                                >
                                  {r.name}
                                </option>
                              ))}
                            </select>

                            {/* Custom Icon: Berputar saat hover */}
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover/role:text-daw-green transition-all duration-300 group-hover/role:rotate-180">
                              <ChevronDown className="w-4 h-4" />
                            </div>
                          </div>
                        ) : (
                          /* Mode Statis (Bukan Superadmin atau Akun Sendiri) */
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm ${getRoleBadgeColor(roleName)} ${isSelf ? "opacity-80 ring-1 ring-slate-200 ring-offset-1" : ""}`}
                            title={
                              isSelf ? "Your current role" : "Role is locked"
                            }
                          >
                            {isSuperadmin && <Shield className="w-3.5 h-3.5" />}
                            {roleName}
                          </span>
                        )}
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
                                  ? "opacity-20 cursor-not-allowed text-slate-300 bg-slate-100"
                                  : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            {/* Tooltip yang lebih informatif */}
                            <span className="absolute -top-8 scale-0 transition-all rounded bg-slate-800 p-2 text-[10px] text-white group-hover/tooltip:scale-100 z-10 whitespace-nowrap shadow-lg">
                              {isSelf
                                ? "You cannot delete yourself"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 animate-in fade-in duration-200">
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

                    handleCloseModal();
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
                    onClick={handleCloseModal}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>{" "}
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
                    <select
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all appearance-none cursor-pointer"
                      value={formData.roleId}
                      onChange={(e) =>
                        setFormData({ ...formData, roleId: e.target.value })
                      }
                    >
                      <option value="" disabled>
                        -- Select a Role --
                      </option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" /> A secure temporary
                      password will be generated.
                    </p>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
                  <button
                    onClick={handleCloseModal}
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
