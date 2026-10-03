import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  Wrench,
  AlertCircle,
  Bike,
  Sparkles,
  CheckCircle2,
  Eye,
  EyeOff,
  Shield,
  KeyRound,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { StakeysLogo } from './StakeysLogo';
import { ThemeToggle } from './ThemeToggle';
import { VehicleCategory } from '../types/bikeShop';
import confetti from 'canvas-confetti';

interface LoginScreenProps {
  onGoToBooking?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onGoToBooking }) => {
  const { loginWithCredentials, loginStaff, registerCustomerAccount, addCustomerBike } = useShop();

  const [mode, setMode] = useState<'signin' | 'register' | 'staff'>('signin');

  // Customer Sign In state
  const [signInIdentifier, setSignInIdentifier] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Staff Station Sign In state (Email/Password)
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  // Customer Sign Up state
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [initialBikeCategory, setInitialBikeCategory] = useState<VehicleCategory | 'none'>('cycle');
  const [initialBikeBrand, setInitialBikeBrand] = useState('Trek');
  const [initialBikeModel, setInitialBikeModel] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customer Sign In with strict password verification
  const handleCustomerSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = signInIdentifier.trim();
    const cleanPass = signInPassword.trim();

    if (!cleanId) {
      setError('Please enter your email, username, or member ID.');
      return;
    }
    if (!cleanPass) {
      setError('Password is required. Accounts cannot be logged into without the correct password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginWithCredentials(cleanId, cleanPass);
      if (!res.success) {
        setError(res.message || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Login error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dedicated Staff Station Login handler (Email/Password)
  const handleStaffSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = staffEmail.trim().toLowerCase();
    const cleanPass = staffPassword.trim();
    if (!cleanEmail || !cleanPass) {
      setError('Please enter staff email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginStaff(cleanEmail, cleanPass);
      if (!res.success) {
        setError(res.message || 'Staff login failed. Access Denied.');
      } else {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#05C147', '#10b981', '#f59e0b', '#ffffff'],
          });
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      setError(err.message || 'Staff authentication error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Registration handler with password saving
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = registerName.trim();
    const cleanEmail = registerEmail.trim();

    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!registerPassword) {
      setError('Please create a password for your account.');
      return;
    }
    if (registerPassword.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerCustomerAccount(
        cleanEmail,
        registerPassword,
        cleanName,
        registerPhone.trim() || undefined
      );

      if (!res.success) {
        setError(res.message || 'Registration failed. Please try again.');
        return;
      }

      // If customer specified an initial bike, register it to their new garage
      // NOTE: Because registration is now email-only confirmation, 
      // we cannot automatically add a bike without active session.
      // This flow needs adjustment in a future update.

      // Celebrate new account
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#05C147', '#10b981', '#38bdf8', '#ffffff'],
        });
      } catch {
        // ignore
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during account creation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c1017] text-neutral-100 flex flex-col justify-center items-center px-4 py-8 sm:py-12 relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Background Atelier Photography with Warm Workshop Lighting */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="/images/hero_workshop_craftsmanship_1790159761910.jpg"
          alt="Stakey's cycle and scooter workshop"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-35 filter saturate-100 scale-105"
        />
        {/* Ambient atmospheric gradients for contrast and depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1017] via-[#0c1017]/85 to-[#0c1017]/70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/20 via-transparent to-transparent" />
      </div>

      {/* Main Container Card */}
      <div className="w-full max-w-md z-10 relative">
        {/* Top Floating Theme Toggle */}
        <div className="flex justify-end mb-3">
          <ThemeToggle showLabel={true} />
        </div>

        <div className="bg-neutral-900/95 border border-neutral-700/80 rounded-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(5,193,71,0.12)] backdrop-blur-xl ring-1 ring-emerald-500/20">
          {/* Stakey's Brand Header */}
          <div className="flex flex-col items-center text-center mb-5">
            <div className="p-2 rounded-2xl bg-neutral-950 border border-emerald-500/50 shadow-xl shadow-emerald-500/10 text-emerald-400 mb-3">
              <StakeysLogo className="w-13 h-13" />
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
              <span>STAKEY'S</span>
              <span className="text-[#05C147] text-sm font-bold tracking-wider uppercase font-sans">
                CYCLES &amp; SCOOTER
              </span>
            </h1>

            {/* Unboxed Metadata Header */}
            <div className="text-xs text-neutral-300 mt-1.5 flex items-center justify-center gap-2 font-mono">
              <span className="text-emerald-400 font-semibold">Workshop Atelier</span>
              <span aria-hidden="true" className="text-neutral-500">·</span>
              <span>Cytech Certified</span>
              <span aria-hidden="true" className="text-neutral-500">·</span>
              <span>Digital Loyalty Pass</span>
            </div>
          </div>

          {/* Dedicated 3-Mode Switcher: Customer Sign In | Create Account | Staff Terminal */}
          <div className="grid grid-cols-3 bg-neutral-950 p-1 rounded-xl border border-neutral-800 mb-5 text-xs font-semibold gap-1">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer text-center ${
                mode === 'signin'
                  ? 'bg-neutral-800 text-white font-bold shadow-md border border-neutral-700'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                mode === 'register'
                  ? 'bg-neutral-800 text-white font-bold shadow-md border border-neutral-700'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-[#05C147]" />
              <span>Register</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('staff');
                setError(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                mode === 'staff'
                  ? 'bg-emerald-950/80 text-emerald-300 font-bold shadow-md border border-emerald-500/50'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>Staff Station</span>
            </button>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* 1. DEDICATED STAFF STATION PIN LOGIN */}
          {mode === 'staff' && (
            <form onSubmit={handleStaffSignIn} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-emerald-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Workshop Staff Station</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 text-emerald-400 border border-neutral-700">
                    Supabase Secured
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Authorized workshop staff only. Access to workshop booking scheduler, stamp terminal, prize draws, and bike specs.
                </p>
              </div>

              {/* Staff Member Email & Password */}
              <div>
                <label className="block text-xs font-semibold text-neutral-200 mb-1.5">
                  Staff Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="staff@stakeyscycles.com"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] focus:ring-1 focus:ring-[#05C147] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-200 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showStaffPassword ? 'text' : 'password'}
                    required
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] focus:ring-1 focus:ring-[#05C147] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                  >
                    {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Verifying...</span>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Unlock Staff Terminal</span>
                  </>
                )}
              </button>

              <div className="text-center pt-1 text-xs text-neutral-400">
                Are you a customer?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer underline ml-1"
                >
                  Customer Sign In
                </button>
              </div>
            </form>
          )}

          {/* 2. CUSTOMER SIGN IN (Strict Password Required) */}
          {mode === 'signin' && (
            <form onSubmit={handleCustomerSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-200 mb-1.5">
                  Email, Username, or Member ID
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={signInIdentifier}
                    onChange={(e) => setSignInIdentifier(e.target.value)}
                    placeholder="e.g. alex.henderson@example.com or STK-839201"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] focus:ring-1 focus:ring-[#05C147] transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-neutral-200">
                    Account Password <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[10px] text-neutral-400 font-normal">
                    Strictly required
                  </span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showSignInPassword ? 'text' : 'password'}
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] focus:ring-1 focus:ring-[#05C147] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignInPassword(!showSignInPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                  >
                    {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Demo Accounts Helper */}
              <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400">
                <div className="font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Customer Demo Accounts</span>
                </div>
                <div>Demo customers (Alex, Maya, Liam) require password: <code className="text-emerald-400 font-mono font-bold bg-neutral-900 px-1 py-0.5 rounded">password123</code></div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Verifying Credentials...</span>
                ) : (
                  <>
                    <span>Sign In to Stakey's</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-2 flex items-center justify-between text-xs text-neutral-400">
                <span>
                  Need an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer underline ml-1"
                  >
                    Register
                  </button>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setMode('staff');
                    setError(null);
                  }}
                  className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer flex items-center gap-1"
                >
                  <Shield className="w-3 h-3" />
                  <span>Staff Station</span>
                </button>
              </div>
            </form>
          )}

          {/* 3. CREATE ACCOUNT (SIGN UP) FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-200 mb-1">
                  Full Name <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="e.g. Alex Henderson"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] focus:ring-1 focus:ring-[#05C147] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-200 mb-1">
                  Email Address <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="e.g. customer@example.com"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] focus:ring-1 focus:ring-[#05C147] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-200 mb-1">
                  Mobile Phone <span className="text-neutral-500 font-normal">(Optional, for workshop contact)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    value={registerPhone}
                    onChange={(e) => setRegisterPhone(e.target.value)}
                    placeholder="e.g. +44 7911 882910"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] focus:ring-1 focus:ring-[#05C147] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-200 mb-1">
                    Password <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showRegisterPassword ? 'text' : 'password'}
                      required
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder="Min 4 chars"
                      className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-8 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                    >
                      {showRegisterPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-200 mb-1">
                    Confirm Password <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showRegisterPassword ? 'text' : 'password'}
                      required
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg pl-10 pr-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Optional: Primary Bike/Ride to register right away */}
              <div className="pt-2 border-t border-neutral-800">
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Your Primary Ride (Optional)</span>
                  </span>
                  <span className="text-[10px] text-neutral-500 font-normal">Can add more later</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={initialBikeCategory}
                    onChange={(e) => setInitialBikeCategory(e.target.value as any)}
                    className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="cycle">Bicycle / Road / MTB</option>
                    <option value="e_scooter">Electric Scooter</option>
                    <option value="none">I'll add this later</option>
                  </select>

                  {initialBikeCategory !== 'none' ? (
                    <input
                      type="text"
                      value={initialBikeBrand}
                      onChange={(e) => setInitialBikeBrand(e.target.value)}
                      placeholder="Brand (e.g. Trek, Xiaomi)"
                      className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                    />
                  ) : null}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
              >
                {isSubmitting ? (
                  <span>Creating Your Account...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Create Account &amp; Digital Loyalty Pass</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2 text-xs text-neutral-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer underline ml-1"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* Guest Walk-In Service Booking Option */}
          {onGoToBooking && (
            <div className="mt-5 pt-4 border-t border-neutral-800 text-center space-y-1.5">
              <button
                type="button"
                onClick={onGoToBooking}
                className="w-full py-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/60 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                <span>Book Repair as Guest (Name &amp; Phone Only · Requires Staff Approval)</span>
              </button>
              <p className="text-[11px] text-neutral-500">
                No sign-up needed. Mechanics review and dispatch email acceptance or declination.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
