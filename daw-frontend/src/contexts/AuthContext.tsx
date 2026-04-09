import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import api from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData: any, token: string) => void;
  logout: () => void;
  can: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem("daw_token");
    localStorage.removeItem("daw_user");
    setUser(null);
    window.location.href = "/admin/login";
  }, []);

  const login = (userData: any, token: string) => {
    localStorage.setItem("daw_token", token);
    localStorage.setItem("daw_user", JSON.stringify(userData));
    setUser(userData);
  };

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get("/auth/me");
      const userData = response.data;
      setUser(userData);
      localStorage.setItem("daw_user", JSON.stringify(userData));
    } catch (error) {
      console.error("Session sync failed:", error);
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem("daw_token");
    const storedUser = localStorage.getItem("daw_user");

    if (token && storedUser) {
      // PROTEKSI: Hindari Crash jika LocalStorage Korup
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        refreshUser();
      } catch {
        console.error("Corrupted local storage data. Logging out...");
        logout();
      }
    } else {
      setIsLoading(false);
    }
  }, [refreshUser, logout]);

  // PROTEKSI: Superadmin kebal, yang lain dipastikan array-nya aman
  const can = (permission: string) => {
    if (!user) return false;

    // Superadmin bypass
    if (user.role === "Superadmin") return true;

    // Pastikan permissions adalah array sebelum memanggil .includes()
    return (
      Array.isArray(user.permissions) && user.permissions.includes(permission)
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        can,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined)
    throw new Error("useAuth must be used within AuthProvider");
  return context;
};
