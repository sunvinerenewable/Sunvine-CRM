import { useApp } from '../context/AppContext';

/**
 * useAuth Hook
 * Encapsulates authentication state and authorization actions.
 */
export function useAuth() {
  const {
    currentUser,
    currentDealer,
    currentStaff,
    role,
    isAuthenticated,
    authView,
    setAuthView,
    handleLogout,
    loginAsDealer,
    loginAsAdmin,
    loginAsStaff
  } = useApp();

  return {
    currentUser,
    currentDealer,
    currentStaff,
    role,
    isAuthenticated,
    authView,
    setAuthView,
    logout: handleLogout,
    loginAsDealer,
    loginAsAdmin,
    loginAsStaff,
    isAdmin: role === 'admin',
    isDealer: role === 'dealer',
    isStaff: role === 'staff'
  };
}

export default useAuth;
