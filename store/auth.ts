"use client";
import { create } from 'zustand'
import type { Usuario } from '@/types'

interface AuthState {
  user: Usuario | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: Usuario, token: string) => void
  clearAuth: () => void
  updateUser: (user: Usuario) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: typeof window !== 'undefined' ? (() => { const s = localStorage.getItem('user'); return s ? JSON.parse(s) : null })() : null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('token') : false,

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    }
    set({ user, token, isAuthenticated: true })
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
    set({ user: null, token: null, isAuthenticated: false })
  },

  updateUser: (user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user))
    }
    set({ user })
  },
}))
