import React, { useState } from 'react';
import { User, Employee } from '../types';
import { Lock, User as UserIcon, LogIn, AlertCircle, UserPlus, Phone, Briefcase } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
  onEmployeeCreated?: (employee: Employee) => void;
}

// Seed Users for Authentication (Management Accounts)
export const SYSTEM_USERS: (User & { passwordHash: string })[] = [
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

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onEmployeeCreated }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  // Login Form State (Clean empty inputs)
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  // Sign-Up Form State (for Employees only)
  const [signUpFullName, setSignUpFullName] = useState<string>('');
  const [signUpCallingName, setSignUpCallingName] = useState<string>('');
  const [signUpPhone, setSignUpPhone] = useState<string>('');
  const [signUpDesignation, setSignUpDesignation] = useState<string>('Mason');
  const [signUpUsername, setSignUpUsername] = useState<string>('');
  const [signUpPassword, setSignUpPassword] = useState<string>('');

  // Handle Login
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Check seed users, registered users, and custom updated passwords
    const customPasswords: Record<string, string> = JSON.parse(
      localStorage.getItem('cnw_custom_passwords') || '{}'
    );
    const registeredUsers: (User & { passwordHash: string })[] = JSON.parse(
      localStorage.getItem('cnw_registered_users') || '[]'
    );
    const allUsers = [...SYSTEM_USERS, ...registeredUsers].map((u) => {
      const lower = u.username.toLowerCase();
      if (customPasswords[lower]) {
        return { ...u, passwordHash: customPasswords[lower] };
      }
      return u;
    });

    const user = allUsers.find(
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

  // Handle Employee Sign-Up (Simple password allowed)
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signUpFullName.trim() || !signUpCallingName.trim()) {
      setError('Please enter your full name and calling name.');
      return;
    }

    if (!signUpUsername.trim()) {
      setError('Please choose a username.');
      return;
    }

    // Allow simple passwords as requested (minimum 3 characters, no complex symbol requirement)
    if (!signUpPassword || signUpPassword.trim().length < 3) {
      setError('Please enter a password with at least 3 characters (e.g. 1234 or simple word).');
      return;
    }

    // Check if username already exists
    const registeredUsers: (User & { passwordHash: string })[] = JSON.parse(
      localStorage.getItem('cnw_registered_users') || '[]'
    );
    const allUsers = [...SYSTEM_USERS, ...registeredUsers];

    if (allUsers.some((u) => u.username.toLowerCase() === signUpUsername.trim().toLowerCase())) {
      setError('This username is already taken. Please choose another username.');
      return;
    }

    const newUserId = `usr-emp-${Date.now()}`;
    const newEmployeeId = `emp-${Date.now()}`;
    const newEmpCode = `CNW-E0${allUsers.filter((u) => u.role === 'EMPLOYEE').length + 1}`;

    const newUser: User & { passwordHash: string } = {
      id: newUserId,
      username: signUpUsername.trim().toLowerCase(),
      passwordHash: signUpPassword,
      role: 'EMPLOYEE', // Only Employee accounts can be registered here
      fullName: signUpFullName.trim(),
      phone: signUpPhone.trim() || undefined,
      isActive: true,
    };

    const newEmployee: Employee = {
      id: newEmployeeId,
      userId: newUserId,
      employeeCode: newEmpCode,
      fullName: signUpFullName.trim(),
      callingName: signUpCallingName.trim(),
      phone: signUpPhone.trim() || undefined,
      designation: signUpDesignation.trim() || 'Site Worker',
      currentDailyRate: 2000.0,
      currentOtRate: 300.0,
      isActive: true,
    };

    // Save user locally
    registeredUsers.push(newUser);
    localStorage.setItem('cnw_registered_users', JSON.stringify(registeredUsers));

    // Save employee locally
    const existingEmployees: Employee[] = JSON.parse(localStorage.getItem('cnw_employees_list') || '[]');
    existingEmployees.push(newEmployee);
    localStorage.setItem('cnw_employees_list', JSON.stringify(existingEmployees));

    if (onEmployeeCreated) {
      onEmployeeCreated(newEmployee);
    }

    // Attempt to register in Cloudflare Worker API
    try {
      await fetch('/api/auth/register-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newUserId,
          employeeId: newEmployeeId,
          employeeCode: newEmpCode,
          username: newUser.username,
          password: newUser.passwordHash,
          fullName: newUser.fullName,
          callingName: newEmployee.callingName,
          phone: newUser.phone,
          designation: newEmployee.designation,
        }),
      });
    } catch {
      // Offline fallback: saved locally
    }

    // Auto login
    localStorage.setItem('cnw_active_session', JSON.stringify(newUser));
    onLoginSuccess(newUser);
  };

  return (
    <div className="min-h-screen bg-[#02353C] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Top Brand Banner with Company Logo in White Background */}
        <div className="bg-[#02353C] p-6 text-center text-white relative">
          <div className="w-20 h-20 mx-auto mb-2 bg-white rounded-2xl p-2 shadow-lg flex items-center justify-center overflow-hidden border border-white/20">
            <img src="/cnw-logo.jpg" alt="CNW Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">CNW WORKFORCE</h1>
          <p className="text-xs text-[#C1F6ED] font-semibold mt-0.5">CNW Engineering (Pvt) Ltd</p>
          <p className="sinhala-text text-[11px] text-slate-300 mt-0.5">සේවා නියුක්තිකයන්ගේ පැමිණීමේ පද්ධතිය</p>

          {/* Mode Switcher Tabs */}
          <div className="mt-4 grid grid-cols-2 bg-black/30 p-1 rounded-xl border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError(null);
              }}
              className={`py-2 rounded-lg font-bold transition-all ${
                activeTab === 'login' ? 'bg-[#2EAF7D] text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              Sign In / ඇතුල් වන්න
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setError(null);
              }}
              className={`py-2 rounded-lg font-bold transition-all ${
                activeTab === 'signup' ? 'bg-[#2EAF7D] text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              Employee Sign Up / ලියාපදිංචිය
            </button>
          </div>
        </div>

        {/* TAB 1: SIGN IN */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="p-6 md:p-8 space-y-4">
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
          </form>
        )}

        {/* TAB 2: EMPLOYEE SIGN-UP (Simple & Fast) */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignUpSubmit} className="p-6 md:p-8 space-y-3.5">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 font-semibold">
              👷 <strong>Employee Registration:</strong> Create your account to start logging your attendance. Simple passwords allowed!
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Full Name / නම *
                </label>
                <input
                  type="text"
                  required
                  value={signUpFullName}
                  onChange={(e) => setSignUpFullName(e.target.value)}
                  placeholder="e.g. Sunil Perera"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Calling Name *
                </label>
                <input
                  type="text"
                  required
                  value={signUpCallingName}
                  onChange={(e) => setSignUpCallingName(e.target.value)}
                  placeholder="e.g. Sunil"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#2EAF7D]" /> Phone (දුරකථනය)
                </label>
                <input
                  type="text"
                  value={signUpPhone}
                  onChange={(e) => setSignUpPhone(e.target.value)}
                  placeholder="+9477..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-[#2EAF7D]" /> Job / තනතුර
                </label>
                <select
                  value={signUpDesignation}
                  onChange={(e) => setSignUpDesignation(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="Mason">Mason (මේසන්)</option>
                  <option value="Carpenter">Carpenter (වඩු කාර්මික)</option>
                  <option value="Technician">Technician (කාර්මික ශිල්පී)</option>
                  <option value="Labourer">Labourer (සහායක)</option>
                  <option value="Painter">Painter (පේන්ට් බාස්)</option>
                  <option value="Electrician">Electrician (විදුලි කාර්මික)</option>
                  <option value="Site Worker">Site Worker (වෙනත්)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                <UserIcon className="w-3 h-3 text-[#2EAF7D]" /> Choose Username (පරිශීලක නාමය) *
              </label>
              <input
                type="text"
                required
                value={signUpUsername}
                onChange={(e) => setSignUpUsername(e.target.value)}
                placeholder="e.g. sunil, nimal"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold uppercase text-slate-600 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-[#2EAF7D]" /> Password (සරල මුරපදය) *
                </label>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Simple passwords allowed (e.g. 1234)
                </span>
              </div>
              <input
                type="text"
                required
                value={signUpPassword}
                onChange={(e) => setSignUpPassword(e.target.value)}
                placeholder="Enter any simple password (e.g. 1234)"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-[#2EAF7D] hover:bg-[#259b6c] active:bg-[#1e7c57] text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <UserPlus className="w-4 h-4 text-white" />
              <span>Create Account & Sign In / ලියාපදිංචි වන්න</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
