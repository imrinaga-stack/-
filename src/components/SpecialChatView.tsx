import React, { useEffect, useRef, useState } from 'react';
import { Send, MessageSquare, User } from 'lucide-react';
import type { ChatMessage, OrderReceipt, SafeUser, StoreSettings } from '../types';
import { ReceiptCard, StoreLogo } from './BarcodeVisuals';
import { GmailConfirmModal } from './GmailConfirmModal';

interface SpecialChatViewProps {
  user: SafeUser;
  settings: StoreSettings;
  messages: ChatMessage[];
  allUsers: SafeUser[];
  onSendMessage: (targetUsername: string, text: string) => Promise<void>;
  onReceiptUpdated?: () => void;
}

export function SpecialChatView({
  user,
  settings,
  messages,
  allUsers,
  onSendMessage,
  onReceiptUpdated,
}: SpecialChatViewProps) {
  const familyUsers = allUsers.filter((u) => u.role === 'family');
  const [selectedThread, setSelectedThread] = useState<string>(
    user.role === 'admin' ? familyUsers[0]?.username || '' : user.username
  );
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [gmailModalReceipt, setGmailModalReceipt] = useState<OrderReceipt | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activeThread = user.role === 'admin' ? selectedThread : user.username;
  const threadMessages = messages.filter(
    (m) => m.username.toLowerCase() === activeThread.toLowerCase()
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length, activeThread]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !activeThread || sending) return;
    setSending(true);
    try {
      await onSendMessage(activeThread, text.trim());
      setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-900">
            צ׳אט הקבלות וההודעות של {settings.storeName}
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            כל קבלה מהחנות נשלחת לכאן אוטומטית מיד אחרי ההזמנה — כולל שליחה ל-Gmail והורדה כ-PDF.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-[260px_1fr] min-h-[560px]">
          <div className="border-b md:border-b-0 md:border-l border-stone-200 bg-stone-50 p-4">
            {user.role === 'admin' ? (
              <div>
                <div className="text-xs font-semibold text-stone-500 mb-3">
                  שיחות עם בני המשפחה
                </div>
                <div className="space-y-1.5">
                  {familyUsers.map((u) => {
                    const count = messages.filter((m) => m.username === u.username).length;
                    const active = selectedThread === u.username;
                    return (
                      <button
                        key={u.username}
                        type="button"
                        onClick={() => setSelectedThread(u.username)}
                        className={`w-full text-right px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between cursor-pointer ${
                          active
                            ? 'bg-white text-stone-900 font-semibold border border-stone-200 shadow-2xs'
                            : 'text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <User className="w-4 h-4 shrink-0 text-stone-400" />
                          <span className="truncate">{u.displayName}</span>
                        </span>
                        <span className="font-mono-tabular text-xs text-stone-400">{count}</span>
                      </button>
                    );
                  })}
                  {familyUsers.length === 0 && (
                    <p className="text-xs text-stone-500">אין עדיין משתמשי משפחה רשומים.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <StoreLogo
                    logoDataUrl={settings.logoDataUrl}
                    storeName={settings.storeName}
                    size="md"
                  />
                  <div>
                    <div className="font-bold text-sm text-stone-900">{settings.storeName}</div>
                    <div className="text-xs text-stone-500">ערוץ אישי לקבלות והודעות</div>
                  </div>
                </div>
                <div className="text-xs text-stone-600 leading-relaxed pt-3 border-t border-stone-200">
                  מחובר כרגע: <strong>{user.displayName}</strong> ({user.username})
                  <br />
                  מייל לקבלות:{' '}
                  <span className="font-mono-tabular" dir="ltr">
                    {user.email}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col h-[560px]">
            <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#C2410C]" />
                <span className="font-semibold text-sm text-stone-900">
                  {user.role === 'admin'
                    ? activeThread
                      ? `צ׳אט עם ${familyUsers.find((f) => f.username === activeThread)?.displayName || activeThread}`
                      : 'אין עדיין שיחות משפחתיות'
                    : `צ׳אט ישיר עם ${settings.storeName}`}
                </span>
              </div>
              <span className="text-xs text-stone-500 font-mono-tabular">
                {threadMessages.length} הודעות
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#FAF9F6]">
              {!activeThread ? (
                <div className="text-center py-12 text-sm text-stone-500">
                  צרו משתמש משפחה בפאנל הניהול כדי להתחיל לשלוח ולקבל קבלות בצ׳אט.
                </div>
              ) : threadMessages.length === 0 && (
                <div className="text-center py-12 text-sm text-stone-500">
                  עדיין אין הודעות בשיחה זו. קבלה ראשונה תופיע כאן מיד אחרי ההזמנה!
                </div>
              )}

              {threadMessages.map((msg) => {
                const isMine =
                  (user.role === 'admin' && msg.senderRole === 'admin') ||
                  (user.role === 'family' && msg.senderRole === 'family');

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-start' : 'items-end'}`}
                  >
                    <div className="text-[11px] text-stone-500 mb-1 px-1">
                      {msg.sender} ·{' '}
                      <span className="font-mono-tabular">
                        {new Date(msg.createdAt).toLocaleTimeString('he-IL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {msg.receipt ? (
                      <div className="space-y-2 max-w-md w-full">
                        <div className="bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800">
                          {msg.text}
                        </div>
                        <ReceiptCard
                          receipt={msg.receipt}
                          fallbackLogo={settings.logoDataUrl}
                          onRequestSendGmail={(r) => setGmailModalReceipt(r)}
                        />
                      </div>
                    ) : (
                      <div
                        className={`max-w-md rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          isMine
                            ? 'bg-[#C2410C] text-white'
                            : 'bg-white border border-stone-200 text-stone-900'
                        }`}
                      >
                        {msg.text}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-4 border-t border-stone-200 bg-white flex items-center gap-3"
            >
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="כתבו הודעה..."
                className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C]"
              />
              <button
                type="submit"
                disabled={!text.trim() || !activeThread || sending}
                className="px-4 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
              >
                <span>שלח</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      <GmailConfirmModal
        receipt={gmailModalReceipt}
        onClose={() => setGmailModalReceipt(null)}
        onSent={() => onReceiptUpdated?.()}
      />
    </>
  );
}
