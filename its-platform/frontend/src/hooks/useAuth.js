import useAuthStore from '../store/authStore'

export function useAuth() {
  const { user, token, login, logout } = useAuthStore()

  return {
    user,
    token,
    isAuthenticated: Boolean(token),
    role: user?.role ?? null,
    operatorId: user?.operator_id ?? null,
    operatorName: user?.operator_name ?? null,
    fullName: user?.full_name ?? null,
    login,
    logout,
  }
}

export default useAuth
