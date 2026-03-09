import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import {
  Clock, Plus, Trash2, Calendar, Play, GripVertical, Settings,
  ChevronDown, RefreshCw,
} from 'lucide-react';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

interface TimeSlot {
  id: string;
  day_of_week: number;
  time_slot: string;
  platform: string | null;
  timezone: string;
  is_active: boolean;
}

interface QueueItem {
  id: string;
  content: string;
  media_urls: string[] | null;
  platforms: string[];
  post_type: string;
  position: number;
  scheduled_time: string | null;
  status: string;
  created_at: string;
}

export default function SmartQueuePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'queue' | 'slots'>('queue');
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newSlot, setNewSlot] = useState({ day_of_week: 0, time_slot: '09:00', timezone: 'UTC', platform: '' });
  const [newItem, setNewItem] = useState({ content: '', platforms: [] as string[] });

  // Fetch time slots
  const { data: slotsData, isLoading: loadingSlots } = useQuery({
    queryKey: ['smart-queue-slots'],
    queryFn: async () => {
      const res = await api.get('/v2/smart-queue/slots');
      return res.data;
    },
  });

  // Fetch queue items
  const { data: itemsData, isLoading: loadingItems } = useQuery({
    queryKey: ['smart-queue-items'],
    queryFn: async () => {
      const res = await api.get('/v2/smart-queue/items');
      return res.data;
    },
  });

  const slots: TimeSlot[] = slotsData?.slots || [];
  const items: QueueItem[] = itemsData?.items || [];

  // Create slot mutation
  const createSlot = useMutation({
    mutationFn: async (data: typeof newSlot) => {
      const res = await api.post('/v2/smart-queue/slots', {
        ...data,
        platform: data.platform || null,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-queue-slots'] });
      setShowAddSlot(false);
      setNewSlot({ day_of_week: 0, time_slot: '09:00', timezone: 'UTC', platform: '' });
    },
  });

  // Delete slot mutation
  const deleteSlot = useMutation({
    mutationFn: async (slotId: string) => {
      await api.delete(`/v2/smart-queue/slots/${slotId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-queue-slots'] });
    },
  });

  // Add item mutation
  const addItem = useMutation({
    mutationFn: async (data: typeof newItem) => {
      const res = await api.post('/v2/smart-queue/items', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-queue-items'] });
      setShowAddItem(false);
      setNewItem({ content: '', platforms: [] });
    },
  });

  // Remove item mutation
  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/v2/smart-queue/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-queue-items'] });
    },
  });

  // Schedule queue mutation
  const scheduleQueue = useMutation({
    mutationFn: async () => {
      const res = await api.post('/v2/smart-queue/schedule');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-queue-items'] });
    },
  });

  const togglePlatform = (platform: string) => {
    setNewItem(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  const platforms = ['twitter', 'facebook', 'instagram', 'linkedin', 'threads', 'bluesky'];

  return (
    <div className="smart-queue-page">
      <div className="page-header">
        <div className="header-content">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={28} /> Smart Queue
          </h1>
          <p style={{ color: 'var(--color-textSecondary)', marginTop: '0.25rem' }}>
            Automatically schedule content to your optimal posting times
          </p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => activeTab === 'queue' ? setShowAddItem(true) : setShowAddSlot(true)}
          >
            <Plus size={16} /> Add {activeTab === 'queue' ? 'Content' : 'Time Slot'}
          </button>
          {activeTab === 'queue' && items.filter(i => i.status === 'queued').length > 0 && (
            <button
              className="btn btn-primary"
              onClick={() => scheduleQueue.mutate()}
              disabled={scheduleQueue.isPending || slots.length === 0}
            >
              <Play size={16} /> {scheduleQueue.isPending ? 'Scheduling...' : 'Auto-Schedule All'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--color-borderLight)' }}>
        <button
          className={`tab ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'none',
            border: 'none',
            color: activeTab === 'queue' ? 'var(--color-primary)' : 'var(--color-textSecondary)',
            borderBottom: activeTab === 'queue' ? '2px solid var(--color-primary)' : 'none',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Queue ({items.filter(i => i.status === 'queued').length})
        </button>
        <button
          className={`tab ${activeTab === 'slots' ? 'active' : ''}`}
          onClick={() => setActiveTab('slots')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'none',
            border: 'none',
            color: activeTab === 'slots' ? 'var(--color-primary)' : 'var(--color-textSecondary)',
            borderBottom: activeTab === 'slots' ? '2px solid var(--color-primary)' : 'none',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          <Settings size={16} style={{ marginRight: '0.25rem' }} /> Time Slots ({slots.length})
        </button>
      </div>

      {activeTab === 'queue' ? (
        /* Queue Items */
        <div className="queue-items">
          {loadingItems ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-textSecondary)' }}>
              Loading queue...
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-textSecondary)' }}>
              <Calendar size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p>Your queue is empty</p>
              <p style={{ fontSize: '0.875rem' }}>Add content to start building your posting schedule</p>
            </div>
          ) : (
            <div className="queue-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {items.map(item => (
                <div
                  key={item.id}
                  className="queue-item"
                  style={{
                    background: 'var(--color-surface)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    border: '1px solid var(--color-borderLight)',
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ cursor: 'grab', color: 'var(--color-textSecondary)' }}>
                    <GripVertical size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                      {item.platforms.map(p => (
                        <span
                          key={p}
                          style={{
                            display: 'inline-block',
                            padding: '0.125rem 0.5rem',
                            background: 'var(--color-primary)',
                            color: 'white',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            marginRight: '0.25rem',
                            textTransform: 'capitalize',
                          }}
                        >
                          {p}
                        </span>
                      ))}
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.125rem 0.5rem',
                          background: item.status === 'queued' ? '#3b82f6' : item.status === 'scheduled' ? '#10b981' : '#6b7280',
                          color: 'white',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          marginLeft: '0.5rem',
                        }}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--color-textPrimary)' }}>
                      {item.content.length > 150 ? item.content.substring(0, 150) + '...' : item.content}
                    </p>
                    {item.scheduled_time && (
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>
                        Scheduled: {new Date(item.scheduled_time).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem.mutate(item.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '0.25rem',
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Time Slots */
        <div className="time-slots">
          {loadingSlots ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-textSecondary)' }}>
              Loading time slots...
            </div>
          ) : slots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-textSecondary)' }}>
              <Clock size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p>No time slots configured</p>
              <p style={{ fontSize: '0.875rem' }}>Add posting times to enable auto-scheduling</p>
            </div>
          ) : (
            <div className="slots-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              {DAYS_OF_WEEK.map((day, dayIndex) => {
                const daySlots = slots.filter(s => s.day_of_week === dayIndex);
                return (
                  <div
                    key={day}
                    style={{
                      background: 'var(--color-surface)',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      border: '1px solid var(--color-borderLight)',
                    }}
                  >
                    <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: 'var(--color-textPrimary)' }}>
                      {day}
                    </h3>
                    {daySlots.length === 0 ? (
                      <p style={{ color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>No slots</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {daySlots.map(slot => (
                          <div
                            key={slot.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.5rem',
                              background: 'var(--color-bg)',
                              borderRadius: '0.25rem',
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{slot.time_slot}</span>
                              {slot.platform && (
                                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--color-textSecondary)' }}>
                                  ({slot.platform})
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => deleteSlot.mutate(slot.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Time Slot Modal */}
      {showAddSlot && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal" style={{
            background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '1.5rem',
            width: '100%', maxWidth: '400px',
          }}>
            <h2 style={{ margin: '0 0 1rem' }}>Add Time Slot</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)' }}>Day</label>
                <select
                  value={newSlot.day_of_week}
                  onChange={e => setNewSlot({ ...newSlot, day_of_week: parseInt(e.target.value) })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
                >
                  {DAYS_OF_WEEK.map((day, i) => (
                    <option key={day} value={i}>{day}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)' }}>Time</label>
                <input
                  type="time"
                  value={newSlot.time_slot}
                  onChange={e => setNewSlot({ ...newSlot, time_slot: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)' }}>Timezone</label>
                <select
                  value={newSlot.timezone}
                  onChange={e => setNewSlot({ ...newSlot, timezone: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)' }}>Platform (optional)</label>
                <select
                  value={newSlot.platform}
                  onChange={e => setNewSlot({ ...newSlot, platform: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
                >
                  <option value="">All Platforms</option>
                  {platforms.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddSlot(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => createSlot.mutate(newSlot)}
                disabled={createSlot.isPending}
              >
                {createSlot.isPending ? 'Adding...' : 'Add Slot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Content Modal */}
      {showAddItem && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal" style={{
            background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '1.5rem',
            width: '100%', maxWidth: '500px',
          }}>
            <h2 style={{ margin: '0 0 1rem' }}>Add to Queue</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)' }}>Content</label>
                <textarea
                  value={newItem.content}
                  onChange={e => setNewItem({ ...newItem, content: e.target.value })}
                  placeholder="What do you want to share?"
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '0.375rem',
                    border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)',
                    color: 'var(--color-textPrimary)', minHeight: '120px', resize: 'vertical',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-textSecondary)' }}>Platforms</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {platforms.map(p => (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      style={{
                        padding: '0.375rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid',
                        borderColor: newItem.platforms.includes(p) ? 'var(--color-primary)' : 'var(--color-borderLight)',
                        background: newItem.platforms.includes(p) ? 'var(--color-primary)' : 'transparent',
                        color: newItem.platforms.includes(p) ? 'white' : 'var(--color-textSecondary)',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddItem(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => addItem.mutate(newItem)}
                disabled={addItem.isPending || !newItem.content || newItem.platforms.length === 0}
              >
                {addItem.isPending ? 'Adding...' : 'Add to Queue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
