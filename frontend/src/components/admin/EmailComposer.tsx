import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Mail, Send, Eye, Loader, CheckCircle, XCircle, AlertTriangle, Users } from 'lucide-react';
import { api } from '../../api';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  description: string;
  variables: string[];
}

export function EmailComposer() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [recipientType, setRecipientType] = useState<'single' | 'all'>('single');
  const [userEmail, setUserEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [validationError, setValidationError] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  // Check SMTP configuration status (shares cache with SmtpConfigPanel)
  const { data: smtpConfig } = useQuery({
    queryKey: ['admin-smtp-config'],
    queryFn: async () => {
      const r = await api.get('/admin/email/smtp-config');
      return r.data;
    },
  });
  const smtpConfigured = smtpConfig?.configured ?? false;

  // Fetch email templates
  const { data: templatesData } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const r = await api.get('/admin/email/templates');
      return r.data;
    },
  });

  // Fetch user count for broadcast display
  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const r = await api.get('/admin/users');
      return r.data;
    },
    staleTime: 60000,
  });
  const totalUserCount = usersData?.total ?? null;

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: any) => {
      const r = await api.post('/admin/email/send', emailData);
      return r.data;
    },
    onSuccess: () => {
      setSendSuccess(true);
      setValidationError('');
      setTimeout(() => setSendSuccess(false), 5000);
      // Reset form
      setSubject('');
      setBody('');
      setUserEmail('');
      setSelectedTemplate('');
    },
  });

  // Preview email mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      const r = await api.post('/admin/email/preview', {
        template_id: selectedTemplate,
        subject,
        body,
        variables: {
          user_name: 'Preview User',
        },
      });
      return r.data;
    },
  });

  const templates = templatesData?.templates || [];

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t: EmailTemplate) => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      // You would load a default body here
    }
  };

  const handleSendEmail = () => {
    if (!subject || !body) {
      setValidationError('Please fill in both Subject and Message Body before sending.');
      return;
    }
    setValidationError('');

    const emailData: any = {
      recipient_type: recipientType,
      subject,
      body,
      template_id: selectedTemplate || null,
    };

    if (recipientType === 'single' && userEmail) {
      emailData.to_emails = [userEmail];
    }

    sendEmailMutation.mutate(emailData);
  };

  const handlePreview = () => {
    previewMutation.mutate();
    setShowPreview(true);
    setTimeout(() => {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div className="rounded-xl shadow-lg overflow-hidden" style={{ background: 'rgba(5,7,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Mail className="w-6 h-6 text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">Email Composer</h3>
      </div>

      <div className="p-6 space-y-4">
        {/* Template Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Email Template (Optional)
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
            style={{ background: 'rgba(5,7,30,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <option value="">Custom Email</option>
            {templates.map((template: EmailTemplate) => (
              <option key={template.id} value={template.id}>
                {template.name} - {template.description}
              </option>
            ))}
          </select>
        </div>

        {/* Recipient Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Recipients
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="radio"
                value="single"
                checked={recipientType === 'single'}
                onChange={(e) => setRecipientType(e.target.value as 'single')}
                className="accent-cyan-400"
              />
              Single User
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="radio"
                value="all"
                checked={recipientType === 'all'}
                onChange={(e) => setRecipientType(e.target.value as 'all')}
                className="accent-cyan-400"
              />
              <span className="flex items-center gap-1.5">
                All Users
                {totalUserCount !== null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)', color: '#00e5ff' }}>
                    <Users className="w-3 h-3" />{totalUserCount}
                  </span>
                )}
              </span>
            </label>
          </div>
        </div>

        {/* User Email (if single recipient) */}
        {recipientType === 'single' && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              User Email
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-slate-600"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
        )}

        {/* Subject */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-slate-600"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Message Body
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Email content..."
            rows={8}
            className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-slate-600"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-slate-500">
              Use variables like {'{user_name}'}, {'{upgrade_link}'} in your template
            </p>
            <span className={`text-xs font-medium ${body.length > 5000 ? 'text-red-400' : 'text-slate-500'}`}>
              {body.length} / 5000 chars
            </span>
          </div>
        </div>

        {/* Preview */}
        {showPreview && previewMutation.data && (
          <div ref={previewRef} className="p-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 className="font-medium text-slate-200 mb-2">Preview:</h4>
            <div className="mb-2 text-sm text-slate-300">
              <span className="font-medium text-slate-400">Subject:</span> {previewMutation.data.preview.subject}
            </div>
            <div className="text-sm text-slate-300">
              <span className="font-medium text-slate-400">Body:</span>
              <div className="mt-1 whitespace-pre-wrap">{previewMutation.data.preview.body}</div>
            </div>
          </div>
        )}

        {/* Send success banner */}
        {sendSuccess && (
          <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)' }}>
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300 font-medium">Email queued for delivery!</p>
          </div>
        )}

        {/* Validation error banner */}
        {validationError && (
          <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{validationError}</p>
            <button onClick={() => setValidationError('')} className="ml-auto text-red-500 hover:text-red-300">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handlePreview}
            disabled={!subject || !body || previewMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:text-white transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }}
          >
            {previewMutation.isPending ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            Preview
          </button>
          <button
            onClick={handleSendEmail}
            disabled={!subject || !body || sendEmailMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ background: 'linear-gradient(120deg, #00e5ff 0%, #7c4dff 100%)' }}
          >
            {sendEmailMutation.isPending ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send Email
          </button>
        </div>

        {/* Status Note */}
        {smtpConfigured ? (
          <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">
              <strong>SMTP configured</strong> — emails will be delivered via your SMTP server.
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-lg" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <p className="text-sm text-amber-300">
              <strong>Note:</strong> SMTP is not configured. Use the <em>Configure SMTP</em> button at the top of this page to set up email delivery.
              Currently logs email intent for testing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}