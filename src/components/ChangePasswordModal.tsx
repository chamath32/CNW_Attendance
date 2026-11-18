import React, { useState } from 'react';
import { User } from '../types';
import { Lock, CheckCircle2, AlertCircle, X, KeyRound } from 'lucide-react';
import { SYSTEM_USERS } from './LoginPage';

interface ChangePasswordModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
  onPasswordChanged?: (newPassword: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onPasswordChanged,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // 1. Validation
    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setError('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    // 2. Verify current password
    const customPasswords: Record<string, string> = JSON.parse(
      localStorage.getItem('cnw_custom_passwords') || '{}'
    );
    const registeredUsers: (User & { passwordHash: string })[] = JSON.parse(
      localStorage.getItem('cnw_registered_users') || '[]'
    );

    const allUsers = [...SYSTEM_USERS, ...registeredUsers];
    const user = allUsers.find(
      (u) => u.username.toLowerCase() === currentUser.username.toLowerCase()
    );

    const activeStoredHash =
      customPasswords[currentUser.username.toLowerCase()] ||
      user?.passwordHash ||
      '';

    if (activeStoredHash && activeStoredHash !== currentPassword) {
      setError('Incorrect current password. Please try again.');
      return;
    }

    // 3. Save new password
    setIsSubmitting(true);
    try {
      // Save locally
      customPasswords[currentUser.username.toLowerCase()] = newPassword;
      localStorage.setItem('cnw_custom_passwords', JSON.stringify(customPasswords));

      // Attempt to save to Cloudflare Worker D1 backend
      try {
        await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: currentUser.username,
            newPassword: newPassword,
          }),
        });
      } catch {
        // Backend offline or local mode
      }

      setSuccess('Your password has been changed successfully!');
      if (onPasswordChanged) onPasswordChanged(newPassword);

      setTimeout(() => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError('Failed to update password: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#02353C] p-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#C1F6ED]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Change Password</h2>
              <p className="text-xs text-[#C1F6ED]">Account: {currentUser.fullName} ({currentUser.username})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password (e.g. hr123)"
                className="w-full px-3.5 py-2.5 pl-10 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#02353C] outline-none"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new private password"
                className="w-full px-3.5 py-2.5 pl-10 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#02353C] outline-none"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Minimum 4 characters.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                className="w-full px-3.5 py-2.5 pl-10 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#02353C] outline-none"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-[#02353C] hover:bg-[#034953] text-[#C1F6ED] font-bold text-xs rounded-xl shadow-md transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
