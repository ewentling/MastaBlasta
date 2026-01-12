import { useState, useEffect } from 'react';
import { Bell, X, Check, AlertCircle, Info, Clock } from 'lucide-react';
import { useNavigate } from 'router-dom';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  actionLink?: string;
  actionLabel?: string;
  timestamp: number;
  read: boolean;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Load notifications from localStorage
    const stored = localStorage.getItem('notifications');
    if (stored) {
      setNotifications(JSON.parse(stored));
    }

    // Check for scheduled posts ready to publish
    const checkScheduledPosts = () => {
      const scheduled = JSON.parse(localStorage.getItem('scheduled_posts') || '[]');
      const now = Date.now();
      scheduled.forEach((post: any) => {
        if (new Date(post.scheduled_time).getTime() <= now && !post.notified) {
          addNotification({
            type: 'info',
            title: 'Scheduled Post Ready',
            message: `Your scheduled post is ready to publish!`,
            actionLink: '/scheduled-posts',
            actionLabel: 'View Posts'
          });
          post.notified = true;
        }
      });
      localStorage.setItem('scheduled_posts', JSON.stringify(scheduled));
    };

    const interval = setInterval(checkScheduledPosts, 60000); // Check every minute
    checkScheduledPosts(); // Check immediately

    return () => clearInterval(interval);
  }, []);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: Date.now(),
      read: false
    };
    const updated = [newNotification, ...notifications];
    setNotifications(updated);
    localStorage.setItem('notifications', JSON.stringify(updated));
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);
    localStorage.setItem('notifications', JSON.stringify(updated));
  };

  const dismissNotification = (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    localStorage.setItem('notifications', JSON.stringify(updated));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <Check size={18} style={{ color: '#48bb78' }} />;
      case 'error': return <X size={18} style={{ color: '#f56565' }} />;
      case 'warning': return <AlertCircle size={18} style={{ color: '#ed8936' }} />;
      default: return <Info size={18} style={{ color: '#4299e1' }} />;
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary"
        onClick={() => setIsOpen(!isOpen)}
        style={{ position: 'relative', padding: '0.5rem' }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -2,
            right: -2,
            background: '#f56565',
            color: 'white',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998
            }}
            onClick={() => setIsOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.5rem',
            width: '360px',
            maxHeight: '480px',
            overflowY: 'auto',
            background: 'var(--color-bgSecondary)',
            border: '1px solid var(--color-borderLight)',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 999
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--color-borderLight)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Notifications</h3>
              {unreadCount > 0 && (
                <span style={{ fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>
                  {unreadCount} unread
                </span>
              )}
            </div>

            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-textSecondary)' }}>
                <Bell size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--color-borderLight)',
                    background: notification.read ? 'transparent' : 'var(--color-bgPrimary)',
                    cursor: 'pointer'
                  }}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                    {getIcon(notification.type)}
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: '600', 
                        marginBottom: '0.25rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        {notification.title}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(notification.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            color: 'var(--color-textSecondary)'
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <p style={{ 
                        fontSize: '0.875rem', 
                        color: 'var(--color-textSecondary)',
                        margin: '0 0 0.5rem 0'
                      }}>
                        {notification.message}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {notification.actionLink && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(notification.actionLink!);
                              setIsOpen(false);
                            }}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                          >
                            {notification.actionLabel || 'View'}
                          </button>
                        )}
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)' }}>
                          <Clock size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                          {new Date(notification.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
