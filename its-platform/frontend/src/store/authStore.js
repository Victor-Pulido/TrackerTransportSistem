import { create } from 'zustand'

const LOCAL_KEY_TOKEN = 'its_token'
const LOCAL_KEY_USER  = 'its_user'

const useAuthStore = create((set) => ({
  token: localStorage.getItem(LOCAL_KEY_TOKEN) || null,
  user: (() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY_USER)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })(),

  login: (token, user) => {
    localStorage.setItem(LOCAL_KEY_TOKEN, token)
    localStorage.setItem(LOCAL_KEY_USER, JSON.stringify(user))
    set({ token, user })
  },

  logout: () => {
    localStorage.removeItem(LOCAL_KEY_TOKEN)
    localStorage.removeItem(LOCAL_KEY_USER)
    set({ token: null, user: null })
  },
}))

export default useAuthStore
