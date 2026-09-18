import { useState, type ReactNode } from 'react'
import { Download } from '@/components/icons'
import { useToast } from '@/components/Toast'
import { readableError } from '@/lib/supabase'
import { S } from '@/lib/strings'

interface Props {
  onExport: () => Promise<void>
  children: ReactNode
  variant?: 'primary' | 'ghost'
  className?: string
  disabled?: boolean
}

/** Download button that renders the PDF in the browser and reports failures. */
export function PdfButton({
  onExport,
  children,
  variant = 'ghost',
  className = '',
  disabled = false,
}: Props) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  return (
    <button
      type="button"
      className={`${variant === 'primary' ? 'btn-primary' : 'btn-ghost'} ${className}`}
      disabled={busy || disabled}
      onClick={async () => {
        setBusy(true)
        try {
          await onExport()
        } catch (error) {
          toast(readableError(error), 'error')
        } finally {
          setBusy(false)
        }
      }}
    >
      <Download className="h-4 w-4" />
      {busy ? S.preparingPdf : children}
    </button>
  )
}
