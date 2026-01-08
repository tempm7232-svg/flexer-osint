import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, OSINTTool } from '../types';

interface AdminPanelProps {
  profile: UserProfile;
  onLogout: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ profile, onLogout }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tools, setTools] = useState<OSINTTool[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'tools' | 'security'>('users');
  const [error, setError] = useState<string | null>(null);
  
  const [editingTool, setEditingTool] = useState<Partial<OSINTTool> | null>(null);
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), 
      (snapshot) => setUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile))),
      () => setError("Admin Sync Error: Access restricted.")
    );

    const unsubTools = onSnapshot(collection(db, 'tools'), 
      (snapshot) => setTools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OSINTTool))),
      () => setError("Tools access restricted.")
    );

    return () => { unsubUsers(); unsubTools(); };
  }, []);

  const handleToggleApproval = async (uid: string, currentStatus: boolean) => {
    await updateDoc(doc(db, 'users', uid), { isApproved: !currentStatus });
  };

  const handleToggleAdmin = async (targetUser: UserProfile) => {
    if (!profile.isOwner) {
      alert("Only the Root Owner can manage Admin roles.");
      return;
    }
    if (targetUser.isOwner) return;
    await updateDoc(doc(db, 'users', targetUser.uid), { isAdmin: !targetUser.isAdmin });
  };

  const handleAuthorizeSession = async (user: UserProfile) => {
    if (!user.pendingSessionId) return;
    await updateDoc(doc(db, 'users', user.uid), {
      lastSessionId: user.pendingSessionId,
      pendingSessionId: null,
      pendingSessionMetadata: null
    });
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.isOwner) {
      alert("CRITICAL ERROR: Root Owner cannot be deleted.");
      return;
    }
    if (confirm(`Expunge operative ${user.email} from system?`)) {
      await deleteDoc(doc(db, 'users', user.uid));
    }
  };

  const handleSaveTool = async () => {
    if (!editingTool?.name || !editingTool?.apiUrl) return;
    const toolData = {
      name: editingTool.name,
      apiUrl: editingTool.apiUrl,
      description: editingTool.description || "",
      icon: editingTool.icon || "fas fa-search",
      useProxy: !!editingTool.useProxy
    };
    if (editingTool.id) await updateDoc(doc(db, 'tools', editingTool.id), toolData);
    else await addDoc(collection(db, 'tools'), toolData);
    setIsToolModalOpen(false);
  };

  const securityRequests = users.filter(u => u.pendingSessionId);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-[#111] border-b border-gray-800 p-6 flex justify-between items-center sticky top-0 z-50">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-white">
            <i className={`fas ${profile.isOwner ? 'fa-crown text-yellow-500' : 'fa-user-shield text-blue-500'}`}></i>
            {profile.isOwner ? 'Command HQ' : 'Control Center'}
          </h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mt-1 font-bold">System Level: {profile.isOwner ? 'Root' : 'Administrator'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#0a0a0a] p-1 rounded-xl border border-gray-800">
            <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>Operatives</button>
            <button onClick={() => setActiveTab('tools')} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'tools' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>Capabilities</button>
            <button onClick={() => setActiveTab('security')} className={`px-4 py-2 rounded-lg text-xs font-bold transition relative ${activeTab === 'security' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>
              Signals
              {securityRequests.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}
            </button>
          </div>
          <button onClick={onLogout} className="p-3 text-gray-500 hover:text-red-500 transition ml-4"><i className="fas fa-power-off"></i></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white uppercase tracking-tighter flex items-center gap-3">
              <i className="fas fa-broadcast-tower text-blue-500"></i>
              Session Authorization Requests
            </h2>
            {securityRequests.length === 0 ? (
              <div className="p-12 text-center bg-[#111] rounded-3xl border border-gray-800 opacity-40">
                <i className="fas fa-check-circle text-4xl mb-4"></i>
                <p className="uppercase tracking-widest text-xs font-bold">No Pending Signals</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {securityRequests.map(u => (
                  <div key={u.uid} className="bg-[#111] border border-blue-500/20 rounded-2xl p-6 flex items-center justify-between animate-in slide-in-from-right">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-500/10 rounded-xl"><i className="fas fa-mobile-alt text-blue-500"></i></div>
                      <div>
                        <div className="font-bold text-white">{u.email}</div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Device: {u.pendingSessionMetadata?.deviceName}</div>
                      </div>
                    </div>
                    <button onClick={() => handleAuthorizeSession(u)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-blue-900/20 uppercase tracking-widest">Grant Access</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-[#111] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#1a1a1a] text-gray-500 text-[10px] uppercase font-bold tracking-[0.2em] border-b border-gray-800">
                  <th className="p-6">Operative Entity</th>
                  <th className="p-6">Classification</th>
                  <th className="p-6">Status</th>
                  <th className="p-6 text-right">Access Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map(u => (
                  <tr key={u.uid} className="hover:bg-gray-800/10 transition group">
                    <td className="p-6">
                      <div className="font-bold text-white flex items-center gap-2">
                        {u.email}
                        {u.isOwner && <i className="fas fa-crown text-yellow-500 text-[10px]"></i>}
                      </div>
                      <div className="text-[10px] text-gray-600 font-mono mt-1">{u.uid}</div>
                    </td>
                    <td className="p-6">
                      <button 
                        onClick={() => handleToggleAdmin(u)}
                        disabled={!profile.isOwner || u.isOwner}
                        className={`text-[10px] font-bold px-2 py-1 rounded border transition ${u.isAdmin ? 'border-blue-500 text-blue-500 bg-blue-500/5' : 'border-gray-700 text-gray-600'} ${profile.isOwner && !u.isOwner ? 'hover:border-blue-400 hover:text-blue-400 cursor-pointer' : 'cursor-default'}`}
                      >
                        {u.isAdmin ? 'ADMINISTRATOR' : 'OPERATIVE'}
                      </button>
                    </td>
                    <td className="p-6">{u.isApproved ? <span className="text-green-500 text-[10px] font-black uppercase tracking-widest">Verified</span> : <span className="text-yellow-500 text-[10px] font-black uppercase tracking-widest">Awaiting</span>}</td>
                    <td className="p-6 text-right space-x-2">
                      {!u.isOwner && (
                        <>
                          <button onClick={() => handleToggleApproval(u.uid, u.isApproved)} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${u.isApproved ? 'bg-red-900/10 text-red-500 hover:bg-red-900/30' : 'bg-green-600 text-white hover:bg-green-700'}`}>{u.isApproved ? 'REVOKE' : 'APPROVE'}</button>
                          <button onClick={() => handleDeleteUser(u)} className="p-2 text-gray-700 hover:text-red-500 transition opacity-0 group-hover:opacity-100"><i className="fas fa-trash-alt"></i></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white uppercase tracking-tighter">OSINT Modules</h2>
              <button onClick={() => { setEditingTool({}); setIsToolModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition shadow-lg shadow-blue-900/20"><i className="fas fa-plus"></i> NEW TOOL</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.map(tool => (
                <div key={tool.id} className="bg-[#111] border border-gray-800 rounded-2xl p-6 shadow-xl relative group hover:border-blue-500/30 transition">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-600/10 rounded-xl border border-blue-600/30"><i className={`${tool.icon || 'fas fa-search'} text-blue-500`}></i></div>
                    <div className="flex gap-2 text-gray-700 group-hover:text-gray-400 transition">
                      <button onClick={() => { setEditingTool(tool); setIsToolModalOpen(true); }} className="hover:text-white"><i className="fas fa-edit"></i></button>
                      <button onClick={() => deleteDoc(doc(db, 'tools', tool.id))} className="hover:text-red-500"><i className="fas fa-trash"></i></button>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{tool.name}</h3>
                  <p className="text-gray-400 text-xs mb-4 line-clamp-2 leading-relaxed">{tool.description}</p>
                  {tool.useProxy && <span className="text-[9px] font-bold text-purple-400 bg-purple-900/10 px-2 py-0.5 rounded border border-purple-500/20 uppercase tracking-widest">Tunnel Enabled</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {isToolModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#111] border border-gray-800 w-full max-w-xl rounded-3xl shadow-[0_0_100px_-20px_rgba(59,130,246,0.2)] p-8">
            <h3 className="text-2xl font-bold text-white mb-8 uppercase tracking-tighter">Module Config</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">Module Identifier</label>
                <input type="text" className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none transition" value={editingTool?.name || ''} onChange={e => setEditingTool({...editingTool, name: e.target.value})}/>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">Protocol Endpoint (URI)</label>
                <input type="text" className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-3 text-white font-mono text-sm focus:border-blue-500 outline-none transition" value={editingTool?.apiUrl || ''} onChange={e => setEditingTool({...editingTool, apiUrl: e.target.value})}/>
              </div>
              <div className="flex items-center gap-4 p-4 bg-blue-900/5 rounded-2xl border border-blue-500/10">
                <input type="checkbox" id="proxy-check" checked={editingTool?.useProxy || false} onChange={e => setEditingTool({...editingTool, useProxy: e.target.checked})} className="w-5 h-5 accent-blue-600"/>
                <label htmlFor="proxy-check" className="text-xs text-gray-400 cursor-pointer">Enable Security Proxy (Bypass CORS / Hide Origin)</label>
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button onClick={handleSaveTool} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-blue-900/20 uppercase tracking-widest text-xs">Commit Changes</button>
              <button onClick={() => setIsToolModalOpen(false)} className="flex-1 bg-transparent border border-gray-800 text-gray-500 hover:text-white font-bold py-4 rounded-xl transition uppercase tracking-widest text-xs">Abort</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;