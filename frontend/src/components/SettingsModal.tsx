import { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme, themes } from '../ThemeContext';
import type { ThemeName } from '../ThemeContext';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { themeName, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<ThemeName>(themeName);

  const handleSave = () => {
    setTheme(selectedTheme);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Settings</h3>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Theme</label>
            <p style={{ color: 'var(--color-textTertiary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Choose your retro arcade aesthetic
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(themes).map(([key, theme]) => (
                <label
                  key={key}
                  className="theme-option"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '1rem',
                    border: selectedTheme === key ? '2px solid var(--color-accentPrimary)' : '2px solid var(--color-borderLight)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: selectedTheme === key ? 'var(--color-bgTertiary)' : 'var(--color-bgSecondary)',
                  }}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={key}
                    checked={selectedTheme === key}
                    onChange={() => setSelectedTheme(key as ThemeName)}
                    style={{ marginRight: '1rem', width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: 'var(--color-textPrimary)', marginBottom: '0.25rem' }}>
                      {theme.displayName}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '4px',
                          background: theme.colors.sidebarGradient,
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                        }}
                      />
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '4px',
                          background: theme.colors.accentGradient,
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                        }}
                      />
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '4px',
                          background: theme.colors.bgPrimary,
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                        }}
                      />
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
