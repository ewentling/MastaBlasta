import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, AlertCircle, Check, Hash, Sparkles } from 'lucide-react';

interface Tweet {
  id: string;
  content: string;
}

interface ThreadComposerProps {
  onThreadChange: (tweets: string[]) => void;
  initialContent?: string;
  maxTweetLength?: number;
}

export default function ThreadComposer({
  onThreadChange,
  initialContent = '',
  maxTweetLength = 280,
}: ThreadComposerProps) {
  const [tweets, setTweets] = useState<Tweet[]>([
    { id: '1', content: initialContent }
  ]);

  // Update parent when tweets change
  useEffect(() => {
    onThreadChange(tweets.map(t => t.content).filter(c => c.trim()));
  }, [tweets]);

  // Auto-split long content
  useEffect(() => {
    if (initialContent && initialContent.length > maxTweetLength) {
      const parts = splitIntoTweets(initialContent, maxTweetLength);
      setTweets(parts.map((content, i) => ({ id: String(i + 1), content })));
    }
  }, [initialContent, maxTweetLength]);

  const splitIntoTweets = (text: string, maxLen: number): string[] => {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    const tweets: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if ((current + ' ' + trimmed).trim().length <= maxLen) {
        current = (current + ' ' + trimmed).trim();
      } else {
        if (current) tweets.push(current);
        // If single sentence is too long, split by words
        if (trimmed.length > maxLen) {
          const words = trimmed.split(' ');
          current = '';
          for (const word of words) {
            if ((current + ' ' + word).trim().length <= maxLen) {
              current = (current + ' ' + word).trim();
            } else {
              if (current) tweets.push(current);
              current = word;
            }
          }
        } else {
          current = trimmed;
        }
      }
    }
    if (current) tweets.push(current);
    return tweets;
  };

  const addTweet = () => {
    const newId = String(Math.max(...tweets.map(t => parseInt(t.id))) + 1);
    setTweets([...tweets, { id: newId, content: '' }]);
  };

  const removeTweet = (id: string) => {
    if (tweets.length > 1) {
      setTweets(tweets.filter(t => t.id !== id));
    }
  };

  const updateTweet = (id: string, content: string) => {
    setTweets(tweets.map(t => t.id === id ? { ...t, content } : t));
  };

  const moveTweet = (fromIndex: number, toIndex: number) => {
    const newTweets = [...tweets];
    const [removed] = newTweets.splice(fromIndex, 1);
    newTweets.splice(toIndex, 0, removed);
    setTweets(newTweets);
  };

  const autoSplit = () => {
    const fullContent = tweets.map(t => t.content).join(' ');
    const parts = splitIntoTweets(fullContent, maxTweetLength);
    setTweets(parts.map((content, i) => ({ id: String(i + 1), content })));
  };

  const getCharacterCount = (content: string) => {
    return content.length;
  };

  const isOverLimit = (content: string) => {
    return getCharacterCount(content) > maxTweetLength;
  };

  const totalThreadLength = tweets.filter(t => t.content.trim()).length;

  return (
    <div className="thread-composer">
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1rem', paddingBottom: '0.75rem',
        borderBottom: '1px solid var(--color-borderLight)',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-textPrimary)' }}>
            Thread Composer
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>
            {totalThreadLength} tweet{totalThreadLength !== 1 ? 's' : ''} in thread
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={autoSplit}
            className="btn btn-secondary"
            style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
          >
            <Sparkles size={14} /> Auto-Split
          </button>
          <button
            onClick={addTweet}
            className="btn btn-primary"
            style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
          >
            <Plus size={14} /> Add Tweet
          </button>
        </div>
      </div>

      <div className="tweets-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {tweets.map((tweet, index) => {
          const charCount = getCharacterCount(tweet.content);
          const overLimit = isOverLimit(tweet.content);
          const remaining = maxTweetLength - charCount;

          return (
            <div
              key={tweet.id}
              style={{
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                padding: '1rem', background: 'var(--color-bg)', borderRadius: '0.5rem',
                border: '1px solid',
                borderColor: overLimit ? '#ef4444' : 'var(--color-borderLight)',
              }}
            >
              {/* Drag Handle & Number */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '0.25rem', color: 'var(--color-textSecondary)', minWidth: '24px',
              }}>
                <GripVertical size={16} style={{ cursor: 'grab' }} />
                <span style={{
                  fontSize: '0.75rem', fontWeight: 600,
                  background: 'var(--color-primary)', color: 'white',
                  width: '20px', height: '20px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {index + 1}
                </span>
              </div>

              {/* Tweet Content */}
              <div style={{ flex: 1 }}>
                <textarea
                  value={tweet.content}
                  onChange={e => updateTweet(tweet.id, e.target.value)}
                  placeholder={index === 0 ? "Start your thread..." : "Continue the thread..."}
                  style={{
                    width: '100%', minHeight: '100px', padding: '0.75rem',
                    borderRadius: '0.375rem', border: '1px solid var(--color-borderLight)',
                    background: 'var(--color-surface)', color: 'var(--color-textPrimary)',
                    resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9375rem',
                    lineHeight: 1.5,
                  }}
                />
                
                {/* Character Counter & Status */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginTop: '0.5rem',
                }}>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                    {index === 0 && (
                      <span style={{ color: 'var(--color-textSecondary)' }}>
                        First tweet hooks your readers
                      </span>
                    )}
                    {index === tweets.length - 1 && index > 0 && (
                      <span style={{ color: 'var(--color-textSecondary)' }}>
                        Last tweet — add a CTA
                      </span>
                    )}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    fontSize: '0.75rem',
                    color: overLimit ? '#ef4444' : remaining < 50 ? '#f59e0b' : 'var(--color-textSecondary)',
                  }}>
                    {overLimit && <AlertCircle size={12} />}
                    {!overLimit && charCount > 0 && remaining <= 50 && <AlertCircle size={12} />}
                    {!overLimit && charCount > 0 && remaining > 50 && <Check size={12} />}
                    <span>{remaining}</span>
                  </div>
                </div>
              </div>

              {/* Delete Button */}
              {tweets.length > 1 && (
                <button
                  onClick={() => removeTweet(tweet.id)}
                  style={{
                    background: 'none', border: 'none', padding: '0.25rem',
                    color: '#ef4444', cursor: 'pointer',
                  }}
                  title="Remove tweet"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Thread Preview */}
      {totalThreadLength > 1 && (
        <div style={{
          marginTop: '1rem', padding: '1rem', background: 'var(--color-surface)',
          borderRadius: '0.5rem', border: '1px solid var(--color-borderLight)',
        }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--color-textSecondary)' }}>
            Thread Preview
          </h4>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-textPrimary)' }}>
            {tweets.filter(t => t.content.trim()).map((tweet, index) => (
              <div key={tweet.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600, minWidth: '24px' }}>
                  {index + 1}/{totalThreadLength}
                </span>
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {tweet.content.substring(0, 60)}{tweet.content.length > 60 ? '...' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div style={{
        marginTop: '1rem', padding: '0.75rem', background: 'rgba(0, 229, 255, 0.1)',
        borderRadius: '0.5rem', fontSize: '0.75rem', color: 'var(--color-textSecondary)',
      }}>
        <strong style={{ color: 'var(--color-primary)' }}>Thread Tips:</strong>
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1rem' }}>
          <li>Start with a strong hook to grab attention</li>
          <li>Each tweet should provide value and flow naturally to the next</li>
          <li>End with a call-to-action (follow, retweet, reply)</li>
          <li>Keep important info above 250 characters for previews</li>
        </ul>
      </div>
    </div>
  );
}
