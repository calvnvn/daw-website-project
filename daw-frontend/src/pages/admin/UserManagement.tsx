import { useState } from "react";
import {
  Search,
  UserPlus,
  Shield,
  MoreVertical,
  Edit,
  Key,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "Superadmin" | "Editor" | "Viewer";
  status: "Active" | "Suspended";
  lastLogin: string;
}

const initialUsers: AdminUser[] = [
  {
    id: "usr1",
    name: "Jap Calvin",
    email: "calvin@daw.co.id",
    role: "Superadmin",
    status: "Active",
    lastLogin: "Just now",
  },
  {
    id: "usr2",
    name: "Corporate Comms",
    email: "corcom@daw.co.id",
    role: "Editor",
    status: "Active",
    lastLogin: "2 hours ago",
  },
  {
    id: "usr3",
    name: "HR Department",
    email: "hrd@daw.co.id",
    role: "Viewer",
    status: "Active",
    lastLogin: "Yesterday",
  },
  {
    id: "usr4",
    name: "Former Vendor IT",
    email: "vendor.it@daw.co.id",
    role: "Editor",
    status: "Suspended",
    lastLogin: "Oct 12, 2025",
  },
];

export default function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State untuk form tambah user baru
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "Editor" as "Superadmin" | "Editor" | "Viewer",
  });

  // Filter pencarian
  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Fungsi Tambah User
  const handleAddUser = () => {
    if (!formData.name || !formData.email) {
      alert("Please fill in all required fields.");
      return;
    }

    const newUser: AdminUser = {
      id: `usr-${Date.now()}`,
      name: formData.name,
      email: formData.email,
      role: formData.role,
      status: "Active",
      lastLogin: "Never",
    };

    setUsers([newUser, ...users]);
    setFormData({ name: "", email: "", role: "Editor" });
    setIsModalOpen(false);

    // Simulasi pengiriman email
    alert(
      `An invitation email with a temporary password has been sent to ${formData.email}`,
    );
  };

  // Fungsi Toggle Status (Active/Suspended)
  const toggleUserStatus = (id: string) => {
    setUsers(
      users.map((user) => {
        if (user.id === id) {
          // Cegah Superadmin mensuspend dirinya sendiri
          if (user.role === "Superadmin" && user.name === "Jap Calvin") {
            alert(
              "Action denied: You cannot suspend the primary Superadmin account.",
            );
            return user;
          }
          return {
            ...user,
            status: user.status === "Active" ? "Suspended" : "Active",
          };
        }
        return user;
      }),
    );
  };

  // Helper untuk warna Badge Role
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
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            User Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage admin accounts, roles, and system access permissions.
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

      {/* --- TOOLBAR (Search) --- */}
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

      {/* --- DATA TABLE SECTION --- */}
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
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
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
                            {user.name}
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
                        {user.role === "Superadmin" && (
                          <Shield className="w-3.5 h-3.5" />
                        )}
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
                      <p className="text-sm text-slate-600">{user.lastLogin}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => toggleUserStatus(user.id)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title={
                            user.status === "Active"
                              ? "Suspend User"
                              : "Reactivate User"
                          }
                        >
                          <ShieldAlert className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Reset Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-slate-400 hover:text-daw-green hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                      <button className="p-2 text-slate-400 md:hidden">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
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

      {/* --- ADD USER MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-daw-green" /> Invite User
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
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
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all cursor-pointer"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as
                        | "Superadmin"
                        | "Editor"
                        | "Viewer",
                    })
                  }
                >
                  <option value="Superadmin">Superadmin (Full Access)</option>
                  <option value="Editor">
                    Editor (Manage Content & Projects)
                  </option>
                  <option value="Viewer">Viewer (Read Only & Inbox)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> A secure temporary password
                  will be emailed to this user.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                className="px-5 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
              >
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
