"use client";
import { create } from 'zustand'
import type { Usuario } from '@/types'

interface AuthState {
  user: Usuario | null
  token: string | null
  isAuthenticated: boolean
  /** false hasta que `hydrate()` corre en el cliente (post-mount). Server y
   *  el primer render del cliente arrancan iguales (sin sesion) para que no
   *  haya mismatch de hidratacion; RouteGuard llama hydrate() en un effect. */
  hydrated: boolean
  hydrate: () => void
  setAuth: (user: Usuario, token: string) => void
  clearAuth: () => void
  updateUser: (user: Usuario) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  hydrated: false,

  hydrate: () => {
    if (typeof window === 'undefined') return
    const s = localStorage.getItem('user')
    const token = localStorage.getItem('token')
    set({
      user: s ? JSON.parse(s) : null,
      token,
      isAuthenticated: !!token,
      hydrated: true,
    })
  },

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    }
    set({ user, token, isAuthenticated: true, hydrated: true })
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
    set({ user: null, token: null, isAuthenticated: false, hydrated: true })
  },

  updateUser: (user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user))
    }
    set({ user })
  },
}))
