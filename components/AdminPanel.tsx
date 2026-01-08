import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { UserProfile, OSINTTool, SessionMetadata } from '../types';
import ReactQuill from 'react-quill';

interface AdminPanelProps {
  profile: UserProfile;
  onLogout: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ profile, onLogout }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tools, setTools] = useState<OSINTTool[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'tools' | 'security' | 'devices'>('users');
  const [error, setError] = useState<string | null>(null);
  
  const [editingTool, setEditingTool] = useState<Partial<OSINTTool> | null>(null);
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), 
      (snapshot) => setUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile))),
      () => setError("Access restricted.")
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

  const handleRevokeDevice = async (sid: string) => {
    if (confirm("Revoke this device session?")) {
      const updatedSessions = profile.authorizedSessions?.filter(s => s.sid !== sid) || [];
      await updateDoc(doc(db, 'users', profile.uid), {
        authorizedSessions: updatedSessions
      });
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.isOwner) return;
    if (confirm(`Expunge operative ${user.email}? This cannot be undone.`)) {
      await deleteDoc(doc(db, 'users', user.uid));
    }
  };

  const handleDeleteTool = async (toolId: string, toolName: string) => {
    if (window.confirm(`SECURITY ALERT: Are you sure you want to permanently delete the module "${toolName}"? This action will remove all associated reconnaissance capabilities.`)) {
      try {
        await deleteDoc(doc(db, 'tools', toolId));
      } catch (err) {
        alert("Failed to delete module. Check security clearance.");
      }
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    setPasswordLoading(true);
    setPasswordError('');
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        alert("Password updated successfully.");
        setIsPasswordModalOpen(false);
        setNewPassword('');
      }
    } catch (err: any) {
      setPasswordError(err.message || "Update failed. You may need to log in again to verify identity.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const securityRequests = users.filter(u => u.pendingSessionId);
  const currentSid = localStorage.getItem('flexer_sid');

  const quillModules = {
    toolbar: [[{ header: [1, 2, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']]
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-[#111] border-b border-gray-800 p-4 md:p-6 flex flex-col md:flex-row justify-between items-center sticky top-0 z-50 gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-xl md:text-2xl font-bold flex items-center justify-center md:justify-start gap-3 text-white">
            <i className={`fas ${profile.isOwner ? 'fa-crown text-yellow-500' : 'fa-user-shield text-blue-500'}`}></i>
            {profile.isOwner ? 'Command HQ' : 'Control Center'}
          </h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold">Level: {profile.isOwner ? 'Root' : 'Admin'}</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex bg-[#0a0a0a] p-1 rounded-xl border border-gray-800 overflow-x-auto whitespace-nowrap scrollbar-hide flex-grow md:flex-grow-0">
            {['users', 'tools', 'security', 'devices'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-3 md:px-4 py-2 rounded-lg text-[10px] md:text-xs font-bold transition flex-shrink-0 ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>
                {tab.toUpperCase()}
                {tab === 'security' && securityRequests.length > 0 && <span className="ml-2 w-1.5 h-1.5 bg-red-500 rounded-full inline-block animate-pulse"></span>}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <button onClick={() => setIsPasswordModalOpen(true)} className="p-2 text-gray-500 hover:text-blue-500" title="Change Password"><i className="fas fa-key"></i></button>
            <button onClick={onLogout} className="p-2 text-gray-500 hover:text-red-500" title="Logout"><i className="fas fa-power-off"></i></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {activeTab === 'users' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Operative Registry</h2>
            <div className="hidden md:block bg-[#111] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-[#1a1a1a] text-gray-500 text-[10px] uppercase font-bold tracking-[0.2em] border-b border-gray-800">
                  <tr><th className="p-6">Entity</th><th className="p-6">Class</th><th className="p-6">Status</th><th className="p-6 text-right">Controls</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {users.map(u => (
                    <tr key={u.uid} className="hover:bg-gray-800/10 group transition">
                      <td className="p-6">
                        <div className="text-sm text-white font-bold truncate max-w-[200px]">{u.email}</div>
                        <div className="text-[9px] text-gray-600 font-mono">{u.uid}</div>
                      </td>
                      <td className="p-6"><button onClick={() => handleToggleAdmin(u)} disabled={!profile.isOwner || u.isOwner} className={`text-[10px] font-bold px-2 py-1 rounded border ${u.isAdmin ? 'border-blue-500 text-blue-500 bg-blue-500/5' : 'border-gray-700 text-gray-600'}`}>{u.isAdmin ? 'ADMIN' : 'USER'}</button></td>
                      <td className="p-6"><span className={u.isApproved ? 'text-green-500 text-[10px] font-bold' : 'text-yellow-500 text-[10px] font-bold'}>{u.isApproved ? 'VERIFIED' : 'AWAITING'}</span></td>
                      <td className="p-6 text-right space-x-2">
                        {!u.isOwner && <><button onClick={() => handleToggleApproval(u.uid, u.isApproved)} className={`px-4 py-2 rounded-xl text-xs font-bold ${u.isApproved ? 'bg-red-900/10 text-red-500' : 'bg-green-600 text-white'}`}>{u.isApproved ? 'REVOKE' : 'APPROVE'}</button><button onClick={() => handleDeleteUser(u)} className="p-2 text-gray-700 hover:text-red-500"><i className="fas fa-trash-alt"></i></button></>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden grid grid-cols-1 gap-4">
              {users.map(u => (
                <div key={u.uid} className="bg-[#111] border border-gray-800 rounded-xl p-4 shadow-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-white text-xs truncate max-w-[150px]">{u.email}</div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${u.isAdmin ? 'border-blue-500 text-blue-500' : 'border-gray-700 text-gray-600'}`}>{u.isAdmin ? 'ADMIN' : 'USER'}</span>
                    </div>
                  </div>
                  {!u.isOwner && (
                    <div className="flex gap-2 pt-2 border-t border-gray-800/50">
                      <button onClick={() => handleToggleApproval(u.uid, u.isApproved)} className={`flex-1 py-2 rounded-lg text-[10px] font-bold ${u.isApproved ? 'bg-red-900/10 text-red-500' : 'bg-green-600 text-white'}`}>{u.isApproved ? 'REVOKE' : 'APPROVE'}</button>
                      <button onClick={() => handleDeleteUser(u)} className="px-3 bg-gray-800 text-gray-400 rounded-lg flex items-center justify-center"><i className="fas fa-trash-alt"></i></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold text-white uppercase tracking-tighter">Modules</h2><button onClick={() => { setEditingTool({}); setIsToolModalOpen(true); }} className="bg-blue-600 px-6 py-2 rounded-xl font-bold text-xs"><i className="fas fa-plus mr-2"></i>ADD CAPABILITY</button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.map(tool => (
                <div key={tool.id} className="bg-[#111] border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col hover:border-blue-500/30 transition h-full group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-600/10 rounded-xl border border-blue-600/30 text-blue-500"><i className={tool.icon || 'fas fa-search'}></i></div>
                    <div className="flex gap-2 text-gray-600 group-hover:text-gray-400">
                      <button onClick={() => { setEditingTool(tool); setIsToolModalOpen(true); }} className="hover:text-white p-2"><i className="fas fa-edit"></i></button>
                      <button onClick={() => handleDeleteTool(tool.id, tool.name)} className="hover:text-red-500 p-2"><i className="fas fa-trash"></i></button>
                    </div>
                  </div>
                  <h3 className="font-bold text-white mb-2">{tool.name}</h3>
                  <div className="text-gray-400 text-xs flex-grow overflow-hidden line-clamp-3" dangerouslySetInnerHTML={{ __html: tool.description }}></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Signals</h2>
            {securityRequests.length === 0 ? <p className="text-gray-600 text-center py-20 uppercase text-xs font-bold">No Pending Requests</p> : (
              <div className="grid gap-4">
                {securityRequests.map(u => (
                  <div key={u.uid} className="bg-[#111] border border-blue-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div><div className="font-bold text-white">{u.email}</div><div className="text-[10px] text-gray-500">Requested from: {u.pendingSessionMetadata?.deviceName}</div></div>
                    <button onClick={() => handleAuthorizeSession(u)} className="w-full sm:w-auto bg-blue-600 px-6 py-3 rounded-xl text-xs font-bold text-white">GRANT ACCESS</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white uppercase tracking-tighter">My Registry</h2>
            <p className="text-gray-500 text-sm">Admins are allowed multiple concurrent sessions. Manage your verified terminals below.</p>
            <div className="grid gap-4">
              {profile.authorizedSessions?.map(s => (
                <div key={s.sid} className={`bg-[#111] border ${s.sid === currentSid ? 'border-blue-500/50' : 'border-gray-800'} rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <i className={`fas ${s.deviceName.toLowerCase().includes('mobile') ? 'fa-mobile-alt' : 'fa-laptop'} text-xs text-gray-500`}></i>
                      {s.deviceName} {s.sid === currentSid && <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded ml-2 uppercase">Current</span>}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Authorized: {new Date(s.timestamp).toLocaleString()}</div>
                  </div>
                  {s.sid !== currentSid && <button onClick={() => handleRevokeDevice(s.sid)} className="w-full sm:w-auto text-red-500 text-xs font-bold uppercase tracking-widest border border-red-900/20 px-4 py-2 rounded-lg hover:bg-red-900/10">Revoke Access</button>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Tool Modal */}
      {isToolModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <div className="bg-[#111] border border-gray-800 w-full max-w-2xl rounded-3xl p-6 md:p-8 flex flex-col max-h-[95vh] animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-tight">Configuration Module</h3>
            <div className="space-y-4 overflow-y-auto pr-2 flex-grow">
              <input type="text" className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none" placeholder="Module Name" value={editingTool?.name || ''} onChange={e => setEditingTool({...editingTool, name: e.target.value})}/>
              <input type="text" className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-3 text-white font-mono text-sm focus:border-blue-500 outline-none" placeholder="API Endpoint (https://.../{query})" value={editingTool?.apiUrl || ''} onChange={e => setEditingTool({...editingTool, apiUrl: e.target.value})}/>
              <div className="min-h-[250px]"><ReactQuill theme="snow" value={editingTool?.description || ''} onChange={val => setEditingTool({...editingTool, description: val})} modules={quillModules} className="h-[200px] mb-12"/></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mt-6 pt-6 border-t border-gray-800">
              <button onClick={handleSaveTool} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20">SAVE CHANGES</button>
              <button onClick={() => setIsToolModalOpen(false)} className="flex-1 bg-gray-800 text-gray-400 py-4 rounded-xl font-bold text-xs uppercase tracking-widest">CLOSE</button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <div className="bg-[#111] border border-gray-800 w-full max-w-md rounded-2xl p-8 animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-white mb-6 uppercase flex items-center gap-3"><i className="fas fa-key text-blue-500"></i> Change Secret Key</h3>
            {passwordError && <div className="p-3 mb-4 bg-red-900/10 border border-red-500/20 text-red-400 text-xs rounded-xl">{passwordError}</div>}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input type="password" required className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New Access Password (min 6)"/>
              <div className="flex gap-4 pt-4">
                <button type="submit" disabled={passwordLoading} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl transition disabled:opacity-50 text-xs uppercase tracking-widest">
                  {passwordLoading ? 'UPDATING...' : 'UPDATE KEY'}
                </button>
                <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="flex-1 bg-gray-800 text-gray-500 font-bold py-3 rounded-xl transition text-xs uppercase tracking-widest">CANCEL</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;