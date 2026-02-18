import React, { useState } from 'react';
import { X, Lock, AlertCircle, CheckCircle } from 'lucide-react';

interface ChangePasswordModalProps {
  onPasswordChanged: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onPasswordChanged }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const passwordRequirements = [
    { met: newPassword.length >= 8, text: 'At least 8 characters' },
    { met: /[A-Z]/.test(newPassword), text: 'One uppercase letter' },
    { met: /[a-z]/.test(newPassword), text: 'One lowercase letter' },
    { met: /[0-9]/.test(newPassword), text: 'One number' },
    { met: newPassword === confirmPassword && newPassword.length > 0, text: 'Passwords match' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordRequirements.every(req => req.met)) {
      setError('Please meet all password requirements');
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/v2/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      onPasswordChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center mb-6">
            <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full mr-4">
              <Lock className="w-6 h-6 text-yellow-600 dark:text-yellow-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Change Password Required
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                You must change your password before continuing
              </p>
            </div>
          </div>

          {/* Alert */}
          <div className="bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-300 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                For security reasons, the default password must be changed on first login.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Old Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
                autoFocus
              />
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            {/* Password Requirements */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password Requirements:
              </p>
              <ul className="space-y-1">
                {passwordRequirements.map((req, index) => (
                  <li key={index} className="flex items-center text-sm">
                    {req.met ? (
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    ) : (
                      <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 rounded-full mr-2" />
                    )}
                    <span className={req.met ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}>
                      {req.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !passwordRequirements.every(req => req.met)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Changing Password...' : 'Change Password'}
            </button>
          </form>

          {/* Footer */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
            You cannot close this dialog until you change your password
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
