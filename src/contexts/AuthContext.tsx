import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  // Updated admin credentials with valid UUID
  const ADMIN_EMAIL = 'rishabh.biry@gmail.com';
  const ADMIN_PASSWORD = 'bIRYSMRS1210';
  const ADMIN_ID = 'a1b2c3d4-e5f6-4789-1234-567890abcdef'; // Valid UUID format

  useEffect(() => {
    // Check for stored user session
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      // Ensure the stored user has an ID
      if (!parsedUser.id) {
        parsedUser.id = parsedUser.email === ADMIN_EMAIL ? ADMIN_ID : crypto.randomUUID();
        localStorage.setItem('user', JSON.stringify(parsedUser));
      }
      setUser(parsedUser);
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Check admin credentials
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const adminUser = { id: ADMIN_ID, email, isAdmin: true };
      setUser(adminUser);
      localStorage.setItem('user', JSON.stringify(adminUser));
      return true;
    }

    // Check regular users
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const foundUser = users.find((u: any) => u.email === email && u.password === password);
    
    if (foundUser) {
      // Ensure user has an ID
      if (!foundUser.id) {
        foundUser.id = crypto.randomUUID();
        // Update the stored users array with the new ID
        const updatedUsers = users.map((u: any) => 
          u.email === email ? foundUser : u
        );
        localStorage.setItem('users', JSON.stringify(updatedUsers));
      }
      
      const userData = { id: foundUser.id, email, isAdmin: false };
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      return true;
    }

    return false;
  };

  const register = async (email: string, password: string): Promise<boolean> => {
    // Prevent duplicate admin registration
    if (email === ADMIN_EMAIL) {
      return false;
    }

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // Check if user already exists
    if (users.find((u: any) => u.email === email)) {
      return false;
    }

    // Generate a unique ID for the new user
    const userId = crypto.randomUUID();

    // Add new user with ID
    users.push({ id: userId, email, password });
    localStorage.setItem('users', JSON.stringify(users));

    const userData = { id: userId, email, isAdmin: false };
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      isAuthenticated: !!user,
      isAdmin: user?.isAdmin || false
    }}>
      {children}
    </AuthContext.Provider>
  );
};