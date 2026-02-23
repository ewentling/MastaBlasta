import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Save, CheckCircle, XCircle, RefreshCw, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { api } from '../../api';

interface SmtpConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  configured: boolean;
  configured_fields: Record<string, boolean>;
}

export function SmtpConfigPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    host: '',
    port: '587',
    user: '',
    password: '',
    from_email: '',
    from_name: '',
    use_tls: true,
  });
  const [formDirty, setFormDirty] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const { data: config, isLoading, isError } = useQuery<SmtpConfig>({
    queryKey: ['admin-smtp-config'],
    queryFn: async () => {
      const r = await api.get('/admin/email/smtp-config');
      return r.data;
    },
  });

  // Pre-populate non-sensitive fields once loaded
  useEffect(() => {
    if (config && !formDirty) {
      setForm((f) => ({
        ...f,
        host: config.host || '',
        port: config.port || '587',
        user: config.user || '',
        from_email: config.from_email || '',
        from_name: config.from_name || '',
        use_tls: config.use_tls ?? true,
      }));
    }
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      try {
        const r = await api.post('/admin/email/smtp-config', data);
        return r.data;
      } catch (e: any) {
        throw new Error(e?.response?.data?.error || 'Failed to save SMTP configuration');
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-smtp-config'] });
      setFormDirty(false);
      setSaveResult({ success: true, message: data.message || 'SMTP configuration saved' });
      setForm((f) => ({ ...f, password: '' }));
    },
    onError: (e: Error) => setSaveResult({ success: false, message: e.message }),
  });

  const handleFieldChange = (field: string, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFormDirty(true);
    setSaveResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post('/admin/email/smtp-test');
      setTestResult({ success: r.data.success, message: r.data.message });
    } catch (e: any) {
      setTestResult({ success: false, message: e?.response?.data?.message || e.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl p-8 text-center text-slate-400" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />Loading SMTP configuration…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl p-6 text-center text-red-400" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(239,68,68,0.3)' }}>
        <XCircle className="w-6 h-6 mx-auto mb-2" />
        <p className="text-sm">Failed to load SMTP configuration.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl shadow-lg overflow-hidden" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${config?.configured ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
            <Mail className={`w-5 h-5 ${config?.configured ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">SMTP Server Configuration</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {config?.configured ? 'Connected — emails will be delivered via SMTP' : 'Not configured — set up SMTP to enable email delivery'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {formDirty && <span className="text-xs text-amber-400 font-medium">Unsaved changes</span>}
          <button
            onClick={handleTest}
            disabled={testing || !config?.configured}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:text-white transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }}
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Status checklist */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(['host', 'port', 'user', 'password', 'from_email'] as const).map((key) => {
            const isOk = config?.configured_fields?.[key];
            const labels: Record<string, string> = { host: 'Host', port: 'Port', user: 'Username', password: 'Password', from_email: 'From Email' };
            return (
              <div key={key} className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium ${isOk ? 'border-emerald-500/40 text-emerald-400' : 'border-white/10 text-slate-500'}`} style={{ background: isOk ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)' }}>
                {isOk ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                {labels[key]}
              </div>
            );
          })}
        </div>

        {/* Test / save results */}
        {testResult && (
          <div className={`p-3 rounded-lg flex items-center gap-3 text-sm border ${testResult.success ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/40 text-red-300'}`} style={{ background: testResult.success ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)' }}>
            {testResult.success ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
            {testResult.message}
          </div>
        )}
        {saveResult && (
          <div className={`p-3 rounded-lg flex items-center gap-3 text-sm border ${saveResult.success ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/40 text-red-300'}`} style={{ background: saveResult.success ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)' }}>
            {saveResult.success ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
            {saveResult.message}
          </div>
        )}

        {/* Form */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Host */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              SMTP Host <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.host}
              onChange={(e) => handleFieldChange('host', e.target.value)}
              placeholder="smtp.gmail.com"
              className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-slate-600 font-mono"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          {/* Port */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Port <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.port}
              onChange={(e) => handleFieldChange('port', e.target.value)}
              placeholder="587"
              className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-slate-600 font-mono"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Username / Email <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.user}
              onChange={(e) => handleFieldChange('user', e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-slate-600"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Password {config?.configured_fields?.password && !form.password && <span className="ml-1 text-emerald-400 normal-case font-normal">✓ saved</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => handleFieldChange('password', e.target.value)}
                placeholder={config?.configured_fields?.password ? '(saved — enter new value to replace)' : 'App password or SMTP password'}
                className="w-full pl-3 pr-10 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-slate-600"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* From Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              From Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.from_email}
              onChange={(e) => handleFieldChange('from_email', e.target.value)}
              placeholder="noreply@yourdomain.com"
              className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-slate-600"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          {/* From Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">From Name</label>
            <input
              type="text"
              value={form.from_name}
              onChange={(e) => handleFieldChange('from_name', e.target.value)}
              placeholder="MastaBlasta"
              className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-slate-600"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>

        {/* TLS toggle */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => handleFieldChange('use_tls', !form.use_tls)}
              className={`w-10 h-6 rounded-full transition-colors relative ${form.use_tls ? 'bg-cyan-500' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${form.use_tls ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm text-slate-300">Use STARTTLS (recommended for port 587)</span>
          </label>
        </div>
        <p className="text-xs text-slate-500 -mt-2">
          Use port 587 with STARTTLS enabled (recommended). Port 465 with implicit SSL is also supported when STARTTLS is disabled.
        </p>

        {/* Save button */}
        <div className="pt-1 flex items-center gap-3">
          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending || !formDirty}
            className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ background: 'linear-gradient(120deg, #00e5ff 0%, #7c4dff 100%)' }}
          >
            {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saveMutation.isPending ? 'Saving…' : 'Save SMTP Settings'}
          </button>
          <p className="text-xs text-slate-500">Changes apply immediately — no restart needed</p>
        </div>

        {/* Env reference */}
        <div className="pt-2 rounded-lg p-4 font-mono text-xs space-y-1" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-slate-400 mb-2 font-sans font-semibold text-xs uppercase tracking-wide">Environment Variables</p>
          {[
            ['SMTP_HOST', 'SMTP server hostname'],
            ['SMTP_PORT', '587 for STARTTLS (recommended), 465 for implicit SSL'],
            ['SMTP_USER', 'Login username (usually your email)'],
            ['SMTP_PASSWORD', 'App password or account password'],
            ['SMTP_FROM_EMAIL', 'Sender address shown to recipients'],
            ['SMTP_FROM_NAME', 'Sender display name (optional)'],
            ['SMTP_USE_TLS', '"true" for STARTTLS on port 587, "false" for implicit SSL on port 465'],
          ].map(([key, desc]) => (
            <div key={key} className="flex gap-2">
              <span className="text-emerald-400">{key}</span>
              <span className="text-slate-600">=</span>
              <span className="text-slate-500"># {desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
