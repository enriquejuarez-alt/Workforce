import { create } from 'zustand'
import type { Usuario } from '../types'

interface AuthState {
  user: Usuario | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: Usuario, token: string) => void
  clearAuth: () => void
  updateUser: (user: Usuario) => void
}

const storedToken = localStorage.getItem('token')
const storedUser = localStorage.getItem('user')

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  token: storedToken,
  isAuthenticated: !!storedToken,

  setAuth: (user, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ user, token, isAuthenticated: true })
  },

  clearAuth: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ user: null, token: null, isAuthenticated: false })
  },

  updateUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user))
    set({ user })
  },
}))
