import React, { useState } from 'react';
import { Video, Eye, ShoppingCart, Clock, Search, UserCheck, MousePointer2 } from 'lucide-react';
import type { SafeUser, UserLiveActivity } from '../types';

interface AdminCameraTabProps {
  users: SafeUser[];
  liveSessions: Record<string, UserLiveActivity>;
  onWatchUser: (username: string) => void;
}

const VIEW_LABELS: Record<string, string> = {
  store: 'גולש בקטלוג החנות',
  chat: 'צופה בצ׳אט הקבלות וההודעות',
  cart: 'בודק את סל הקניות',
  admin: 'פאנל ניהול',
};

export function AdminCameraTab({
  users,
  liveSessions,
  onWatchUser,
}: AdminCameraTabProps) {
  const familyUsers = users.filter((u) => u.role === 'family');
  const [targetInput, setTargetInput] = useState(familyUsers[0]?.username || '');
  const [watchingUsername, setWatchingUsername] = useState(familyUsers[0]?.username || '');
  const [filterMode, setFilterMode] = useState<'mirror' | 'timeline' | 'cart'>('mirror');

  const activeSession = watchingUsername
    ? liveSessions[watchingUsername.toLowerCase()]
    : undefined;

  function handleStartWatching(e: React.FormEvent) {
    e.preventDefault();
    const clean = targetInput.trim().toLowerCase();
    if (!clean) return;
    setWatchingUsername(clean);
    onWatchUser(clean);
  }

  function selectQuickUser(uname: string) {
    setTargetInput(uname);
    setWatchingUsername(uname);
    onWatchUser(uname);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
          <Video className="w-5 h-5 text-[#C2410C]" />
          <span>כפתור מצלמה — צפייה בפעילות משתמש בזמן אמת</span>
        </h2>
        <p className="text-sm text-stone-600 mt-1">
          בחרו או הקלידו שם משתמש כדי לראות בשידור חי בדיוק מה הוא עושה כרגע באתר — מיקום עכבר, גלילה, חיפוש, מוצר פתוח וסל קניות.
        </p>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
        <form onSubmit={handleStartWatching} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="הזינו שם משתמש למעקב"
              className="w-full pr-10 pl-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C]"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            <span>פתח מצלמת משתמש</span>
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-stone-500">משתמשי משפחה במערכת:</span>
          {familyUsers.length === 0 ? (
            <span className="text-xs text-stone-500">
              עדיין לא נוצרו משתמשים. צרו משתמש חדש בלשונית &ldquo;משתמשים ולוגו החנות&rdquo;.
            </span>
          ) : (
            familyUsers.map((u) => {
              const session = liveSessions[u.username];
              const isOnline = session?.online;
              const isSelected = watchingUsername === u.username;
              return (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => selectQuickUser(u.username)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isOnline ? 'bg-emerald-500' : 'bg-stone-400'
                    }`}
                  />
                  <span>{u.displayName}</span>
                  <span className="opacity-70 font-mono-tabular">({u.username})</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setFilterMode('mirror')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            filterMode === 'mirror' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600'
          }`}
        >
          תצוגת מסך חיה (עכבר, גלילה ומיקוד)
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('timeline')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            filterMode === 'timeline' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600'
          }`}
        >
          יומן פעולות בזמן אמת
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('cart')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            filterMode === 'cart' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600'
          }`}
        >
          סל קניות נוכחי
        </button>
      </div>

      {!watchingUsername ? (
        <div className="bg-white border border-stone-200 rounded-xl p-10 text-center space-y-2">
          <UserCheck className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="text-base font-bold text-stone-900">
            בחרו או הזינו שם משתמש למעקב בזמן אמת
          </h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto">
            הקלידו שם משתמש של בן משפחה או צרו חשבון חדש בלשונית &ldquo;משתמשים ולוגו החנות&rdquo;.
          </p>
        </div>
      ) : !activeSession ? (
        <div className="bg-white border border-stone-200 rounded-xl p-10 text-center space-y-2">
          <UserCheck className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="text-base font-bold text-stone-900">
            ממתין לחיבור של &ldquo;{watchingUsername}&rdquo;
          </h3>
          <p className="text-sm text-stone-500 max-w-md mx-auto">
            כאשר המשתמש &ldquo;{watchingUsername}&rdquo; יתחבר בדפדפן או בחלון נוסף, תראו כאן בזמן אמת כל תזוזת עכבר, גלילה, חיפוש, צפייה במוצר ועדכון סל.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      activeSession.online ? 'bg-emerald-500' : 'bg-stone-400'
                    }`}
                  />
                  <h3 className="text-base font-bold text-stone-900">
                    {activeSession.displayName || activeSession.username} ({activeSession.username})
                  </h3>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  {activeSession.online ? 'מחובר כעת בשידור חי' : 'מנותק כרגע'} · פעולה אחרונה:{' '}
                  <strong className="text-stone-800">{activeSession.lastAction}</strong>
                </p>
              </div>
              <div className="text-left font-mono-tabular text-xs text-stone-500">
                <div>{activeSession.viewportWidth}×{activeSession.viewportHeight}</div>
                <div>
                  עודכן:{' '}
                  {new Date(activeSession.updatedAt).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
              </div>
            </div>

            {filterMode === 'mirror' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-lg">
                    <div className="text-xs text-stone-500 mb-1">עמוד נוכחי</div>
                    <div className="font-semibold text-stone-900">
                      {VIEW_LABELS[activeSession.view] || activeSession.view}
                    </div>
                  </div>
                  <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-lg">
                    <div className="text-xs text-stone-500 mb-1">גלילה וחיפוש</div>
                    <div className="font-mono-tabular font-bold text-[#C2410C]">
                      {activeSession.scrollPercent}% ({activeSession.scrollY}px)
                    </div>
                    {activeSession.searchQuery && (
                      <div className="text-[11px] text-stone-600 mt-0.5 truncate">
                        חיפוש: &ldquo;{activeSession.searchQuery}&rdquo;
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-lg">
                    <div className="text-xs text-stone-500 mb-1">מוצר במוקד כרגע</div>
                    <div className="font-semibold text-stone-900 truncate">
                      {activeSession.activeProductName || 'ללא מוצר פתוח'}
                    </div>
                  </div>
                </div>

                {/* Live Visual Viewport & Cursor Mirror */}
                <div className="border border-stone-200 rounded-xl overflow-hidden bg-stone-100">
                  <div className="px-4 py-2 bg-stone-900 text-white text-xs flex items-center justify-between">
                    <span>שיקוף מסך ועכבר בזמן אמת — {activeSession.username}</span>
                    <span className="font-mono-tabular">
                      גלילה {activeSession.scrollPercent}% · עכבר ({activeSession.cursorXPercent}%, {activeSession.cursorYPercent}%)
                    </span>
                  </div>
                  <div className="p-4 relative h-64 bg-[#FAF9F6] flex gap-4">
                    {/* Miniature page scroll map */}
                    <div className="w-28 bg-white border border-stone-200 rounded-lg p-2 relative overflow-hidden shrink-0">
                      <div className="h-4 bg-stone-200 rounded mb-2" />
                      <div className="grid grid-cols-2 gap-1 mb-2">
                        <div className="h-6 bg-stone-100 rounded" />
                        <div className="h-6 bg-stone-100 rounded" />
                        <div className="h-6 bg-stone-100 rounded" />
                        <div className="h-6 bg-stone-100 rounded" />
                      </div>
                      <div className="h-8 bg-stone-100 rounded" />
                      <div
                        className="absolute left-1 right-1 h-12 border-2 border-[#C2410C] bg-[#C2410C]/10 rounded transition-all duration-150 pointer-events-none"
                        style={{
                          top: `${Math.min(78, Math.max(4, activeSession.scrollPercent * 0.74))}%`,
                        }}
                      />
                    </div>

                    {/* Live screen canvas with moving cursor pointer */}
                    <div className="flex-1 flex flex-col justify-between bg-white border border-stone-200 rounded-lg p-4 relative overflow-hidden">
                      <div
                        className="absolute z-10 pointer-events-none transition-all duration-100 flex items-center gap-1"
                        style={{
                          left: `${Math.min(92, Math.max(4, activeSession.cursorXPercent))}%`,
                          top: `${Math.min(88, Math.max(6, activeSession.cursorYPercent))}%`,
                        }}
                      >
                        <MousePointer2 className="w-4 h-4 text-[#C2410C] fill-[#C2410C] drop-shadow" />
                        <span className="px-1.5 py-0.5 bg-[#C2410C] text-white text-[10px] font-semibold rounded">
                          {activeSession.username}
                        </span>
                      </div>

                      <div>
                        <div className="text-xs text-stone-500 mb-1">
                          מה רואים במסך של המשתמש כרגע:
                        </div>
                        <div className="text-base font-bold text-stone-900">
                          {activeSession.activeProductName
                            ? `מסתכל על: ${activeSession.activeProductName}`
                            : VIEW_LABELS[activeSession.view] || activeSession.view}
                        </div>
                        <p className="text-xs text-stone-600 mt-1">
                          פעולה אחרונה: {activeSession.lastAction}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-stone-500">
                          <span>התקדמות גלילה בעמוד</span>
                          <span className="font-mono-tabular">{activeSession.scrollPercent}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#C2410C] transition-all duration-150"
                            style={{ width: `${activeSession.scrollPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {filterMode === 'timeline' && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {activeSession.timeline.map((ev, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 py-2.5 px-3 bg-stone-50 border border-stone-100 rounded-lg text-sm"
                  >
                    <div>
                      <span className="font-semibold text-stone-900">{ev.action}</span>
                      {ev.detail && (
                        <span className="text-stone-500 mr-2 text-xs">· {ev.detail}</span>
                      )}
                    </div>
                    <span className="font-mono-tabular text-xs text-stone-400 shrink-0">
                      {new Date(ev.timestamp).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {filterMode === 'cart' && (
              <div className="space-y-3">
                {activeSession.cartItems.length === 0 ? (
                  <p className="text-sm text-stone-500 py-8 text-center">
                    הסל של {activeSession.username} ריק כרגע.
                  </p>
                ) : (
                  activeSession.cartItems.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm"
                    >
                      <span className="font-medium text-stone-900">
                        {item.name} ×{item.quantity}
                      </span>
                      <span className="font-mono-tabular font-bold text-stone-900">
                        ₪{item.price * item.quantity}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="font-semibold text-sm text-stone-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#C2410C]" />
                <span>מצב סל נוכחי</span>
              </span>
              <span className="font-mono-tabular text-sm font-bold text-[#C2410C]">
                {activeSession.cartCount} פריטים
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-stone-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>פעולות אחרונות</span>
              </div>
              {activeSession.timeline.slice(0, 7).map((ev, i) => (
                <div key={i} className="text-xs py-1.5 border-b border-stone-100 last:border-0">
                  <div className="font-medium text-stone-800">{ev.action}</div>
                  <div className="text-stone-500 flex justify-between mt-0.5">
                    <span className="truncate max-w-[160px]">{ev.detail}</span>
                    <span className="font-mono-tabular">
                      {new Date(ev.timestamp).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
