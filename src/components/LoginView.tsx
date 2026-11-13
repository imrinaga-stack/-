import React, { useState } from 'react';
import { Lock, User, ArrowLeft } from 'lucide-react';
import type { SafeUser, StoreSettings } from '../types';
import { StoreLogo } from './BarcodeVisuals';

interface LoginViewProps {
  settings: StoreSettings;
  onLoginSuccess: (user: SafeUser) => void;
}

export function LoginView({ settings, onLoginSuccess }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'שם משתמש או סיסמה שגויים.');
        return;
      }
      onLoginSuccess(data.user as SafeUser);
    } catch {
      setError('שגיאת תקשורת מול השרת.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-2 items-stretch">
        {/* Right side in RTL: Strict Password Login Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-8">
            <StoreLogo
              logoDataUrl={settings.logoDataUrl}
              storeName={settings.storeName}
              size="lg"
            />
            <div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
                {settings.storeName}
              </h1>
              <p className="text-sm text-stone-500">חנות משפחתית חכמה בבית ובאונליין</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-stone-900 mb-1">כניסה מאובטחת לחנות</h2>
            <p className="text-sm text-stone-600">
              התחברו עם שם המשתמש והסיסמה האישיים שלכם.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                שם משתמש
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="הזינו שם משתמש"
                  required
                  className="w-full pr-10 pl-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                סיסמה
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="הזינו סיסמה"
                  required
                  className="w-full pr-10 pl-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C]"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#C2410C] hover:bg-[#9A3412] text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <span>{loading ? 'מתחבר...' : 'כניסה לחנות'}</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </form>

          <p className="mt-6 text-xs text-stone-500 leading-relaxed">
            אין לך חשבון? פנו למנהל החנות שיצור עבורכם שם משתמש וסיסמה בפאנל הניהול.
          </p>
        </div>

        {/* Left side in RTL: Hero photo */}
        <div className="relative min-h-[280px] lg:min-h-full bg-stone-100">
          <img
            src="/src/assets/images/hero_family_store_1794587711310.jpg"
            alt="מדף החנות המשפחתית קטן ושווה"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent flex flex-col justify-end p-8 text-white">
            <p className="text-xs font-medium text-stone-200 mb-1">
              אונליין · סריקה מהמדף · קבלות למייל ולצ׳אט
            </p>
            <h3 className="text-2xl font-bold leading-snug text-balance">
              החנות הביתית שלנו — בוחרים משחקים, פאזלים ופינוקים בכיף
            </h3>
          </div>
        </div>
      </div>
    </div>
  );
}
