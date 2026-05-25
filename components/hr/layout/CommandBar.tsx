"use client"

import { useEffect, useState } from 'react'
import { Edit2 } from 'lucide-react'

interface CommandBarProps {
  servicio?: string
  estado?: string
  editable?: boolean
  periodo?: string
  lockInDays?: number
}

export default function CommandBar({
  servicio,
  estado = 'Activa',
  editable = true,
  periodo,
  lockInDays,
}: CommandBarProps) {
  const [time, setTime] = useState(() => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date()
      setTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="flex items-center justify-between px-8 shrink-0 sticky top-0 z-20"
      style={{
        height: 36,
        background: 'linear-gradient(90deg, #0B1220 0%, #111B30 100%)',
        color: 'rgba(255,255,255,0.85)',
        fontSize: 11.5,
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        {/* Nómina status chip */}
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block rounded-full"
            style={{
              width: 6,
              height: 6,
              backgroundColor: '#22C55E',
              boxShadow: '0 0 6px #22C55E',
            }}
          />
          <span style={{ color: 'rgba(255,255,255,0.60)' }}>Nómina</span>
          <b style={{ color: '#FFFFFF', marginLeft: 2 }}>{estado}</b>
        </span>

        <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.10)', display: 'inline-block' }} />

        {/* Editable chip */}
        {editable && (
          <>
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(122,176,255,0.10)',
                border: '1px solid rgba(122,176,255,0.22)',
                color: '#C9DDF8',
                fontSize: 10.5,
              }}
            >
              <Edit2 size={9} strokeWidth={2.2} />
              Editable
            </span>
            <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.10)', display: 'inline-block' }} />
          </>
        )}

        {/* Countdown */}
        {lockInDays !== undefined && (
          <span style={{ color: 'rgba(255,255,255,0.60)' }}>
            Cierra en <b style={{ color: '#FFFFFF' }}>{lockInDays} días</b> · auditoría activa
          </span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {servicio && (
          <>
            <span>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>Servicio </span>
              <b style={{ color: '#FFFFFF' }}>{servicio}</b>
            </span>
            <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.10)', display: 'inline-block' }} />
          </>
        )}
        {periodo && (
          <>
            <span>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>Período </span>
              <b style={{ color: '#FFFFFF' }}>{periodo}</b>
            </span>
            <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.10)', display: 'inline-block' }} />
          </>
        )}
        <span
          style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            color: 'rgba(255,255,255,0.70)',
            fontSize: 11,
          }}
        >
          {time} · BUE
        </span>
      </div>
    </div>
  )
}
