import { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import axios from 'axios';
import { Calendar as CalendarIcon, Plus, X, Trash2, Edit, Settings, CheckCircle } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  content: string;
  platforms: string[];
  status: 'draft' | 'scheduled' | 'published';
  account_ids?: string[];
}

interface GoogleCalendarSettings {
  enabled: boolean;
  accessToken: string;
  refreshToken: string;
  calendarId: string;
}

export default function ContentCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [showGoogleSettings, setShowGoogleSettings] = useState(false);
  const [googleSettings, setGoogleSettings] = useState<GoogleCalendarSettings>({
    enabled: false,
    accessToken: '',
    refreshToken: '',
    calendarId: 'primary',
  });
  const [newEventDate, setNewEventDate] = useState<Date | null>(null);

  // Load Google Calendar settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('googleCalendarSettings');
    if (saved) {
      setGoogleSettings(JSON.parse(saved));
    }
  }, []);

  // Load scheduled posts
  useEffect(() => {
    loadScheduledPosts();
  }, []);

  const loadScheduledPosts = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/posts/scheduled');
      const calendarEvents = response.data.map((post: any) => ({
        id: post.id,
        title: post.content.substring(0, 50) + (post.content.length > 50 ? '...' : ''),
        start: new Date(post.scheduled_time),
        end: new Date(new Date(post.scheduled_time).getTime() + 60 * 60 * 1000), // 1 hour duration
        content: post.content,
        platforms: post.platforms,
        status: post.status || 'scheduled',
        account_ids: post.account_ids,
      }));
      setEvents(calendarEvents);
    } catch (error) {
      console.error('Error loading scheduled posts:', error);
      // Fallback to empty array if API fails
      setEvents([]);
    }
  };

  const handleSelectSlot = useCallback((slotInfo: any) => {
    setNewEventDate(slotInfo.start);
    setShowNewEventModal(true);
  }, []);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  }, []);

  const handleGoogleCalendarAuth = async () => {
    try {
      // Get authorization URL from backend
      const response = await axios.get('http://localhost:33766/api/google-calendar/authorize', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      
      const { authorization_url } = response.data;
      
      // Open OAuth popup
      const popup = window.open(authorization_url, 'googleCalendarAuth', 'width=600,height=700');
      
      // Listen for auth callback
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'calendar_auth_success') {
          setGoogleSettings({
            ...googleSettings,
            enabled: true,
          });
          localStorage.setItem('googleCalendarSettings', JSON.stringify({
            ...googleSettings,
            enabled: true,
          }));
          alert('Successfully connected to Google Calendar!');
          popup?.close();
          window.removeEventListener('message', handleMessage);
        }
      };
      
      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error('Error starting Google Calendar auth:', error);
      alert('Failed to connect to Google Calendar');
    }
  };

  const syncWithGoogleCalendar = async () => {
    if (!googleSettings.enabled) {
      alert('Please connect your Google Calendar first');
      return;
    }

    try {
      // Transform events to Calendar API format
      const calendarEvents = events.map(event => ({
        title: event.title,
        description: event.description || '',
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        event_id: event.id.startsWith('gcal-') ? event.id.replace('gcal-', '') : undefined
      }));
      
      const response = await axios.post('http://localhost:33766/api/google-calendar/sync', {
        events: calendarEvents
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      
      const { synced_count, total_events, errors } = response.data;
      
      if (errors && errors.length > 0) {
        alert(`Synced ${synced_count} of ${total_events} events. Some errors occurred:\n${errors.join('\n')}`);
      } else {
        alert(`Successfully synced ${synced_count} events to Google Calendar!`);
      }
    } catch (error) {
      console.error('Error syncing with Google Calendar:', error);
      alert('Failed to sync with Google Calendar');
    }
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = '#3174ad';
    if (event.status === 'published') backgroundColor = '#4caf50';
    if (event.status === 'draft') backgroundColor = '#ff9800';
    
    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>
            <CalendarIcon size={32} />
            Content Calendar
          </h1>
          <p>Plan and schedule your social media posts</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-primary" onClick={() => setShowGoogleSettings(true)}>
            <Settings size={20} />
            Google Calendar
          </button>
          {googleSettings.enabled && (
            <button className="btn-secondary" onClick={syncWithGoogleCalendar}>
              <CheckCircle size={20} />
              Sync with Google
            </button>
          )}
        </div>
      </div>

      <div style={{ height: 'calc(100vh - 200px)', backgroundColor: 'var(--card-bg)', padding: '20px', borderRadius: '12px' }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable
          eventPropGetter={eventStyleGetter}
          views={['month', 'week', 'day', 'agenda']}
          defaultView="month"
        />
      </div>

      {/* Google Calendar Settings Modal */}
      {showGoogleSettings && (
        <div className="modal-overlay" onClick={() => setShowGoogleSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Google Calendar Integration</h2>
              <button className="close-btn" onClick={() => setShowGoogleSettings(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                  <span style={{ fontWeight: '600' }}>Status:</span>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    backgroundColor: googleSettings.enabled ? '#4caf50' : '#666',
                    color: 'white',
                    fontSize: '14px'
                  }}>
                    {googleSettings.enabled ? 'Connected' : 'Not Connected'}
                  </span>
                </label>
              </div>

              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '10px', fontSize: '16px' }}>Setup Instructions:</h3>
                <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Google Cloud Console</a></li>
                  <li>Create a new project or select existing</li>
                  <li>Enable Google Calendar API</li>
                  <li>Create OAuth 2.0 credentials</li>
                  <li>Add authorized redirect URI: <code style={{ backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px' }}>{window.location.origin}/auth/google/callback</code></li>
                  <li>Save your Client ID to localStorage</li>
                </ol>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Google Calendar ID
                </label>
                <input
                  type="text"
                  value={googleSettings.calendarId}
                  onChange={(e) => setGoogleSettings({ ...googleSettings, calendarId: e.target.value })}
                  placeholder="primary"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                />
                <small style={{ color: '#888', marginTop: '5px', display: 'block' }}>
                  Use "primary" for your main calendar or specify a calendar ID
                </small>
              </div>

              <button 
                className="btn-primary" 
                onClick={handleGoogleCalendarAuth}
                style={{ width: '100%' }}
              >
                {googleSettings.enabled ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {showEventModal && selectedEvent && (
        <div className="modal-overlay" onClick={() => setShowEventModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Post Details</h2>
              <button className="close-btn" onClick={() => setShowEventModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '15px' }}>
                <strong>Content:</strong>
                <p style={{ marginTop: '5px', padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  {selectedEvent.content}
                </p>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <strong>Scheduled Time:</strong>
                <p>{format(selectedEvent.start, 'PPpp')}</p>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <strong>Platforms:</strong>
                <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                  {selectedEvent.platforms.map(platform => (
                    <span key={platform} style={{
                      padding: '4px 12px',
                      backgroundColor: 'var(--primary)',
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '14px'
                    }}>
                      {platform}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <strong>Status:</strong>
                <span style={{
                  marginLeft: '10px',
                  padding: '4px 12px',
                  backgroundColor: selectedEvent.status === 'published' ? '#4caf50' : '#ff9800',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '14px'
                }}>
                  {selectedEvent.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
