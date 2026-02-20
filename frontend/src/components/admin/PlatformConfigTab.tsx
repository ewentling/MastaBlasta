import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle, XCircle, RefreshCw, Save, Eye, EyeOff, Copy, ExternalLink,
  AlertTriangle,
} from 'lucide-react';

// ─── API helpers ─────────────────────────────────────────────────────────────

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchPlatformConfig() {
  const r = await fetch('/api/admin/platform-config', { headers: authHeader() });
  if (!r.ok) throw new Error('Failed to load platform configuration');
  return r.json();
}

async function savePlatformConfig(payload: { platform: string; fields: Record<string, string> }) {
  const r = await fetch('/api/admin/platform-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.error || 'Failed to save configuration');
  }
  return r.json();
}

// ─── Platform definitions ─────────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  sensitive?: boolean;
  placeholder: string;
  hint?: string;
}

interface PlatformDef {
  id: string;
  name: string;
  emoji: string;
  color: string;          // Tailwind bg class for the icon pill
  requiredKeys: string[]; // Keys that must be set for "configured" status
  fields: FieldDef[];
  steps: { title: string; desc: string; link?: string; linkLabel?: string }[];
  devConsoleUrl: string;
  devConsoleLabel: string;
}

/**
 * Returns a short sidebar label for a platform name.
 * e.g. "Meta (Facebook & Instagram)" → "Meta / Facebook"
 *      "Twitter / X" → "Twitter / X"
 *      "OpenAI" → "OpenAI"
 */
function formatPlatformSidebarLabel(name: string): string {
  // Strip parenthetical suffixes: "Meta (Facebook & Instagram)" → "Meta"
  const withoutParens = name.replace(/\s*\(.*?\)/, '').trim();
  // If the name contains " / " already, keep the first two segments
  if (withoutParens.includes(' / ')) {
    const parts = withoutParens.split(' / ');
    return `${parts[0]} / ${parts[1]}`;
  }
  return withoutParens;
}

