import React from 'react';
import { Heart, MessageCircle, Repeat2, Share2, Send, Bookmark, ThumbsUp } from 'lucide-react';

interface PreviewProps {
  content: string;
  accountName: string;
  platform: string;
}

const PLATFORM_LIMITS = {
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
};

const getCharCount = (content: string): number => {
  return content.length;
};

const getWarningLevel = (count: number, limit: number): 'normal' | 'warning' | 'error' => {
  const percentage = (count / limit) * 100;
  if (percentage >= 100) return 'error';
  if (percentage >= 90) return 'warning';
  return 'normal';
};

const highlightContent = (content: string) => {
  // Highlight hashtags and mentions
  const parts = content.split(/(\#\w+|\@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      return <span key={i} style={{ color: '#1d9bf0' }}>{part}</span>;
    } else if (part.startsWith('@')) {
      return <span key={i} style={{ color: '#1d9bf0' }}>{part}</span>;
    }
    return part;
  });
};

export const TwitterPreview: React.FC<PreviewProps> = ({ content, accountName }) => {
  const charCount = getCharCount(content);
  const limit = PLATFORM_LIMITS.twitter;
  const warningLevel = getWarningLevel(charCount, limit);
  const displayContent = content.slice(0, limit);
  const isTruncated = content.length > limit;

  return (
    <div style={{
      border: '1px solid var(--border-color, #333)',
      borderRadius: '12px',
      padding: '16px',
      backgroundColor: 'var(--card-bg, #1a1a2e)',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          marginRight: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          fontWeight: 'bold',
          color: 'white',
        }}>
          {accountName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 'bold', color: 'var(--text-primary, #fff)' }}>
            {accountName}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary, #888)' }}>
            @{accountName.toLowerCase().replace(/\s/g, '')} · Just now
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '20px' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#1d9bf0">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </div>
      </div>
      
      <div style={{
        fontSize: '15px',
        lineHeight: '1.5',
        color: 'var(--text-primary, #fff)',
        marginBottom: '12px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {highlightContent(displayContent)}
        {isTruncated && <span style={{ color: '#ff4444' }}>...</span>}
      </div>

      <div style={{ display: 'flex', gap: '60px', color: 'var(--text-secondary, #888)', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <MessageCircle size={16} />
          <span>0</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Repeat2 size={16} />
          <span>0</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Heart size={16} />
          <span>0</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Share2 size={16} />
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color, #333)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', color: 'var(--text-secondary, #888)' }}>
          Twitter Preview
        </span>
        <span style={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: warningLevel === 'error' ? '#ff4444' : warningLevel === 'warning' ? '#ffaa00' : '#00aa00',
        }}>
          {charCount} / {limit}
        </span>
      </div>
    </div>
  );
};

export const FacebookPreview: React.FC<PreviewProps> = ({ content, accountName }) => {
  const charCount = getCharCount(content);
  const limit = PLATFORM_LIMITS.facebook;
  const warningLevel = getWarningLevel(charCount, limit);
  const isLong = content.length > 200;

  return (
    <div style={{
      border: '1px solid var(--border-color, #333)',
      borderRadius: '12px',
      padding: '16px',
      backgroundColor: 'var(--card-bg, #1a1a2e)',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          marginRight: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          fontWeight: 'bold',
          color: 'white',
        }}>
          {accountName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 'bold', color: 'var(--text-primary, #fff)' }}>
            {accountName}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #888)' }}>
            Just now · 🌎
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '20px', color: '#1877f2' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#1877f2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </div>
      </div>
      
      <div style={{
        fontSize: '15px',
        lineHeight: '1.4',
        color: 'var(--text-primary, #fff)',
        marginBottom: '12px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {isLong ? (
          <>
            {content.slice(0, 200)}...
            <span style={{ color: '#1877f2', cursor: 'pointer', fontWeight: 'bold' }}> See More</span>
          </>
        ) : content}
      </div>

      <div style={{ borderTop: '1px solid var(--border-color, #333)', paddingTop: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', color: 'var(--text-secondary, #888)' }}>
          <span>👍 0</span>
          <span>❤️ 0</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid var(--border-color, #333)', paddingTop: '8px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text-secondary, #888)' }}>
          <ThumbsUp size={16} />
          <span>Like</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text-secondary, #888)' }}>
          <MessageCircle size={16} />
          <span>Comment</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text-secondary, #888)' }}>
          <Share2 size={16} />
          <span>Share</span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color, #333)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', color: 'var(--text-secondary, #888)' }}>
          Facebook Preview
        </span>
        <span style={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: warningLevel === 'error' ? '#ff4444' : warningLevel === 'warning' ? '#ffaa00' : '#00aa00',
        }}>
          {charCount} / {limit}
        </span>
      </div>
    </div>
  );
};

export const InstagramPreview: React.FC<PreviewProps> = ({ content, accountName }) => {
  const charCount = getCharCount(content);
  const limit = PLATFORM_LIMITS.instagram;
  const warningLevel = getWarningLevel(charCount, limit);
  const isLong = content.length > 125;

  return (
    <div style={{
      border: '1px solid var(--border-color, #333)',
      borderRadius: '12px',
      padding: '16px',
      backgroundColor: 'var(--card-bg, #1a1a2e)',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          marginRight: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: 'bold',
          color: 'white',
          border: '2px solid #e1306c',
        }}>
          {accountName.charAt(0).toUpperCase()}
        </div>
        <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary, #fff)' }}>
          {accountName.toLowerCase().replace(/\s/g, '')}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '20px' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="url(#instagram-gradient)">
            <defs>
              <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#f58529' }} />
                <stop offset="50%" style={{ stopColor: '#dd2a7b' }} />
                <stop offset="100%" style={{ stopColor: '#8134af' }} />
              </linearGradient>
            </defs>
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
            <path d="M12 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </div>
      </div>

      <div style={{
        width: '100%',
        height: '300px',
        backgroundColor: 'var(--bg-secondary, #16213e)',
        borderRadius: '8px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary, #888)',
        fontSize: '14px',
      }}>
        📷 Image Preview
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
        <Heart size={24} style={{ cursor: 'pointer' }} />
        <MessageCircle size={24} style={{ cursor: 'pointer' }} />
        <Send size={24} style={{ cursor: 'pointer' }} />
        <Bookmark size={24} style={{ cursor: 'pointer', marginLeft: 'auto' }} />
      </div>

      <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-primary, #fff)' }}>
        0 likes
      </div>

      <div style={{
        fontSize: '14px',
        lineHeight: '1.4',
        color: 'var(--text-primary, #fff)',
        marginBottom: '12px',
      }}>
        <span style={{ fontWeight: 'bold', marginRight: '8px' }}>
          {accountName.toLowerCase().replace(/\s/g, '')}
        </span>
        {isLong ? (
          <>
            {content.slice(0, 125)}...
            <span style={{ color: 'var(--text-secondary, #888)', cursor: 'pointer' }}> more</span>
          </>
        ) : content}
      </div>

      <div style={{ borderTop: '1px solid var(--border-color, #333)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', color: 'var(--text-secondary, #888)' }}>
          Instagram Preview
        </span>
        <span style={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: warningLevel === 'error' ? '#ff4444' : warningLevel === 'warning' ? '#ffaa00' : '#00aa00',
        }}>
          {charCount} / {limit}
        </span>
      </div>
    </div>
  );
};

export const LinkedInPreview: React.FC<PreviewProps> = ({ content, accountName }) => {
  const charCount = getCharCount(content);
  const limit = PLATFORM_LIMITS.linkedin;
  const warningLevel = getWarningLevel(charCount, limit);
  const isLong = content.length > 210;

  return (
    <div style={{
      border: '1px solid var(--border-color, #333)',
      borderRadius: '12px',
      padding: '16px',
      backgroundColor: 'var(--card-bg, #1a1a2e)',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          marginRight: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          fontWeight: 'bold',
          color: 'white',
        }}>
          {accountName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: '600', color: 'var(--text-primary, #fff)', fontSize: '14px' }}>
            {accountName}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #888)' }}>
            Professional Title | Company
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)' }}>
            Just now · 🌐
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '20px', color: '#0a66c2' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#0a66c2">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </div>
      </div>
      
      <div style={{
        fontSize: '14px',
        lineHeight: '1.4',
        color: 'var(--text-primary, #fff)',
        marginBottom: '16px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {isLong ? (
          <>
            {content.slice(0, 210)}...
            <span style={{ color: '#0a66c2', cursor: 'pointer', fontWeight: 'bold' }}> see more</span>
          </>
        ) : content}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color, #333)', paddingTop: '8px', marginBottom: '12px', fontSize: '12px', color: 'var(--text-secondary, #888)' }}>
        <span>0 reactions</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid var(--border-color, #333)', paddingTop: '8px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary, #888)' }}>
          <ThumbsUp size={16} />
          <span>Like</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary, #888)' }}>
          <MessageCircle size={16} />
          <span>Comment</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary, #888)' }}>
          <Repeat2 size={16} />
          <span>Repost</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary, #888)' }}>
          <Send size={16} />
          <span>Send</span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color, #333)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', color: 'var(--text-secondary, #888)' }}>
          LinkedIn Preview
        </span>
        <span style={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: warningLevel === 'error' ? '#ff4444' : warningLevel === 'warning' ? '#ffaa00' : '#00aa00',
        }}>
          {charCount} / {limit}
        </span>
      </div>
    </div>
  );
};

interface PlatformPreviewsProps {
  content: string;
  selectedAccounts: string[];
  accounts: any[];
}

export const PlatformPreviews: React.FC<PlatformPreviewsProps> = ({ content, selectedAccounts, accounts }) => {
  if (!content.trim() || selectedAccounts.length === 0) {
    return null;
  }

  const selectedAccountsData = accounts.filter(a => selectedAccounts.includes(a.id));
  const platforms = Array.from(new Set(selectedAccountsData.map(a => a.platform)));

  return (
    <div style={{ marginTop: '24px' }}>
      <h3 style={{
        fontSize: '18px',
        fontWeight: 'bold',
        marginBottom: '16px',
        color: 'var(--text-primary, #fff)',
      }}>
        Platform Previews
      </h3>
      
      {platforms.map(platform => {
        const account = selectedAccountsData.find(a => a.platform === platform);
        const accountName = account?.name || `${platform} Account`;

        switch (platform) {
          case 'twitter':
            return <TwitterPreview key={platform} content={content} accountName={accountName} platform={platform} />;
          case 'facebook':
            return <FacebookPreview key={platform} content={content} accountName={accountName} platform={platform} />;
          case 'instagram':
            return <InstagramPreview key={platform} content={content} accountName={accountName} platform={platform} />;
          case 'linkedin':
            return <LinkedInPreview key={platform} content={content} accountName={accountName} platform={platform} />;
          default:
            return null;
        }
      })}
    </div>
  );
};
