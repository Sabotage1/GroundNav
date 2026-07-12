import { useEffect, useId, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type ModalSize = 'small' | 'medium' | 'large' | 'full'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: ModalSize
  closeLabel?: string
  closeOnEscape?: boolean
  closeOnBackdrop?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  className?: string
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true' && !element.hasAttribute('hidden')
  )
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'medium',
  closeLabel = 'Close dialog',
  closeOnEscape = true,
  closeOnBackdrop = true,
  initialFocusRef,
  className
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTarget = initialFocusRef?.current ?? dialogRef.current
    focusTarget?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      const dialog = dialogRef.current
      if (!dialog) return

      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const elements = focusableElements(dialog)
      if (elements.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      const activeElement = document.activeElement

      if (!dialog.contains(activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [closeOnEscape, initialFocusRef, isOpen])

  if (!isOpen || typeof document === 'undefined') return null

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (closeOnBackdrop && event.target === event.currentTarget) onCloseRef.current()
  }

  return createPortal(
    <div className="modal-backdrop" onClick={handleBackdropClick} role="presentation">
      <div
        ref={dialogRef}
        className={['modal-dialog', `modal-dialog--${size}`, className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="modal-dialog__header">
          <div className="modal-dialog__heading">
            <h2 className="modal-dialog__title" id={titleId}>
              {title}
            </h2>
            {description && (
              <div className="modal-dialog__description" id={descriptionId}>
                {description}
              </div>
            )}
          </div>
          <button type="button" className="modal-dialog__close" onClick={() => onCloseRef.current()} aria-label={closeLabel}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="modal-dialog__body">{children}</div>
        {footer && <footer className="modal-dialog__footer">{footer}</footer>}
      </div>
    </div>,
    document.body
  )
}
