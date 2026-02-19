import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Send, Eye, Loader } from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  description: string;
  variables: string[];
}

export function EmailComposer() {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [recipientType, setRecipientType] = useState<'single' | 'all'>('single');
  const [userEmail, setUserEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Fetch email templates
  const { data: templatesData } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const response = await fetch('/api/admin/email/templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: any) => {
      const response = await fetch('/api/admin/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify(emailData),
      });
      if (!response.ok) throw new Error('Failed to send email');
      return response.json();
    },
    onSuccess: () => {
      alert('Email queued for delivery!');
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
      const response = await fetch('/api/admin/email/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          template_id: selectedTemplate,
          subject,
          body,
          variables: {
            user_name: 'Preview User',
          },
        }),
      });
      if (!response.ok) throw new Error('Failed to preview email');
      return response.json();
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
      alert('Please fill in subject and body');
      return;
    }

    const emailData: any = {
      recipient_type: recipientType,
      subject,
      body,
      template_id: selectedTemplate || null,
    };

    if (recipientType === 'single' && userEmail) {
      // In production, you'd fetch user IDs from email
      emailData.user_ids = []; // Would be populated from search
    }

    sendEmailMutation.mutate(emailData);
  };

  const handlePreview = () => {
    previewMutation.mutate();
    setShowPreview(true);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <Mail className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-semibold">Email Composer</h3>
      </div>

      {/* Template Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Template (Optional)
        </label>
        <select
          value={selectedTemplate}
          onChange={(e) => handleTemplateSelect(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Recipients
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="single"
              checked={recipientType === 'single'}
              onChange={(e) => setRecipientType(e.target.value as 'single')}
              className="mr-2"
            />
            Single User
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="all"
              checked={recipientType === 'all'}
              onChange={(e) => setRecipientType(e.target.value as 'all')}
              className="mr-2"
            />
            All Users
          </label>
        </div>
      </div>

      {/* User Email (if single recipient) */}
      {recipientType === 'single' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            User Email
          </label>
          <input
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Subject */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Body */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Message Body
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Email content..."
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Use variables like {'{user_name}'}, {'{upgrade_link}'} in your template
        </p>
      </div>

      {/* Preview */}
      {showPreview && previewMutation.data && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-medium mb-2">Preview:</h4>
          <div className="mb-2">
            <span className="font-medium">Subject:</span> {previewMutation.data.preview.subject}
          </div>
          <div>
            <span className="font-medium">Body:</span>
            <div className="mt-1 whitespace-pre-wrap">{previewMutation.data.preview.body}</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handlePreview}
          disabled={!subject || !body || previewMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sendEmailMutation.isPending ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Send Email
        </button>
      </div>

      {/* Note */}
      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> Email service integration required for actual delivery. 
          Currently logs email intent for testing.
        </p>
      </div>
    </div>
  );
}
