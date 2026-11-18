import React, { useState } from 'react';
import { User } from '../types';
import { Lock, User as UserIcon, LogIn, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

// Seed Users for Authentication
export const SYSTEM_USERS: (User & { passwordHash: string })[] = [
  {
    id: 'usr-emp-001',
    username: 'kamal',
    passwordHash: 'emp123',
    role: 'EMPLOYEE',
    fullName: 'Kamal Perera',
    email: 'kamal@cnwengineering.lk',
    phone: '+94771234567',
    isActive: true,
  },
  {
    id: 'usr-hr-001',
    username: 'hrmanager',
    passwordHash: 'hr123',
    role: 'HR_MANAGER',
    fullName: 'CNW HR Manager',
    email: 'cnweng.hr@gmail.com',
    phone: '+94770000003',
    isActive: true,
  },
  {
    id: 'usr-ceo-001',
    username: 'ceo',
    passwordHash: 'ceo123',
    role: 'CEO',
    fullName: 'Mr. Jayantha Weerathunga',
    email: 'ceo@cnwengineering.lk',
    phone: '+94770000002',
    isActive: true,
  },
  {
    id: 'usr-admin-001',
    username: 'admin',
    passwordHash: 'admin123',
    role: 'SYSTEM_ADMIN',
    fullName: 'System Administrator',
    email: 'admin@cnwengineering.lk',
    phone: '+94770000001',
    isActive: true,
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState<string>('kamal');
  const [password, setPassword] = useState<string>('emp123');
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const user = SYSTEM_USERS.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.passwordHash === password
    );

    if (!user) {
      setError('Invalid username or password. Please check your credentials.');
      return;
    }

    if (!user.isActive) {
      setError('This account has been deactivated. Please contact HR.');
      return;
    }

    if (rememberMe) {
      localStorage.setItem('cnw_active_session', JSON.stringify(user));
    } else {
      sessionStorage.setItem('cnw_active_session', JSON.stringify(user));
    }

    onLoginSuccess(user);
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#02353C] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Top Brand Banner with Company Logo in White Background */}
        <div className="bg-[#02353C] p-8 text-center text-white relative">
          <div className="w-24 h-24 mx-auto mb-3 bg-white rounded-2xl p-2 shadow-lg flex items-center justify-center overflow-hidden border border-white/20">
            <img src="/cnw-logo.jpg" alt="CNW Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">CNW WORKFORCE</h1>
          <p className="text-xs text-[#C1F6ED] font-semibold mt-0.5">CNW Engineering (Pvt) Ltd</p>
          <p className="sinhala-text text-[11px] text-slate-300 mt-1">සේවා නියුක්තිකයන්ගේ පැමිණීමේ පද්ධතිය</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-[#2EAF7D]" /> Username / පරිශීලක නාමය
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. kamal, hrmanager, ceo, admin"
              className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2EAF7D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#2EAF7D]" /> Password / මුරපදය
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2EAF7D]"
            />
          </div>

          {/* Remember me (automatic future login) */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600 font-medium">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-[#2EAF7D] focus:ring-[#2EAF7D]"
              />
              <span>Remember me on this phone</span>
            </label>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-4 bg-[#02353C] hover:bg-[#03444d] active:bg-[#045967] text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <LogIn className="w-5 h-5 text-[#3FD0C9]" />
            <span>Sign In / ඇතුල් වන්න</span>
          </button>

          {/* Development Quick Role Fill */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 font-semibold text-center mb-2">
              Select Demo Account to Auto-Fill:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill('kamal', 'emp123')}
                className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left font-bold text-slate-700"
              >
                👷 Employee (Kamal)
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('hrmanager', 'hr123')}
                className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left font-bold text-slate-700"
              >
                💼 HR Manager
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('ceo', 'ceo123')}
                className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left font-bold text-slate-700"
              >
                🏢 CEO (Mr. Jayantha)
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('admin', 'admin123')}
                className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left font-bold text-slate-700"
              >
                🛡️ System Admin
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
