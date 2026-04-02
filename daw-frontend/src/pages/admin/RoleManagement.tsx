import { useState, useEffect } from "react";
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  X,
  CheckSquare,
  Square,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Permission {
  id: string;
  name: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: { id: string; name: string }[];
}

export default function RoleManagement() {
  const { can } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionsList, setPermissionsList] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissionIds: [] as string[],
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get("/roles"),
        api.get("/roles/permissions"),
      ]);
      setRoles(rolesRes.data);
      setPermissionsList(permsRes.data);
    } catch {
      toast.error("Failed to load roles data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        description: role.description || "",
        permissionIds: role.permissions.map((p) => p.id),
      });
    } else {
      setEditingRole(null);
      setFormData({ name: "", description: "", permissionIds: [] });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRole(null);
  };

  const togglePermission = (permId: string) => {
    setFormData((prev) => {
      const exists = prev.permissionIds.includes(permId);
      return {
        ...prev,
        permissionIds: exists
          ? prev.permissionIds.filter((id) => id !== permId)
          : [...prev.permissionIds, permId],
      };
    });
  };

  const handleSaveRole = async () => {
    if (!formData.name) return toast.error("Role name is required.");

    const loadingToast = toast.loading(
      editingRole ? "Updating role..." : "Creating role...",
    );
    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, formData);
        toast.success("Role updated successfully!", { id: loadingToast });
      } else {
        await api.post("/roles", formData);
        toast.success("Role created successfully!", { id: loadingToast });
      }
      fetchData();
      handleCloseModal();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Operation failed.", {
        id: loadingToast,
      });
    }
  };

  const handleDeleteRole = async (id: string, roleName: string) => {
    if (["Superadmin", "Editor"].includes(roleName)) {
      return toast.error("System roles cannot be deleted.");
    }

    toast("Confirm Deletion", {
      description: `Are you sure you want to delete the role '${roleName}'?`,
      action: {
        label: "Delete",
        onClick: async () => {
          const loadingToast = toast.loading("Deleting role...");
          try {
            await api.delete(`/roles/${id}`);
            toast.success("Role deleted.", { id: loadingToast });
            fetchData();
          } catch (error: any) {
            toast.error(error.response?.data?.message || "Delete failed", {
              id: loadingToast,
            });
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => toast.dismiss() },
    });
  };

  if (!can("manage_users")) {
    return (
      <div className="p-10 text-center text-red-500 font-bold">
        Access Denied
      </div>
    );
  }

  // Format permission string jadi lebih cantik (manage_projects -> Manage Projects)
  const formatPermName = (name: string) => {
    return name
      .replace("manage_", "")
      .replace("_", " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Role Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create custom roles and assign specific module permissions.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>Create New Role</span>
        </button>
      </div>

      {/* ROLES GRID */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500">Loading roles...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role) => (
            <div
              key={role.id}
              className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col h-full hover:shadow-md transition-shadow group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-daw-green/10 text-daw-green flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      {role.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {role.permissions.length} permissions granted
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <p className="text-sm text-slate-600 mb-4 h-10 line-clamp-2">
                  {role.description || "No description provided."}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {role.name === "Superadmin" ? (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-md font-medium border border-purple-200">
                      Unrestricted Access (All Modules)
                    </span>
                  ) : role.permissions.length > 0 ? (
                    role.permissions.slice(0, 3).map((p) => (
                      <span
                        key={p.id}
                        className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200 font-medium"
                      >
                        {formatPermName(p.name)}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      No access granted.
                    </span>
                  )}
                  {role.permissions.length > 3 && (
                    <span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-200 font-medium">
                      +{role.permissions.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleOpenModal(role)}
                  className="flex-1 flex justify-center items-center gap-1.5 py-2 text-sm font-medium text-slate-600 hover:text-daw-green hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <Edit className="w-4 h-4" /> Edit Role
                </button>
                {/* Disable Delete for Superadmin & Editor */}
                {!["Superadmin", "Editor"].includes(role.name) && (
                  <button
                    onClick={() => handleDeleteRole(role.id, role.name)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Role"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">
                {editingRole
                  ? `Edit Role: ${editingRole.name}`
                  : "Create New Role"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Role Name
                  </label>
                  <input
                    type="text"
                    disabled={editingRole?.name === "Superadmin"}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green disabled:bg-slate-100 disabled:text-slate-500"
                    placeholder="e.g. Human Capital"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Description
                  </label>
                  <textarea
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green min-h-[80px]"
                    placeholder="Describe the purpose of this role..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Module Permissions
                </label>
                {editingRole?.name === "Superadmin" ? (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-purple-700 text-sm font-medium flex items-start gap-3">
                    <Shield className="w-5 h-5 shrink-0 mt-0.5" />
                    Superadmin has unrestricted access to all modules.
                    Checkboxes are disabled.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {permissionsList.map((perm) => {
                      const isChecked = formData.permissionIds.includes(
                        perm.id,
                      );
                      return (
                        <div
                          key={perm.id}
                          onClick={() => togglePermission(perm.id)}
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                            isChecked
                              ? "border-daw-green bg-daw-green/5"
                              : "border-slate-100 bg-white hover:border-slate-200"
                          }`}
                        >
                          <div
                            className={`mt-0.5 ${isChecked ? "text-daw-green" : "text-slate-300"}`}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <p
                              className={`text-sm font-bold ${isChecked ? "text-slate-900" : "text-slate-600"}`}
                            >
                              {formatPermName(perm.name)}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                              {perm.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button
                onClick={handleCloseModal}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRole}
                disabled={editingRole?.name === "Superadmin"}
                className={`px-5 py-2.5 text-sm font-bold text-white bg-daw-green hover:bg-[#003b1c] rounded-lg transition-colors ${
                  editingRole?.name === "Superadmin"
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                Save Role Config
              </button>{" "}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
