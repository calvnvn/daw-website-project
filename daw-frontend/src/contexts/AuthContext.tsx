import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

interface User {
  id: string | number;
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
  refreshUser: () => Promise<void>; // Kita biarkan sebagai placeholder agar komponen lain tidak error
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

  /**
   * SYNC SESSION LOGIC
   * @concept: "Local Trust"
   * Kita tidak lagi nembak API /auth/me ke backend.
   * Kita cukup sinkronkan state 'user' dengan data yang ada di LocalStorage.
   */
  const syncUserSession = useCallback(() => {
    const token = localStorage.getItem("daw_token");
    const storedUser = localStorage.getItem("daw_user");

    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch {
        logout();
      }
    }
    setIsLoading(false);
  }, [logout]);

  useEffect(() => {
    syncUserSession();
  }, [syncUserSession]);

  const can = (permission: string) => {
    if (!user) return false;
    if (user.role === "admin" || user.role === "Superadmin") return true;
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
        refreshUser: async () => {},
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
