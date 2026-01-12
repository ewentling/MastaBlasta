import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command, X } from 'lucide-react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts: ShortcutConfig[] = [
    {
      key: 'p',
      ctrl: true,
      description: 'Create new post',
      action: () => navigate('/create-post')
    },
    {
      key: 's',
      ctrl: true,
      description: 'Save or schedule current post',
      action: () => {
        const form = document.querySelector('form');
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
    },
    {
      key: 'k',
      ctrl: true,
      description: 'Open quick actions',
      action: () => navigate('/')
    },
    {
      key: 'd',
      ctrl: true,
      description: 'Go to dashboard',
      action: () => navigate('/')
    },
    {
      key: 'a',
      ctrl: true,
      description: 'Go to analytics',
      action: () => navigate('/analytics')
    },
    {
      key: '/',
      ctrl: true,
      description: 'Show keyboard shortcuts',
      action: () => setShowHelp(true)
    },
    {
      key: '?',
      description: 'Show keyboard shortcuts help',
      action: () => setShowHelp(true)
    }
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const shortcut = shortcuts.find(s => {
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase();
        const ctrlMatch = s.ctrl ? (e.ctrlKey || e.metaKey) : true;
        const shiftMatch = s.shift ? e.shiftKey : true;
        const altMatch = s.alt ? e.altKey : true;
        return keyMatch && ctrlMatch && shiftMatch && altMatch;
      });

      if (shortcut) {
        e.preventDefault();
        shortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  return { showHelp, setShowHelp, shortcuts };
}

export function KeyboardShortcutsHelp({ show, onClose, shortcuts }: { 
  show: boolean; 
  onClose: () => void;
  shortcuts: ShortcutConfig[];
}) {
  if (!show) return null;

  const formatKey = (shortcut: ShortcutConfig) => {
    const keys = [];
    if (shortcut.ctrl) keys.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
    if (shortcut.shift) keys.push('Shift');
    if (shortcut.alt) keys.push('Alt');
    keys.push(shortcut.key.toUpperCase());
    return keys.join(' + ');
  };

  return (
    <>
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={onClose}
      >
        <div 
          style={{
            background: 'var(--color-bgSecondary)',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Command size={24} style={{ color: 'var(--color-accentPrimary)' }} />
              <h2 style={{ margin: 0 }}>Keyboard Shortcuts</h2>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                color: 'var(--color-textSecondary)'
              }}
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {shortcuts.map((shortcut, index) => (
              <div 
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  background: 'var(--color-bgPrimary)',
                  borderRadius: '6px'
                }}
              >
                <span style={{ fontSize: '0.875rem' }}>{shortcut.description}</span>
                <kbd style={{
                  background: 'var(--color-bgSecondary)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid var(--color-borderLight)',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap'
                }}>
                  {formatKey(shortcut)}
                </kbd>
              </div>
            ))}
          </div>

          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1rem', 
            background: 'var(--color-bgPrimary)', 
            borderRadius: '6px',
            fontSize: '0.875rem',
            color: 'var(--color-textSecondary)'
          }}>
            <strong>Tip:</strong> Press <kbd>?</kbd> or <kbd>Ctrl + /</kbd> anytime to see this help.
          </div>
        </div>
      </div>
    </>
  );
}