const PLATFORMS: PlatformDef[] = [
  {
    id: 'meta',
    name: 'Meta (Facebook & Instagram)',
    emoji: '📘',
    color: 'bg-blue-50',
    requiredKeys: ['META_APP_ID', 'META_APP_SECRET'],
    fields: [
      { key: 'META_APP_ID', label: 'App ID', placeholder: '123456789012345', hint: 'Your Meta App ID from the developer dashboard' },
      { key: 'META_APP_SECRET', label: 'App Secret', sensitive: true, placeholder: 'abcdef1234567890abcdef1234567890', hint: 'Keep this secret — never expose it publicly' },
      { key: 'META_REDIRECT_URI', label: 'Redirect URI', placeholder: 'https://yourdomain.com/api/oauth/meta/callback', hint: 'Must exactly match the URI registered in your Meta App' },
    ],
    steps: [
      { title: 'Create a Meta App', desc: 'Go to Meta for Developers, click "Create App", choose "Business" type, and give it a name.', link: 'https://developers.facebook.com/apps', linkLabel: 'Open Meta for Developers →' },
      { title: 'Add Facebook Login & Instagram products', desc: 'In your app dashboard, click "Add Product" and add both "Facebook Login" and "Instagram Basic Display".', link: 'https://developers.facebook.com/apps', linkLabel: 'App Dashboard →' },
      { title: 'Copy App ID & Secret', desc: 'Go to Settings → Basic. Copy your App ID and App Secret.', link: 'https://developers.facebook.com/apps', linkLabel: 'App Settings →' },
      { title: 'Set Redirect URI', desc: 'Under Facebook Login → Settings, add your callback URL to "Valid OAuth Redirect URIs".', link: 'https://developers.facebook.com/apps', linkLabel: 'Facebook Login Settings →' },
      { title: 'Request permissions', desc: 'Add required permissions: pages_manage_posts, instagram_basic, instagram_content_publish. Submit for App Review to use in production.', link: 'https://developers.facebook.com/apps', linkLabel: 'App Review →' },
      { title: 'Save & test', desc: 'Fill in the form, click Save, then try connecting a Facebook or Instagram account from the Accounts page.', link: null, linkLabel: null },
    ],
    devConsoleUrl: 'https://developers.facebook.com/apps',
    devConsoleLabel: 'Meta for Developers',
  },
  {
    id: 'twitter',
    name: 'Twitter / X',
    emoji: '🐦',
    color: 'bg-sky-50',
    requiredKeys: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'],
    fields: [
      { key: 'TWITTER_CLIENT_ID', label: 'OAuth 2.0 Client ID', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Found in your app\'s "Keys and tokens" tab' },
      { key: 'TWITTER_CLIENT_SECRET', label: 'OAuth 2.0 Client Secret', sensitive: true, placeholder: 'yyyyyyyy…', hint: 'OAuth 2.0 secret — not the same as API key/secret' },
      { key: 'TWITTER_REDIRECT_URI', label: 'Redirect URI', placeholder: 'https://yourdomain.com/api/oauth/twitter/callback', hint: 'Must match a URI registered in the Twitter developer portal' },
      { key: 'TWITTER_BEARER_TOKEN', label: 'Bearer Token (API v2)', sensitive: true, placeholder: 'AAAAAAAAAA…', hint: 'Used for social listening / search. Found in "Keys and tokens".' },
    ],
    steps: [
      { title: 'Apply for developer access', desc: 'Sign in to the Twitter Developer Portal and apply for a developer account if you haven\'t already.', link: 'https://developer.twitter.com/en/portal', linkLabel: 'Twitter Developer Portal →' },
      { title: 'Create a Project & App', desc: 'Create a new Project, then a new App inside it. Choose "OAuth 2.0" authentication.', link: 'https://developer.twitter.com/en/portal/projects-and-apps', linkLabel: 'Projects & Apps →' },
      { title: 'Set App permissions', desc: 'Under App Settings → User authentication settings, enable OAuth 2.0, set type to "Web App", and add your Redirect URI.', link: 'https://developer.twitter.com/en/portal', linkLabel: 'App Settings →' },
      { title: 'Copy credentials', desc: 'Go to "Keys and tokens" and copy your OAuth 2.0 Client ID, Client Secret, and Bearer Token.', link: 'https://developer.twitter.com/en/portal', linkLabel: 'Keys & Tokens →' },
      { title: 'Save & test', desc: 'Fill in the form, click Save, then connect a Twitter account from the Accounts page.', link: null, linkLabel: null },
    ],
    devConsoleUrl: 'https://developer.twitter.com/en/portal',
    devConsoleLabel: 'Twitter Developer Portal',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    emoji: '💼',
    color: 'bg-blue-50',
    requiredKeys: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
    fields: [
      { key: 'LINKEDIN_CLIENT_ID', label: 'Client ID', placeholder: '86abcdef12345678', hint: 'Found on your LinkedIn app\'s Auth page' },
      { key: 'LINKEDIN_CLIENT_SECRET', label: 'Client Secret', sensitive: true, placeholder: 'xxxxxxxxxxxxxxxx', hint: 'Keep this secret' },
      { key: 'LINKEDIN_REDIRECT_URI', label: 'Redirect URI', placeholder: 'https://yourdomain.com/api/oauth/linkedin/callback', hint: 'Must be added under "Authorized redirect URLs" in your LinkedIn app' },
    ],
    steps: [
      { title: 'Create a LinkedIn App', desc: 'Go to LinkedIn Developers and create a new app, associating it with your LinkedIn Company Page.', link: 'https://www.linkedin.com/developers/apps', linkLabel: 'LinkedIn Developers →' },
      { title: 'Request required products', desc: 'Under the "Products" tab, request "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect".', link: 'https://www.linkedin.com/developers/apps', linkLabel: 'Your Apps →' },
      { title: 'Configure OAuth', desc: 'Under the "Auth" tab, add your Redirect URI to "Authorized redirect URLs for your app".', link: 'https://www.linkedin.com/developers/apps', linkLabel: 'Auth Settings →' },
      { title: 'Copy credentials', desc: 'On the Auth tab, copy your Client ID and Client Secret.', link: 'https://www.linkedin.com/developers/apps', linkLabel: 'Auth Tab →' },
      { title: 'Save & test', desc: 'Fill in the form, click Save, then connect a LinkedIn account from the Accounts page.', link: null, linkLabel: null },
    ],
    devConsoleUrl: 'https://www.linkedin.com/developers/apps',
    devConsoleLabel: 'LinkedIn Developers',
  },
  {
    id: 'google',
    name: 'Google / YouTube',
    emoji: '🎥',
    color: 'bg-red-50',
    requiredKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    fields: [
      { key: 'GOOGLE_CLIENT_ID', label: 'OAuth 2.0 Client ID', placeholder: '123456789-abc.apps.googleusercontent.com', hint: 'Web application client ID from Google Cloud Console' },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'OAuth 2.0 Client Secret', sensitive: true, placeholder: 'GOCSPX-…', hint: 'Keep this secret' },
      { key: 'GOOGLE_REDIRECT_URI', label: 'Redirect URI', placeholder: 'https://yourdomain.com/api/oauth/google/callback', hint: 'Add this URI in Google Cloud Console → Credentials → Authorized redirect URIs' },
      { key: 'GOOGLE_API_KEY', label: 'Google / Gemini AI API Key', sensitive: true, placeholder: 'AIzaSy…', hint: 'Used for YouTube Data API and Gemini AI. Create a separate API key restricted to these APIs.' },
    ],
    steps: [
      { title: 'Create a Google Cloud Project', desc: 'Open Google Cloud Console, create a new project (or select an existing one).', link: 'https://console.cloud.google.com/projectcreate', linkLabel: 'Create Project →' },
      { title: 'Enable APIs', desc: 'Enable the YouTube Data API v3 and (optionally) the Generative Language API (Gemini).', link: 'https://console.cloud.google.com/apis/library', linkLabel: 'API Library →' },
      { title: 'Create OAuth credentials', desc: 'Go to APIs & Services → Credentials → Create Credentials → OAuth client ID. Choose "Web application" and add your Redirect URI.', link: 'https://console.cloud.google.com/apis/credentials', linkLabel: 'Credentials →' },
      { title: 'Create an API key', desc: 'Create a second credential of type "API Key". Restrict it to the YouTube Data API v3 and Gemini APIs for security.', link: 'https://console.cloud.google.com/apis/credentials', linkLabel: 'API Keys →' },
      { title: 'Configure OAuth consent screen', desc: 'Under OAuth Consent Screen, add scopes: youtube.upload, youtube.readonly, and any Google Calendar / Drive scopes you need.', link: 'https://console.cloud.google.com/apis/credentials/consent', linkLabel: 'Consent Screen →' },
      { title: 'Save & test', desc: 'Fill in the form, click Save, then connect a YouTube account from the Accounts page.', link: null, linkLabel: null },
    ],
    devConsoleUrl: 'https://console.cloud.google.com/apis/credentials',
    devConsoleLabel: 'Google Cloud Console',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    emoji: '🤖',
    color: 'bg-orange-50',
    requiredKeys: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'],
    fields: [
      { key: 'REDDIT_CLIENT_ID', label: 'App Client ID', placeholder: 'xxxxxxxxxxxxxx', hint: 'Shown under your app name in Reddit\'s app preferences' },
      { key: 'REDDIT_CLIENT_SECRET', label: 'App Secret', sensitive: true, placeholder: 'yyyyyyyyyyyyyyyyyyyyyyyyyyyy', hint: 'The "secret" field for your Reddit app' },
    ],
    steps: [
      { title: 'Create a Reddit App', desc: 'Go to Reddit\'s app preferences and click "Create another app…" at the bottom.', link: 'https://www.reddit.com/prefs/apps', linkLabel: 'Reddit App Preferences →' },
      { title: 'Choose "web app" type', desc: 'Select "web app", fill in the name, and set the Redirect URI to your callback URL.', link: 'https://www.reddit.com/prefs/apps', linkLabel: 'App Preferences →' },
      { title: 'Copy credentials', desc: 'After creating, your Client ID appears under the app name. Click "edit" to reveal the Secret.', link: 'https://www.reddit.com/prefs/apps', linkLabel: 'App Preferences →' },
      { title: 'Save & test', desc: 'Fill in the form, click Save, then test the Reddit social listening feature.', link: null, linkLabel: null },
    ],
    devConsoleUrl: 'https://www.reddit.com/prefs/apps',
    devConsoleLabel: 'Reddit App Preferences',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    emoji: '🤖',
    color: 'bg-emerald-50',
    requiredKeys: ['OPENAI_API_KEY'],
    fields: [
      { key: 'OPENAI_API_KEY', label: 'API Key', sensitive: true, placeholder: 'sk-proj-…', hint: 'Required for AI-powered content suggestions and auto-captions' },
    ],
    steps: [
      { title: 'Create an OpenAI account', desc: 'Sign up or log in at platform.openai.com.', link: 'https://platform.openai.com', linkLabel: 'platform.openai.com →' },
      { title: 'Generate an API Key', desc: 'Go to API Keys and click "Create new secret key". Copy it immediately — it won\'t be shown again.', link: 'https://platform.openai.com/api-keys', linkLabel: 'API Keys →' },
      { title: 'Set usage limits (recommended)', desc: 'Under Billing → Usage limits, set a monthly spending cap to avoid unexpected charges.', link: 'https://platform.openai.com/account/limits', linkLabel: 'Usage Limits →' },
      { title: 'Save & test', desc: 'Paste the key, click Save, then try the AI content suggestions feature.', link: null, linkLabel: null },
    ],
    devConsoleUrl: 'https://platform.openai.com/api-keys',
    devConsoleLabel: 'OpenAI Platform',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PlatformConfigTab() {
  const queryClient = useQueryClient();
  const [selectedPlatform, setSelectedPlatform] = useState<string>(PLATFORMS[0].id);
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saveResults, setSaveResults] = useState<Record<string, { success: boolean; message: string } | null>>({});
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: configs, isLoading } = useQuery({
    queryKey: ['admin-platform-config'],
    queryFn: fetchPlatformConfig,
  });

  const saveMutation = useMutation({
    mutationFn: savePlatformConfig,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-platform-config'] });
      setSaveResults((r) => ({ ...r, [variables.platform]: { success: true, message: data.message } }));
      setDirty((d) => ({ ...d, [variables.platform]: false }));
      // Clear sensitive fields from form so they show placeholder again on next load
      const platformDef = PLATFORMS.find((p) => p.id === variables.platform);
      if (platformDef) {
        setForms((f) => {
          const updated = { ...f[variables.platform] };
          platformDef.fields.filter((fd) => fd.sensitive).forEach((fd) => {
            updated[fd.key] = '';
          });
          return { ...f, [variables.platform]: updated };
        });
      }
    },
    onError: (err: Error, variables) => {
      setSaveResults((r) => ({ ...r, [variables.platform]: { success: false, message: err.message } }));
    },
  });

  const handleFieldChange = (platform: string, key: string, value: string) => {
    setForms((f) => ({ ...f, [platform]: { ...f[platform], [key]: value } }));
    setDirty((d) => ({ ...d, [platform]: true }));
    setSaveResults((r) => ({ ...r, [platform]: null }));
  };

  const getFieldValue = (platform: string, key: string) => {
    return forms[platform]?.[key] ?? '';
  };

  const handleSave = (platformId: string) => {
    const platformDef = PLATFORMS.find((p) => p.id === platformId)!;
    const formValues = forms[platformId] ?? {};
    // Include non-sensitive pre-populated values
    const fields: Record<string, string> = {};
    platformDef.fields.forEach((fd) => {
      const val = formValues[fd.key];
      if (val !== undefined && val !== '') {
        fields[fd.key] = val;
      } else if (!fd.sensitive && configs?.[platformId]?.fields?.[fd.key]) {
        // Re-submit the current non-sensitive value if user didn't touch it
        fields[fd.key] = configs[platformId].fields[fd.key];
      }
    });
    saveMutation.mutate({ platform: platformId, fields });
  };

  const toggleVisible = (key: string) => {
    setVisibleFields((v) => ({ ...v, [key]: !v[key] }));
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const platformDef = PLATFORMS.find((p) => p.id === selectedPlatform)!;
  const configData = configs?.[selectedPlatform];

  return (
    <div className="flex gap-6">
      {/* ── Sidebar: platform list ──────────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Platforms</p>
          </div>
          <nav className="p-2">
            {PLATFORMS.map((p) => {
              const cfg = configs?.[p.id];
              const isConfigured = cfg?.configured ?? false;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 ${
                    selectedPlatform === p.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-base">{p.emoji}</span>
                  <span className="flex-1 text-left truncate">{formatPlatformSidebarLabel(p.name)}</span>
                  {isLoading ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
                  ) : isConfigured ? (
                    <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 ${selectedPlatform === p.id ? 'text-emerald-400' : 'text-emerald-500'}`} />
                  ) : (
                    <XCircle className={`w-3.5 h-3.5 flex-shrink-0 ${selectedPlatform === p.id ? 'text-slate-400' : 'text-slate-300'}`} />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Main content area ───────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${platformDef.color}`}>
                {platformDef.emoji}
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">{platformDef.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isLoading ? 'Loading…' : configData?.configured
                    ? '✅ Configured'
                    : '⚠️ Not configured — fill in the fields below'}
                </p>
              </div>
            </div>
            <a
              href={platformDef.devConsoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {platformDef.devConsoleLabel}
            </a>
          </div>

          {/* Per-field status pills */}
          {configData && (
            <div className="mt-4 flex flex-wrap gap-2">
              {platformDef.fields.map((fd) => {
                const ok = configData.configured_fields?.[fd.key];
                return (
                  <span
                    key={fd.key}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {fd.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Save result banner */}
        {saveResults[selectedPlatform] && (
          <div className={`p-4 rounded-lg flex items-center gap-3 text-sm ${saveResults[selectedPlatform]!.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {saveResults[selectedPlatform]!.success
              ? <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />}
            {saveResults[selectedPlatform]!.message}
          </div>
        )}

        {/* Two-column: setup guide + form */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Setup Guide */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Setup Guide</p>
            <ol className="space-y-4">
              {platformDef.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{step.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.desc}</p>
                    {step.link && (
                      <a href={step.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1">
                        {step.linkLabel}<ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Credentials Form */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Credentials</p>
              {dirty[selectedPlatform] && (
                <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
              )}
            </div>
            <div className="p-5 space-y-5">
              {isLoading ? (
                <div className="py-8 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />Loading…
                </div>
              ) : (
                <>
                  {platformDef.fields.map((fd) => {
                    const savedVal = configData?.fields?.[fd.key] ?? '';
                    const formVal = getFieldValue(selectedPlatform, fd.key);
                    const isSaved = configData?.configured_fields?.[fd.key] ?? false;
                    const showKey = `${selectedPlatform}_${fd.key}`;
                    const isVisible = visibleFields[showKey] ?? false;

                    return (
                      <div key={fd.key}>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                          {fd.label}
                          {isSaved && !formVal && (
                            <span className="ml-2 text-emerald-600 normal-case font-normal">✓ saved</span>
                          )}
                        </label>
                        <div className={fd.sensitive ? 'relative' : undefined}>
                          <input
                            type={fd.sensitive && !isVisible ? 'password' : 'text'}
                            value={formVal}
                            onChange={(e) => handleFieldChange(selectedPlatform, fd.key, e.target.value)}
                            placeholder={
                              fd.sensitive
                                ? isSaved ? '(saved — enter new value to replace)' : fd.placeholder
                                : savedVal || fd.placeholder
                            }
                            className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${fd.sensitive ? 'pr-10' : ''}`}
                          />
                          {fd.sensitive && (
                            <button
                              type="button"
                              onClick={() => toggleVisible(showKey)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                        {fd.hint && (
                          <p className="mt-1 text-xs text-slate-400">{fd.hint}</p>
                        )}
                      </div>
                    );
                  })}

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      onClick={() => handleSave(selectedPlatform)}
                      disabled={saveMutation.isPending || !dirty[selectedPlatform]}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {saveMutation.isPending ? 'Saving…' : 'Save Configuration'}
                    </button>
                    <p className="text-xs text-slate-400">Changes apply immediately — no restart needed</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Env-var reference */}
        <div className="bg-slate-900 rounded-xl p-5 text-slate-300">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Environment Variables</p>
            <button
              onClick={() => {
                const vars = platformDef.fields.map((fd) => `${fd.key}=`).join('\n');
                copyToClipboard(vars, 'all');
              }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded border border-slate-700 hover:border-slate-500 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedKey === 'all' ? 'Copied!' : 'Copy all'}
            </button>
          </div>
          <div className="font-mono text-xs space-y-1.5">
            {platformDef.fields.map((fd) => (
              <div key={fd.key} className="flex items-center gap-3 group">
                <code className="text-emerald-400">{fd.key}</code>
                <span className="text-slate-600">=</span>
                <span className="text-slate-500 text-xs">{`# ${fd.hint || fd.label}`}</span>
                <button
                  onClick={() => copyToClipboard(fd.key, fd.key)}
                  className="ml-auto opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-opacity"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {copiedKey === fd.key && <span className="text-xs text-emerald-400">Copied!</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
