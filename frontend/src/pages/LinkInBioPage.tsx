import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import {
  Link2, Plus, Trash2, Edit2, ExternalLink, Eye, Copy, Check,
  GripVertical, Settings, BarChart2,
} from 'lucide-react';

interface BioLink {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  thumbnail_url: string | null;
  position: number;
  click_count: number;
  is_active: boolean;
}

interface BioPage {
  id: string;
  slug: string;
  title: string;
  bio: string | null;
  avatar_url: string | null;
  theme: string;
  background_color: string;
  button_style: string;
  social_links: Record<string, string> | null;
  total_views: number;
  total_clicks: number;
  is_active: boolean;
  links: BioLink[];
}

const THEMES = [
  { id: 'default', name: 'Default', bg: '#1a1a2e', text: '#fff' },
  { id: 'dark', name: 'Dark', bg: '#0d0d0d', text: '#fff' },
  { id: 'gradient', name: 'Gradient', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', text: '#fff' },
  { id: 'minimal', name: 'Minimal', bg: '#ffffff', text: '#000' },
];

const BUTTON_STYLES = ['rounded', 'pill', 'square'];

export default function LinkInBioPage() {
  const queryClient = useQueryClient();
  const [selectedPage, setSelectedPage] = useState<BioPage | null>(null);
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [editingLink, setEditingLink] = useState<BioLink | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [newPage, setNewPage] = useState({ title: '', bio: '', slug: '' });
  const [newLink, setNewLink] = useState({ title: '', url: '', icon: '' });

  // Fetch pages
  const { data: pagesData, isLoading } = useQuery({
    queryKey: ['bio-pages'],
    queryFn: async () => {
      const res = await api.get('/v2/link-in-bio/pages');
      return res.data;
    },
  });

  const pages: BioPage[] = pagesData?.pages || [];

  // Create page mutation
  const createPage = useMutation({
    mutationFn: async (data: typeof newPage) => {
      const res = await api.post('/v2/link-in-bio/pages', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bio-pages'] });
      setShowCreatePage(false);
      setNewPage({ title: '', bio: '', slug: '' });
    },
  });

  // Update page mutation
  const updatePage = useMutation({
    mutationFn: async ({ pageId, data }: { pageId: string; data: Partial<BioPage> }) => {
      const res = await api.put(`/v2/link-in-bio/pages/${pageId}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bio-pages'] });
    },
  });

  // Delete page mutation
  const deletePage = useMutation({
    mutationFn: async (pageId: string) => {
      await api.delete(`/v2/link-in-bio/pages/${pageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bio-pages'] });
      setSelectedPage(null);
    },
  });

  // Add link mutation
  const addLink = useMutation({
    mutationFn: async ({ pageId, data }: { pageId: string; data: typeof newLink }) => {
      const res = await api.post(`/v2/link-in-bio/pages/${pageId}/links`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bio-pages'] });
      setShowAddLink(false);
      setNewLink({ title: '', url: '', icon: '' });
    },
  });

  // Update link mutation
  const updateLink = useMutation({
    mutationFn: async ({ linkId, data }: { linkId: string; data: Partial<BioLink> }) => {
      const res = await api.put(`/v2/link-in-bio/links/${linkId}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bio-pages'] });
      setEditingLink(null);
    },
  });

  // Delete link mutation
  const deleteLink = useMutation({
    mutationFn: async (linkId: string) => {
      await api.delete(`/v2/link-in-bio/links/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bio-pages'] });
    },
  });

  const copyUrl = (slug: string) => {
    const url = `${window.location.origin}/api/v2/bio/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Update selected page when data changes
  const currentPage = selectedPage ? pages.find(p => p.id === selectedPage.id) : null;

  return (
    <div className="link-in-bio-page">
      <div className="page-header">
        <div className="header-content">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link2 size={28} /> Link-in-Bio
          </h1>
          <p style={{ color: 'var(--color-textSecondary)', marginTop: '0.25rem' }}>
            Create custom landing pages for your social media profiles
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreatePage(true)}>
          <Plus size={16} /> Create Page
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        {/* Pages List */}
        <div className="pages-list" style={{ background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '1rem', border: '1px solid var(--color-borderLight)' }}>
          <h3 style={{ margin: '0 0 1rem', color: 'var(--color-textPrimary)' }}>Your Pages</h3>
          {isLoading ? (
            <p style={{ color: 'var(--color-textSecondary)' }}>Loading...</p>
          ) : pages.length === 0 ? (
            <p style={{ color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>
              No pages yet. Create your first page!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pages.map(page => (
                <div
                  key={page.id}
                  onClick={() => setSelectedPage(page)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    background: currentPage?.id === page.id ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: currentPage?.id === page.id ? 'white' : 'var(--color-textPrimary)',
                    border: '1px solid',
                    borderColor: currentPage?.id === page.id ? 'var(--color-primary)' : 'var(--color-borderLight)',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{page.title}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>
                    /{page.slug} • {page.links.length} links
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Page Editor */}
        {currentPage ? (
          <div className="page-editor">
            {/* Stats Bar */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'var(--color-surface)', borderRadius: '0.5rem', padding: '1rem', flex: 1, border: '1px solid var(--color-borderLight)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)', marginBottom: '0.25rem' }}>Views</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{currentPage.total_views}</div>
              </div>
              <div style={{ background: 'var(--color-surface)', borderRadius: '0.5rem', padding: '1rem', flex: 1, border: '1px solid var(--color-borderLight)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)', marginBottom: '0.25rem' }}>Total Clicks</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{currentPage.total_clicks}</div>
              </div>
              <div style={{ background: 'var(--color-surface)', borderRadius: '0.5rem', padding: '1rem', flex: 1, border: '1px solid var(--color-borderLight)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)', marginBottom: '0.25rem' }}>CTR</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {currentPage.total_views > 0 ? ((currentPage.total_clicks / currentPage.total_views) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            {/* Page URL */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'center' }}>
              <div style={{
                flex: 1, padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '0.5rem',
                border: '1px solid var(--color-borderLight)', fontSize: '0.875rem', color: 'var(--color-textSecondary)',
              }}>
                {window.location.origin}/api/v2/bio/{currentPage.slug}
              </div>
              <button className="btn btn-secondary" onClick={() => copyUrl(currentPage.slug)}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <a
                href={`/api/v2/bio/${currentPage.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                <ExternalLink size={16} />
              </a>
            </div>

            {/* Page Settings */}
            <div style={{ background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--color-borderLight)' }}>
              <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={18} /> Page Settings
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>Title</label>
                  <input
                    type="text"
                    value={currentPage.title}
                    onChange={e => updatePage.mutate({ pageId: currentPage.id, data: { title: e.target.value } })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>Theme</label>
                  <select
                    value={currentPage.theme}
                    onChange={e => updatePage.mutate({ pageId: currentPage.id, data: { theme: e.target.value } })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
                  >
                    {THEMES.map(theme => (
                      <option key={theme.id} value={theme.id}>{theme.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>Bio</label>
                  <textarea
                    value={currentPage.bio || ''}
                    onChange={e => updatePage.mutate({ pageId: currentPage.id, data: { bio: e.target.value } })}
                    placeholder="A short description about yourself or your brand"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)', minHeight: '80px', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            {/* Links */}
            <div style={{ background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid var(--color-borderLight)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Links</h3>
                <button className="btn btn-primary" style={{ padding: '0.375rem 0.75rem' }} onClick={() => setShowAddLink(true)}>
                  <Plus size={14} /> Add Link
                </button>
              </div>
              
              {currentPage.links.length === 0 ? (
                <p style={{ color: 'var(--color-textSecondary)', textAlign: 'center', padding: '2rem' }}>
                  No links yet. Add your first link!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {currentPage.links.map(link => (
                    <div
                      key={link.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem',
                        background: 'var(--color-bg)', borderRadius: '0.5rem', border: '1px solid var(--color-borderLight)',
                      }}
                    >
                      <GripVertical size={18} style={{ color: 'var(--color-textSecondary)', cursor: 'grab' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-textPrimary)' }}>{link.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)' }}>{link.url}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-textSecondary)', fontSize: '0.875rem' }}>
                        <BarChart2 size={14} />
                        {link.click_count} clicks
                      </div>
                      <button
                        onClick={() => setEditingLink(link)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => deleteLink.mutate(link.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delete Page */}
            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this page?')) {
                    deletePage.mutate(currentPage.id);
                  }
                }}
                style={{ color: '#ef4444', borderColor: '#ef4444' }}
              >
                <Trash2 size={16} /> Delete Page
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '3rem',
            border: '1px solid var(--color-borderLight)', color: 'var(--color-textSecondary)',
          }}>
            <Link2 size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>Select a page to edit or create a new one</p>
          </div>
        )}
      </div>

      {/* Create Page Modal */}
      {showCreatePage && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal" style={{
            background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '1.5rem',
            width: '100%', maxWidth: '400px',
          }}>
            <h2 style={{ margin: '0 0 1rem' }}>Create New Page</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)' }}>Title</label>
                <input
                  type="text"
                  value={newPage.title}
                  onChange={e => setNewPage({ ...newPage, title: e.target.value })}
                  placeholder="My Links"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)' }}>Slug (URL)</label>
                <input
                  type="text"
                  value={newPage.slug}
                  onChange={e => setNewPage({ ...newPage, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  placeholder="my-links"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)' }}>Bio (optional)</label>
                <textarea
                  value={newPage.bio}
                  onChange={e => setNewPage({ ...newPage, bio: e.target.value })}
                  placeholder="A short description"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)', minHeight: '80px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreatePage(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => createPage.mutate(newPage)}
                disabled={createPage.isPending || !newPage.title}
              >
                {createPage.isPending ? 'Creating...' : 'Create Page'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Link Modal */}
      {showAddLink && currentPage && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal" style={{
            background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '1.5rem',
            width: '100%', maxWidth: '400px',
          }}>
            <h2 style={{ margin: '0 0 1rem' }}>Add Link</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)' }}>Title</label>
                <input
                  type="text"
                  value={newLink.title}
                  onChange={e => setNewLink({ ...newLink, title: e.target.value })}
                  placeholder="My Website"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)' }}>URL</label>
                <input
                  type="url"
                  value={newLink.url}
                  onChange={e => setNewLink({ ...newLink, url: e.target.value })}
                  placeholder="https://example.com"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)' }}>Icon (emoji, optional)</label>
                <input
                  type="text"
                  value={newLink.icon}
                  onChange={e => setNewLink({ ...newLink, icon: e.target.value })}
                  placeholder="🔗"
                  maxLength={2}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddLink(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => addLink.mutate({ pageId: currentPage.id, data: newLink })}
                disabled={addLink.isPending || !newLink.title || !newLink.url}
              >
                {addLink.isPending ? 'Adding...' : 'Add Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Link Modal */}
      {editingLink && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal" style={{
            background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '1.5rem',
            width: '100%', maxWidth: '400px',
          }}>
            <h2 style={{ margin: '0 0 1rem' }}>Edit Link</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)' }}>Title</label>
                <input
                  type="text"
                  value={editingLink.title}
                  onChange={e => setEditingLink({ ...editingLink, title: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-textSecondary)' }}>URL</label>
                <input
                  type="url"
                  value={editingLink.url}
                  onChange={e => setEditingLink({ ...editingLink, url: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)', background: 'var(--color-bg)', color: 'var(--color-textPrimary)' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEditingLink(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => updateLink.mutate({ linkId: editingLink.id, data: { title: editingLink.title, url: editingLink.url } })}
                disabled={updateLink.isPending}
              >
                {updateLink.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
