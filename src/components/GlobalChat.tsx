import { api } from '../services/firebase';
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, UserProfile } from '../types/game';
import { AlertCircle, Flag, LogIn, MessageSquare, Send, UserX } from 'lucide-react';
import { AuthModalMode } from './AuthModal';

interface GlobalChatProps {
  messages: ChatMessage[];
  currentUser: UserProfile | null;
  onSendMessage: (text: string) => Promise<{ success: boolean; error?: string }>;
  onOpenAuth: (mode: AuthModalMode) => void;
}

export const GlobalChat: React.FC<GlobalChatProps> = ({
  messages,
  currentUser,
  onSendMessage,
  onOpenAuth,
}) => {
  const [inputText, setInputText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [reportedMsgIds, setReportedMsgIds] = useState<string[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!currentUser) {
      onOpenAuth('login');
      return;
    }

    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (trimmed.length > 280) {
      setErrorMsg('Message exceeds 280 character limit.');
      return;
    }

    const urlPattern = /(https?:\/\/|www\.)[^\s]+/gi;
    if (urlPattern.test(trimmed)) {
      setErrorMsg('Links are disabled in Round Chat per anti-spam moderation policy.');
      return;
    }

    const res = await onSendMessage(trimmed);
    if (res.success) {
      setInputText('');
    } else {
      setErrorMsg(res.error || 'Failed to send message.');
    }
  };

  const handleReport = async (id: string) => { try { await api('/reports', 'POST', { messageId: id }); setReportedMsgIds(prev => [...prev, id]); } catch (e) { setErrorMsg((e as Error).message); } };

  const handleBlock = async (userId: string) => { try { await api('/blocks', 'POST', { userId }); setBlockedUsers(prev => [...prev, userId]); } catch (e) { setErrorMsg((e as Error).message); } };

  const visibleMessages = messages.filter((m) => !blockedUsers.includes(m.userId));

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800/80 p-5 shadow-xl backdrop-blur-sm flex flex-col h-[650px]">
      {/* Header matching wireframe: "Global chat" */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-slate-200 tracking-wide">
            Global chat
          </h2>
        </div>
        <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Live Round</span>
        </div>
      </div>

      {/* Messages stream */}
      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 text-xs"
      >
        {visibleMessages.map((msg) => {
          const isMe = currentUser ? msg.userId === currentUser.id : false;
          const isReported = reportedMsgIds.includes(msg.id);

          if (msg.isSystem) {
            return (
              <div
                key={msg.id}
                className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-800/50 text-[11px] text-cyan-200 text-center font-medium"
              >
                {msg.message}
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`group p-2 rounded-xl transition-colors ${
                isMe
                  ? 'bg-cyan-950/30 border border-cyan-800/40'
                  : 'bg-slate-950/60 border border-slate-800/50 hover:border-slate-700/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[9px] text-slate-200">
                    {msg.username.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="truncate max-w-[110px] text-slate-200">
                    {msg.username}
                  </span>
                  {isMe && (
                    <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950 px-1 py-0.2 rounded border border-cyan-800/60">
                      You
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                  <span>{msg.timestamp}</span>
                  {!isMe && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-1">
                      <button
                        type="button"
                        onClick={() => handleReport(msg.id)}
                        disabled={isReported}
                        title="Report message"
                        className="text-slate-500 hover:text-amber-400 cursor-pointer disabled:text-amber-400"
                      >
                        <Flag className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBlock(msg.userId)}
                        title="Block user"
                        className="text-slate-500 hover:text-rose-400 cursor-pointer"
                      >
                        <UserX className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-slate-300 text-xs leading-relaxed break-words">
                {isReported ? (
                  <span className="italic text-slate-500">
                    [Reported for moderation review]
                  </span>
                ) : (
                  msg.message
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input area */}
      <div className="pt-2 border-t border-slate-800/80 shrink-0">
        {errorMsg && (
          <div className="mb-2 text-[11px] text-rose-400 bg-rose-950/40 p-1.5 rounded flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {currentUser ? (
          <>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setErrorMsg(null);
                }}
                maxLength={280}
                placeholder="Share insights or discuss..."
                className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
              <span>Rate limited & moderated (Section 25)</span>
              <span className="font-mono">{inputText.length}/280</span>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onOpenAuth('login')}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-cyan-400 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log In to Join Round Chat</span>
          </button>
        )}
      </div>
    </div>
  );
};
