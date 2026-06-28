import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Download, Plus, Trash2, X, Check, AlertTriangle, MessageCircle, Copy, Mail } from 'lucide-react';
import { formatDate, formatCurrency, calculatePenalty, downloadTextFile } from '../lib/helpers';
import { loadJson, saveJson } from '../lib/storage';
import type { AppUser, PlatformSettings, DemoUsageLog, ChatMessage, SharedDocument, Announcement, BookedMeeting, ShareHistoryItem, AutoEscalationRule, EscalationLogEntry } from '../types/platform';
import { DISTRICTS } from '../types/platform';
import { UgandaCoatOfArms, UGANDA_COAT_OF_ARMS_TEXT } from '../components/UgandaCoatOfArms';
import type { Property } from '../property';

export function MeetingRoomPage({ currentUser, users, showToast, isSuperAdmin }: { currentUser: AppUser; users: AppUser[]; showToast: (m: string, t?: 'success' | 'error') => void; isSuperAdmin: boolean }) {
  const [tab, setTab] = useState<'chat' | 'docs' | 'announcements' | 'notes' | 'booking'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadJson('ultt_meeting_chat', []));
  const [chatInput, setChatInput] = useState('');
  const [docs, setDocs] = useState<SharedDocument[]>(() => loadJson('ultt_shared_docs', []));
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => loadJson('ultt_meeting_announcements', []));
  const [notes, setNotes] = useState(() => safeNotes());
  const [lastSaved, setLastSaved] = useState('');
  const [annForm, setAnnForm] = useState({ title: '', body: '', priority: 'Normal' as Announcement['priority'] });
  const [meetings, setMeetings] = useState<BookedMeeting[]>(() => loadJson('ultt_meetings', []));
  const [meetForm, setMeetForm] = useState({ title: '', description: '', date: '', startTime: '', endTime: '', attendees: [] as string[], platform: 'Zoom Meeting' as BookedMeeting['platform'], locationNotes: '' });
  const [booked, setBooked] = useState<BookedMeeting | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);

  const chatContainerStyle: React.CSSProperties = {
    height: '400px',
    overflowY: 'scroll',
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    scrollBehavior: 'smooth',
  };

  function safeNotes() { return loadJson('ultt_meeting_notes', ''); }

  const handleChatScroll = () => {
    if (!chatRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setUserScrolledUp(!isNearBottom);
  };

  useEffect(() => { saveJson('ultt_meeting_chat', messages.slice(-50)); }, [messages]);

  useEffect(() => {
    if (!userScrolledUp && chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, userScrolledUp]);

  useEffect(() => { const i = setInterval(() => { setMessages(loadJson('ultt_meeting_chat', [])); }, 2000); return () => clearInterval(i); }, []);
  useEffect(() => { const i = setInterval(() => { saveJson('ultt_meeting_notes', notes); setLastSaved(formatDate(new Date(), 'MMM d, HH:mm')); }, 30000); return () => clearInterval(i); }, [notes]);

  const sendChat = () => {
    if (!chatInput.trim()) return;
    setMessages((prev) => [...prev.slice(-49), { id: Date.now(), sender: currentUser.fullName, message: chatInput.trim(), timestamp: formatDate(new Date(), 'MMM d, HH:mm') }]);
    setChatInput('');
  };

  const uploadDoc = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setDocs((prev) => [...prev, { id: Date.now(), filename: file.name, uploadedBy: currentUser.fullName, date: formatDate(new Date(), 'yyyy-MM-dd'), size: `${Math.round(file.size / 1024)}KB`, data: reader.result as string }]);
      saveJson('ultt_shared_docs', [...docs, { id: Date.now(), filename: file.name, uploadedBy: currentUser.fullName, date: formatDate(new Date(), 'yyyy-MM-dd'), size: `${Math.round(file.size / 1024)}KB`, data: reader.result as string }]);
      showToast('Document uploaded');
    };
    reader.readAsDataURL(file);
  };

  const genLink = (platform: BookedMeeting['platform']) => {
    if (platform === 'Zoom Meeting') return `zoom.us/j/${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    if (platform === 'Google Meet') return `meet.google.com/${['abc', 'def', 'ghi'].map(() => ['a', 'b', 'c', 'd'][Math.floor(Math.random() * 4)]).join('-')}`;
    if (platform === 'Microsoft Teams') return `teams.microsoft.com/l/meetup-join/${Date.now().toString(36)}`;
    return meetForm.locationNotes || 'In-person meeting';
  };

  const bookMeeting = () => {
    const link = genLink(meetForm.platform);
    const m: BookedMeeting = { id: Date.now(), ...meetForm, link, bookedBy: currentUser.fullName };
    setMeetings((prev) => [...prev, m]);
    saveJson('ultt_meetings', [...meetings, m]);
    setBooked(m);
    showToast('Meeting booked');
  };

  const downloadIcs = (m: BookedMeeting) => {
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${m.date.replace(/-/g, '')}T${m.startTime.replace(':', '')}00\nDTEND:${m.date.replace(/-/g, '')}T${m.endTime.replace(':', '')}00\nSUMMARY:${m.title}\nDESCRIPTION:${m.link}\nEND:VEVENT\nEND:VCALENDAR`;
    downloadTextFile(`${m.title}.ics`, ics);
  };

  return (
    <div
      className="animate-fadeIn"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 60px)',
        overflow: 'hidden',
      }}
    >
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white shrink-0 px-1 pt-1">Meeting Room</h1>

      <div className="flex gap-2 flex-wrap shrink-0 px-1 py-2">
        {(['chat', 'docs', 'announcements', 'notes', 'booking'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 rounded text-sm capitalize ${tab === t ? 'bg-[#C8102E] text-white' : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-200'}`}>
            {t === 'booking' ? 'Book Meeting' : t}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          gap: '16px',
          padding: '16px',
          minHeight: 0,
        }}
      >
        {tab === 'chat' && (
          <>
            <div
              style={{
                width: '40%',
                minWidth: '280px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow"
            >
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-white shrink-0">
                Admin Chat Room
              </div>
              <div className="relative shrink-0">
                <div
                  ref={chatRef}
                  onScroll={handleChatScroll}
                  style={chatContainerStyle}
                  className="p-3 space-y-2"
                >
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === currentUser.fullName ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-2 rounded-lg text-sm ${m.sender === currentUser.fullName ? 'bg-[#C8102E] text-white' : 'bg-gray-800 text-white'}`}>
                        <p className="text-xs opacity-70">{m.sender} <span className="inline-block w-2 h-2 bg-green-400 rounded-full ml-1" /> {m.timestamp}</p>
                        {m.message}
                      </div>
                    </div>
                  ))}
                </div>
                {userScrolledUp && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserScrolledUp(false);
                      if (chatRef.current) {
                        chatRef.current.scrollTop = chatRef.current.scrollHeight;
                      }
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#C8102E',
                      color: 'white',
                      border: 'none',
                      borderRadius: '20px',
                      padding: '6px 16px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      zIndex: 10,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                  >
                    ↓ New messages
                  </button>
                )}
              </div>
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2 shrink-0">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat()} className="flex-1 border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Type message..." />
                <button onClick={sendChat} className="bg-[#C8102E] text-white px-4 rounded">Send</button>
              </div>
            </div>
            <div
              style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-sm text-gray-500 dark:text-gray-400"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Documents & Announcements</h3>
              <p>Switch to the <strong>docs</strong> or <strong>announcements</strong> tabs to share files and post updates. Chat messages persist locally for all admins.</p>
              {docs.length > 0 && (
                <div className="mt-4">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">Recent documents ({docs.length})</p>
                  <ul className="space-y-1">
                    {docs.slice(-5).map((d) => (
                      <li key={d.id} className="text-xs">{d.filename} — {d.uploadedBy}</li>
                    ))}
                  </ul>
                </div>
              )}
              {announcements.length > 0 && (
                <div className="mt-4">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">Recent announcements ({announcements.length})</p>
                  <ul className="space-y-1">
                    {announcements.slice(-3).map((a) => (
                      <li key={a.id} className="text-xs">{a.title} — {a.priority}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'docs' && (
          <div
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
          >
          <button onClick={() => docRef.current?.click()} className="mb-4 bg-gray-800 text-white px-4 py-2 rounded flex items-center gap-2"><Plus size={16} /> Upload Document</button>
          <input ref={docRef} type="file" accept=".pdf,.docx,.xlsx,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(f); }} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Documents shared here are visible to all Admins</p>
          {docs.map((d) => (
            <div key={d.id} className="flex justify-between items-center py-2 border-b text-sm">
              <span>{d.filename} — {d.uploadedBy} — {d.date} — {d.size}</span>
              <div className="flex gap-2">
                <a href={d.data} download={d.filename} className="text-blue-600"><Download size={16} /></a>
                {isSuperAdmin && <button onClick={() => setDocs((prev) => prev.filter((x) => x.id !== d.id))}><Trash2 size={16} /></button>}
              </div>
            </div>
          ))}
          </div>
        )}

        {tab === 'announcements' && (
          <div
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
            className="space-y-4"
          >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 grid gap-3">
            <input placeholder="Title" value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} className="border rounded px-3 py-2" />
            <textarea placeholder="Message" value={annForm.body} onChange={(e) => setAnnForm({ ...annForm, body: e.target.value })} className="border rounded px-3 py-2" rows={3} />
            <select value={annForm.priority} onChange={(e) => setAnnForm({ ...annForm, priority: e.target.value as Announcement['priority'] })} className="border rounded px-3 py-2"><option>Normal</option><option>Urgent</option><option>Critical</option></select>
            <button onClick={() => { const a = { id: Date.now(), ...annForm, postedBy: currentUser.fullName, date: formatDate(new Date(), 'yyyy-MM-dd') }; setAnnouncements((p) => [...p, a]); saveJson('ultt_meeting_announcements', [...announcements, a]); showToast('Posted'); }} className="bg-[#C8102E] text-white py-2 rounded">Post</button>
          </div>
          {announcements.map((a) => (
            <div key={a.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${a.priority === 'Urgent' ? 'border-2 border-orange-400' : a.priority === 'Critical' ? 'border-2 border-red-500 font-bold' : ''}`}>
              <h3 className="font-bold text-gray-900 dark:text-white">{a.title}</h3><p className="text-sm text-gray-700 dark:text-gray-300">{a.body}</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{a.postedBy} — {a.date}</p>
            </div>
          ))}
          </div>
        )}

        {tab === 'notes' && (
          <div
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
          >
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded p-3 h-48" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Last saved: {lastSaved || 'Not yet saved'}</p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => downloadTextFile('meeting_notes.txt', notes)} className="bg-gray-800 text-white px-4 py-2 rounded text-sm">Download Notes</button>
            {isSuperAdmin && <button onClick={() => { if (confirm('Clear all notes?')) setNotes(''); }} className="bg-red-600 text-white px-4 py-2 rounded text-sm">Clear Notes</button>}
          </div>
        </div>
        )}

        {tab === 'booking' && (
          <div
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
            className="space-y-4"
          >
          {booked && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-900 dark:text-white">{booked.title}</h3>
              <p>{booked.date} {booked.startTime}-{booked.endTime}</p>
              <a href={`https://${booked.link}`} className="text-blue-600 underline">{booked.link}</a>
              <div className="flex gap-2 mt-2">
                <button onClick={() => { navigator.clipboard.writeText(booked.link); showToast('Link copied'); }} className="text-sm bg-gray-200 px-3 py-1 rounded">Copy Link</button>
                <button onClick={() => downloadIcs(booked)} className="text-sm bg-gray-200 px-3 py-1 rounded">Add to Calendar</button>
              </div>
            </div>
          )}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 grid md:grid-cols-2 gap-3">
            <input placeholder="Meeting Title" value={meetForm.title} onChange={(e) => setMeetForm({ ...meetForm, title: e.target.value })} className="border rounded px-3 py-2" />
            <textarea placeholder="Description" value={meetForm.description} onChange={(e) => setMeetForm({ ...meetForm, description: e.target.value })} className="border rounded px-3 py-2 md:col-span-2" />
            <input type="date" value={meetForm.date} onChange={(e) => setMeetForm({ ...meetForm, date: e.target.value })} className="border rounded px-3 py-2" />
            <input type="time" value={meetForm.startTime} onChange={(e) => setMeetForm({ ...meetForm, startTime: e.target.value })} className="border rounded px-3 py-2" />
            <input type="time" value={meetForm.endTime} onChange={(e) => setMeetForm({ ...meetForm, endTime: e.target.value })} className="border rounded px-3 py-2" />
            <select value={meetForm.platform} onChange={(e) => setMeetForm({ ...meetForm, platform: e.target.value as BookedMeeting['platform'] })} className="border rounded px-3 py-2">
              <option>Zoom Meeting</option><option>Google Meet</option><option>Microsoft Teams</option><option>In-Person</option>
            </select>
            <input placeholder="Location/Notes" value={meetForm.locationNotes} onChange={(e) => setMeetForm({ ...meetForm, locationNotes: e.target.value })} className="border rounded px-3 py-2" />
            <select multiple value={meetForm.attendees} onChange={(e) => setMeetForm({ ...meetForm, attendees: Array.from(e.target.selectedOptions, (o) => o.value) })} className="border rounded px-3 py-2 md:col-span-2 h-24">
              {users.map((u) => <option key={u.id} value={u.fullName}>{u.fullName}</option>)}
            </select>
            <button onClick={bookMeeting} className="md:col-span-2 bg-[#C8102E] text-white py-2 rounded">Book Meeting</button>
          </div>
          <div className="space-y-2">{[...meetings].sort((a, b) => a.date.localeCompare(b.date)).map((m) => (
            <div key={m.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${new Date(m.date) < new Date() ? 'opacity-60' : ''}`}>
              <div className="flex justify-between"><h4 className="font-medium">{m.title}</h4>{new Date(m.date) < new Date() && <span className="text-xs bg-gray-200 px-2 py-1 rounded">Completed</span>}</div>
              <p className="text-sm">{m.date} {m.startTime}-{m.endTime} — {m.platform}</p>
              <button onClick={() => { navigator.clipboard.writeText(m.link); showToast('Copied'); }} className="text-blue-600 text-sm">Copy Link</button>
            </div>
          ))}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">Note: Meeting links above are generated placeholders. To generate real Zoom or Google Meet links, the Super Admin must connect the platform to Zoom API or Google Calendar API.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ShareAnnouncePage({ currentUser, showToast }: { currentUser: AppUser; showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('Public');
  const [priority, setPriority] = useState('Normal');
  const [lang, setLang] = useState('English');
  const [history, setHistory] = useState<ShareHistoryItem[]>(() => loadJson('ultt_share_history', []));
  const fullMsg = `[${priority}] ${title}\n\n${message}\n\n— ${currentUser.fullName}, Uganda Land Tax Tracker`;

  const logShare = (channels: string[]) => {
    const item: ShareHistoryItem = { id: Date.now(), title, messagePreview: message.slice(0, 80), channels, date: formatDate(new Date(), 'yyyy-MM-dd'), sharedBy: currentUser.fullName, audience };
    setHistory((p) => [item, ...p]);
    saveJson('ultt_share_history', [item, ...history]);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Share & Announce</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-3">
        <UgandaCoatOfArms size={64} className="mx-auto" />
        <h3 className="ultt-section-title">Compose Announcement</h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full border rounded px-3 py-2" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 500))} placeholder="Message" rows={4} className="w-full border rounded px-3 py-2" />
        <p className="text-xs text-gray-500 dark:text-gray-400">{message.length}/500 characters</p>
        <div className="grid md:grid-cols-3 gap-3">
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="border rounded px-3 py-2"><option>Public</option><option>Internal Admins</option><option>District Officers</option></select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="border rounded px-3 py-2"><option>Normal</option><option>Urgent</option><option>Emergency</option></select>
          <select value={lang} onChange={(e) => setLang(e.target.value)} className="border rounded px-3 py-2"><option>English</option><option>Luganda</option></select>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <button onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(fullMsg)}`, '_blank'); logShare(['WhatsApp']); }} className="bg-green-500 text-white p-4 rounded-lg flex items-center gap-2 justify-center"><MessageCircle size={20} /> WhatsApp</button>
        <button onClick={() => { window.open(`sms:?body=${encodeURIComponent(fullMsg)}`, '_blank'); logShare(['SMS']); }} className="bg-blue-500 text-white p-4 rounded-lg">SMS</button>
        <button onClick={() => { navigator.clipboard.writeText(fullMsg); showToast('Message copied. Paste into any app.'); logShare(['Copy']); }} className="bg-gray-500 text-white p-4 rounded-lg flex items-center gap-2 justify-center"><Copy size={20} /> Copy</button>
        <button onClick={() => { downloadTextFile(`announcement_${Date.now()}.txt`, `ULTT OFFICIAL ANNOUNCEMENT\n${formatDate(new Date(), 'MMMM d, yyyy')}\n${UGANDA_COAT_OF_ARMS_TEXT}\n\n${fullMsg}`); logShare(['PDF']); }} className="bg-red-600 text-white p-4 rounded-lg">Download PDF</button>
        <button onClick={() => { window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}`); logShare(['Email']); }} className="bg-blue-600 text-white p-4 rounded-lg flex items-center gap-2 justify-center"><Mail size={20} /> Email</button>
      </div>
      <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-sm text-gray-600 dark:text-gray-400">For official government website announcements: Download the PDF version and upload it directly to your government portal or ministry website.</div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm"><thead className="bg-[#C8102E] text-white"><tr>{['Title', 'Preview', 'Channels', 'Date', 'By', ''].map((h) => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-white uppercase">{h}</th>)}</tr></thead>
          <tbody>{history.map((h) => <tr key={h.id} className="border-t"><td className="px-4 py-2">{h.title}</td><td className="px-4 py-2">{h.messagePreview}</td><td className="px-4 py-2">{h.channels.join(', ')}</td><td className="px-4 py-2">{h.date}</td><td className="px-4 py-2">{h.sharedBy}</td><td className="px-4 py-2"><button onClick={() => { setTitle(h.title); setMessage(h.messagePreview); }} className="text-blue-600 text-xs">Reshare</button></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export function SettingsPage({ settings, setSettings, onNavigateImport, onExportAll, onClearData, demoMode, setDemoMode, onResetDemo, demoUsageLog, setDemoUsageLog, currentUser, showToast }: {
  settings: PlatformSettings; setSettings: React.Dispatch<React.SetStateAction<PlatformSettings>>;
  onNavigateImport: () => void; onExportAll: () => void; onClearData: () => void;
  demoMode: boolean; setDemoMode: (v: boolean) => void; onResetDemo: () => void;
  demoUsageLog: DemoUsageLog[]; setDemoUsageLog: React.Dispatch<React.SetStateAction<DemoUsageLog[]>>;
  currentUser: AppUser; showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [confirmClear, setConfirmClear] = useState('');
  if (currentUser.role !== 'superAdmin') return <div className="p-12 text-center"><AlertTriangle className="mx-auto text-red-500 mb-4" size={48} /><p>Settings restricted to Super Administrator.</p></div>;

  const save = () => { saveJson('ultt_settings', settings); showToast('Settings saved'); };
  const toggleDemo = (v: boolean) => {
    setDemoMode(v);
    setDemoUsageLog((p) => [...p, { id: Date.now(), user: currentUser.fullName, role: currentUser.role, timestamp: formatDate(new Date(), 'MMM d, yyyy HH:mm'), action: v ? 'enabled' : 'disabled' }]);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-3">
        <h3 className="ultt-section-title">Platform Configuration</h3>
        {(['authorityName', 'districtName', 'revenueOfficeContact', 'bankAccountDetails', 'officialStampText'] as const).map((k) => (
          <input key={k} placeholder={k.replace(/([A-Z])/g, ' $1')} value={settings[k]} onChange={(e) => setSettings({ ...settings, [k]: e.target.value })} className="w-full border rounded px-3 py-2" />
        ))}
        <button onClick={save} className="bg-[#C8102E] text-white px-6 py-2 rounded">Save</button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-3">
        <h3 className="ultt-section-title">Data Management</h3>
        <button onClick={onNavigateImport} className="bg-gray-800 text-white px-4 py-2 rounded mr-2">Import Real Data</button>
        <button onClick={onExportAll} className="bg-gray-800 text-white px-4 py-2 rounded mr-2">Export All Data</button>
        <input value={confirmClear} onChange={(e) => setConfirmClear(e.target.value)} placeholder='Type DELETE to confirm' className="border rounded px-3 py-2 mr-2" />
        <button onClick={() => { if (confirmClear === 'DELETE') onClearData(); else showToast('Type DELETE to confirm', 'error'); }} className="bg-red-600 text-white px-4 py-2 rounded">Clear All Data</button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-3">
        <h3 className="ultt-section-title">Demo Mode Settings</h3>
        <label className="flex items-center gap-2"><input type="checkbox" checked={demoMode} onChange={(e) => toggleDemo(e.target.checked)} /> Enable Demo Mode</label>
        <button onClick={onResetDemo} className="bg-gray-600 text-white px-4 py-2 rounded">Reset Demo Data</button>
        <p className="text-sm text-gray-500 dark:text-gray-400">Demo Mode is for officer training only. It uses fictional data that does not represent real records.</p>
        {demoUsageLog.slice(-5).reverse().map((l) => <p key={l.id} className="text-xs text-gray-500 dark:text-gray-400">{l.timestamp}: {l.user} {l.action} demo mode</p>)}
      </div>
    </div>
  );
}

export function InterestProjectionPage({ properties }: { properties: Property[] }) {
  const delinquent = properties.filter((p) => p.status !== 'paid');
  const totalInterest = delinquent.reduce((s, p) => s + calculatePenalty(p.annualTaxDue, p.taxDueDate).interest, 0);
  const dailyTotal = delinquent.reduce((s, p) => s + calculatePenalty(p.annualTaxDue, p.taxDueDate).dailyInterest, 0);
  const monthlyCost = dailyTotal * 30;
  const projected6 = totalInterest + monthlyCost * 6;
  const monthCost = Math.round(monthlyCost);

  const chartData = (delayMonths: number) => Array.from({ length: 13 }, (_, m) => {
    const interest = delinquent.reduce((s, p) => s + p.annualTaxDue * 0.02 * Math.max(0, m - delayMonths + calculatePenalty(p.annualTaxDue, p.taxDueDate).monthsOverdue), 0);
    return { x: m, y: Math.round(interest) };
  });

  const green = chartData(0);
  const orange = chartData(3);
  const red = chartData(999);
  const maxY = Math.max(...green.map((d) => d.y), 1);

  const toPoints = (data: { x: number; y: number }[]) => data.map((d) => `${40 + d.x * 22},${180 - (d.y / maxY) * 150}`).join(' ');

  const districtBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    delinquent.forEach((p) => { map[p.district] = (map[p.district] || 0) + calculatePenalty(p.annualTaxDue, p.taxDueDate).interest; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [delinquent]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cost of Enforcement Delay</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-sm text-gray-500 dark:text-gray-400">Current Interest Owed</p><p className="text-xl font-bold text-red-600">{formatCurrency(totalInterest)}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-sm text-gray-500 dark:text-gray-400">Interest/Day</p><p className="text-xl font-bold">{formatCurrency(dailyTotal)}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-sm text-gray-500 dark:text-gray-400">Interest/Month</p><p className="text-xl font-bold">{formatCurrency(monthlyCost)}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-sm text-gray-500 dark:text-gray-400">Projected 6 Months</p><p className="text-xl font-bold text-orange-600">{formatCurrency(projected6)}</p></div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="font-semibold mb-2">Every month of delay costs UGX {monthCost.toLocaleString()}</h3>
        <svg viewBox="0 0 320 200" className="w-full h-64">
          <polyline fill="none" stroke="#22c55e" strokeWidth="2" points={toPoints(green)} />
          <polyline fill="none" stroke="#f97316" strokeWidth="2" points={toPoints(orange)} />
          <polyline fill="none" stroke="#ef4444" strokeWidth="2" points={toPoints(red)} />
          <text x="160" y="195" textAnchor="middle" fontSize="10" fill="#666">Months (0-12)</text>
        </svg>
        <div className="flex gap-4 text-xs justify-center mt-2"><span className="text-green-600">● Enforcement today</span><span className="text-orange-500">● Delayed 3 months</span><span className="text-red-500">● No enforcement</span></div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm"><thead className="bg-[#C8102E] text-white"><tr><th className="px-4 py-2 text-left text-xs font-medium text-white uppercase">District</th><th className="px-4 py-2 text-right text-xs font-medium text-white uppercase">Interest Owed</th></tr></thead>
          <tbody>{districtBreakdown.map(([d, v]) => <tr key={d} className="border-t"><td className="px-4 py-2">{d}</td><td className="px-4 py-2 text-right">{formatCurrency(v)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export function AutoEscalationPage({ rules, setRules, setProperties, onLog, showToast, isActionDisabled }: {
  rules: AutoEscalationRule[]; setRules: React.Dispatch<React.SetStateAction<AutoEscalationRule[]>>;
  properties: Property[]; setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  onLog: (entry: Omit<EscalationLogEntry, 'id'>) => void; showToast: (m: string) => void; isActionDisabled: boolean;
}) {
  const runRules = () => {
    if (isActionDisabled) return;
    let count = 0;
    setProperties((prev) => prev.map((p) => {
      if (p.status === 'paid') return p;
      const pen = calculatePenalty(p.annualTaxDue, p.taxDueDate);
      const rule = rules.find((r) => r.enabled && (!r.district || r.district === p.district));
      if (!rule) return p;
      let stage = p.enforcementStage;
      if (rule.id === 1 && pen.daysOverdue >= 30) { stage = 'interest_accruing'; onLog({ date: formatDate(new Date(), 'yyyy-MM-dd'), property: p.plotNumber, ruleTriggered: rule.label, actionTaken: 'Stage 1 reminder sent', mode: 'Auto' }); count++; }
      if (rule.id === 2 && pen.daysOverdue >= 60) { stage = 'demand_notice'; onLog({ date: formatDate(new Date(), 'yyyy-MM-dd'), property: p.plotNumber, ruleTriggered: rule.label, actionTaken: 'Demand notice generated', mode: 'Auto' }); count++; }
      if (rule.id === 3 && pen.daysOverdue >= 90) { stage = 'rent_interception'; onLog({ date: formatDate(new Date(), 'yyyy-MM-dd'), property: p.plotNumber, ruleTriggered: rule.label, actionTaken: 'Stage 3 template sent', mode: 'Auto' }); count++; }
      if (rule.id === 4 && pen.daysOverdue >= 180) { stage = 'legal_action'; onLog({ date: formatDate(new Date(), 'yyyy-MM-dd'), property: p.plotNumber, ruleTriggered: rule.label, actionTaken: 'Legal case opened', mode: 'Auto' }); count++; }
      return stage !== p.enforcementStage ? { ...p, enforcementStage: stage } : p;
    }));
    showToast(`${count} escalation actions applied`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Auto-Escalation</h1><button onClick={runRules} disabled={isActionDisabled} className="bg-[#C8102E] text-white px-4 py-2 rounded disabled:opacity-50">Run Rules Now</button></div>
      {rules.map((r) => (
        <div key={r.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap gap-4 items-center justify-between">
          <div><h3 className="font-medium">{r.label}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{r.description}</p></div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={r.enabled} onChange={(e) => setRules((prev) => prev.map((x) => x.id === r.id ? { ...x, enabled: e.target.checked } : x))} /> On</label>
          <select value={r.district} onChange={(e) => setRules((prev) => prev.map((x) => x.id === r.id ? { ...x, district: e.target.value } : x))} className="border rounded px-3 py-2 text-sm">
            <option value="">All Districts</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

export function HelpPage({ onRestartTour }: { onRestartTour: () => void }) {
  const sections = [
    { title: 'Getting Started', content: 'Log in with your assigned role. Use the Dashboard for daily overview. District Officers see their district only.' },
    { title: 'Penalties', content: 'Interest accrues at 2% per month under the Local Governments Rating Act 2005. Use the Penalty Calculator for projections.' },
    { title: 'Notices', content: 'Issue Demand Notices from the Demand Notices page. Mark as Issued after serving for compliance records.' },
    { title: 'Tax Clearance', content: 'Properties with arrears are BLOCKED from sale. Issue clearance certificates only after full payment.' },
    { title: 'Enforcement Stages', content: 'Stage 1: Interest Accruing → Stage 2: Demand Notice → Stage 3: Rent Interception → Stage 4: Legal Action → Stage 5: Resolved.' },
    { title: 'FAQ', content: 'Contact your Super Administrator for role changes. Use Demo Mode for training. Configure authority details in Settings.' },
  ];
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Help</h1><button onClick={onRestartTour} className="bg-[#C8102E] text-white px-4 py-2 rounded">Restart Tour</button></div>
      {sections.map((s) => (
        <div key={s.title} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"><h3 className="font-semibold text-[#C8102E] mb-2">{s.title}</h3><p className="text-sm text-gray-600 dark:text-gray-400">{s.content}</p></div>
      ))}
    </div>
  );
}

export function RentInterceptionModal({ property, settings, onClose, onServed, showToast }: {
  property: Property; settings: PlatformSettings; onClose: () => void; onServed: () => void; showToast: (m: string) => void;
}) {
  const pen = calculatePenalty(property.annualTaxDue, property.taxDueDate);
  const ref = `RIN-${Date.now()}`;
  const today = formatDate(new Date(), 'MMMM d, yyyy');
  const startDate = formatDate(new Date(Date.now() + 86400000 * 3), 'MMMM d, yyyy');
  const authority = settings.authorityName || 'Configure authority details in Settings page first';
  const text = `RENT INTERCEPTION NOTICE\nReference: ${ref} | Date: ${today}\n${UGANDA_COAT_OF_ARMS_TEXT}\n${authority}\n\nTo: ${property.tenantName || 'Tenant'} | Re: Property ${property.plotNumber}, ${property.district}\nOwned by: ${property.ownerName}\n\nUnder Local Governments Rating Act 2005, ${formatCurrency(pen.totalOwed)} is due.\nFrom ${startDate} ALL rent must be paid to:\n${property.district} Revenue Office | Account: ${settings.bankAccountDetails || '________________'}\nUntil ${formatCurrency(pen.totalOwed)} + ${formatCurrency(pen.dailyInterest)}/day is recovered.\n\nSigned: _____________ Date: _____________\n${settings.officialStampText || ''}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between mb-4"><h2 className="font-bold text-lg text-gray-900 dark:text-white">RENT INTERCEPTION NOTICE</h2><button onClick={onClose} className="text-gray-700 dark:text-gray-300"><X size={20} /></button></div>
        <UgandaCoatOfArms size={72} className="mx-auto mb-4" />
        <pre className="text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded mb-4">{text}</pre>
        <div className="flex gap-3">
          <button onClick={() => { downloadTextFile(`rent_interception_${property.plotNumber}.txt`, text); showToast('Downloaded'); }} className="flex-1 bg-gray-800 text-white py-2 rounded flex items-center justify-center gap-2"><Download size={16} /> Download</button>
          <button onClick={() => { onServed(); showToast('Marked as served'); onClose(); }} className="flex-1 bg-[#C8102E] text-white py-2 rounded flex items-center justify-center gap-2"><Check size={16} /> Mark as Served</button>
        </div>
      </div>
    </div>
  );
}

export function getNextAction(stage: string, daysOverdue: number): string {
  if (stage === 'resolved') return 'Complete';
  if (stage === 'interest_accruing') return daysOverdue >= 30 ? 'Send reminder' : 'Monitor';
  if (stage === 'demand_notice') return 'Issue notice';
  if (stage === 'rent_interception') return 'Serve tenant notice';
  if (stage === 'legal_action') return 'Update court case';
  return 'Review';
}
