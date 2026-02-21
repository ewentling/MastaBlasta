import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Flag, Trash2, AlertTriangle } from 'lucide-react';

export function PostModerationTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['moderation-posts', search, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: '20',
      });
      if (search) params.append('search', search);

      const response = await fetch(`/api/admin/moderation/posts?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json();
    },
  });

  const flagPostMutation = useMutation({
    mutationFn: async ({ postId, reason }: { postId: string; reason: string }) => {
      const response = await fetch(`/api/admin/moderation/posts/${postId}/flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error('Failed to flag post');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-posts'] });
      alert('Post flagged successfully');
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async ({ postId, reason }: { postId: string; reason: string }) => {
      const response = await fetch(`/api/admin/moderation/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error('Failed to delete post');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-posts'] });
      alert('Post deleted successfully');
    },
  });

  const handleFlagPost = (postId: string) => {
    const reason = prompt('Enter reason for flagging this post:');
    if (reason) {
      flagPostMutation.mutate({ postId, reason });
    }
  };

  const handleDeletePost = (postId: string) => {
    const reason = prompt('Enter reason for deleting this post:');
    if (!reason) return;
    if (window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      deletePostMutation.mutate({ postId, reason });
    }
  };

  const posts = data?.posts || [];
  const totalPages = data?.total_pages || 1;
  const cardStyle = { background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' };

  const getStatusStyle = (status: string) => {
    if (status === 'published') return { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' };
    if (status === 'scheduled') return { background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' };
    return { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8090c2' };
  };

  return (
    <div className="rounded-xl shadow-lg overflow-hidden" style={cardStyle}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-sm font-semibold text-white">Content Moderation</h3>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <AlertTriangle className="w-4 h-4" />
          Total Posts: {data?.total || 0}
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search posts by content..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-slate-600"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
        </div>
      )}

      {error && (
        <div className="m-4 rounded-lg p-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-red-300">Failed to load posts</p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {posts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No posts found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Content</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post: any) => (
                    <tr key={post.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-300 max-w-md">{post.content}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">{post.user_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" style={getStatusStyle(post.status)}>
                          {post.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        {post.created_at ? new Date(post.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleFlagPost(post.id)}
                            disabled={flagPostMutation.isPending}
                            className="text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors"
                            title="Flag post"
                          >
                            <Flag className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            disabled={deletePostMutation.isPending}
                            className="text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                            title="Delete post"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-sm text-slate-400">Page {page} of {totalPages}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm rounded text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:text-white"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm rounded text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:text-white"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
