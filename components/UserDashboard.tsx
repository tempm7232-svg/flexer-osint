import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { UserProfile, OSINTTool, ADMIN_TELEGRAM } from '../types';
import { analyzeOSINTResult } from '../services/geminiService';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface UserDashboardProps {
  profile: UserProfile;
  onLogout: () => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ profile, onLogout }) => {
  const [tools, setTools] = useState<OSINTTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<OSINTTool | null>(null);
  const [lookupValue, setLookupValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [error, setError] = useState('');
  const [resultTab, setResultTab] = useState<'raw' | 'analysis'>('raw');

  // Password Change State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!profile.isApproved) return;
    const unsubscribe = onSnapshot(collection(db, 'tools'), 
      (snapshot) => setTools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OSINTTool))),
      () => setError("Database access restricted.")
    );
    return () => unsubscribe();
  }, [profile.isApproved]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTool) return;

    setLoading(true);
    setResult(null);
    setAiAnalysis('');
    setError('');

    try {
      let finalUrl = selectedTool.apiUrl.replace('{query}', encodeURIComponent(lookupValue));
      if (selectedTool.useProxy) {
        finalUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(finalUrl)}`;
      }
      const response = await fetch(finalUrl);
      if (!response.ok) throw new Error(`Fetch Error: ${response.status}`);
      let data = await response.json();
      if (selectedTool.useProxy && data.contents) {
        try {
          data = JSON.parse(data.contents);
        } catch {
          data = data.contents;
        }
      }
      setResult(data);
      setResultTab('raw');
      const analysis = await analyzeOSINTResult(data);
      setAiAnalysis(analysis);
    } catch (err: any) {
      setError(`Execution failure: ${err.message}.`);
    } finally {
      setLoading(false);
    }
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
      const user = auth.currentUser;
      if (user) {
        await updatePassword(user, newPassword);
        alert("Password updated successfully.");
        setIsPasswordModalOpen(false);
        setNewPassword('');
      }
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password. You may need to logout and log back in to perform this action.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const copyToClipboard = () => {
    const text = resultTab === 'raw' ? JSON.stringify(result, null, 2) : aiAnalysis;
    navigator.clipboard.writeText(text);
    alert("Data copied to clipboard.");
  };

  if (!profile.isApproved) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-[#111] p-6 md:p-10 rounded-3xl border border-gray-800 shadow-2xl text-center">
          <i className="fas fa-user-clock text-4xl text-yellow-500 mb-6"></i>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 uppercase tracking-tighter">Authorization Required</h2>
          <p className="text-gray-400 text-sm md:text-lg mb-8 leading-relaxed">Administrator approval required to access OSINT reconnaissance modules.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={`https://t.me/${ADMIN_TELEGRAM}`} target="_blank" rel="noopener noreferrer" className="bg-[#24A1DE] hover:bg-[#1f8aba] text-white font-bold py-3 px-8 rounded-xl flex items-center justify-center transition uppercase tracking-widest text-xs"><i className="fab fa-telegram-plane mr-2 text-xl"></i> Contact Admin</a>
            <button onClick={onLogout} className="bg-transparent border border-gray-700 hover:bg-gray-800 text-gray-300 font-bold py-3 px-8 rounded-xl transition uppercase tracking-widest text-xs">Sign Out</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <nav className="border-b border-gray-800 bg-[#111]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fas fa-satellite-dish text-blue-500 text-xl"></i>
            <span className="font-bold text-lg md:text-xl tracking-tighter text-white">FLEXER <span className="text-blue-500">INTEL</span></span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsPasswordModalOpen(true)} className="p-3 text-gray-500 hover:text-blue-500 transition" title="Change Password"><i className="fas fa-key"></i></button>
            <button onClick={onLogout} className="text-gray-500 hover:text-white transition p-2"><i className="fas fa-power-off"></i></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!selectedTool ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2 uppercase tracking-tighter">Command Hub</h1>
              <p className="text-gray-500 text-sm">Select reconnaissance module to begin tracking.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.map(tool => (
                <button key={tool.id} onClick={() => setSelectedTool(tool)} className="group relative bg-[#111] border border-gray-800 rounded-3xl p-6 md:p-8 text-left hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-300 flex flex-col h-full">
                  <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-600/30 group-hover:scale-110 transition flex-shrink-0"><i className={`${tool.icon || 'fas fa-search'} text-2xl text-blue-500`}></i></div>
                  <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">{tool.name}</h3>
                  <div className="text-gray-500 text-sm leading-relaxed mb-6 flex-grow line-clamp-2 overflow-hidden" dangerouslySetInnerHTML={{ __html: tool.description }}></div>
                  <div className="mt-auto inline-flex items-center gap-2 text-blue-500 text-xs font-bold uppercase tracking-widest">Deploy Module <i className="fas fa-arrow-right text-[10px] group-hover:translate-x-1 transition"></i></div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3 space-y-4">
              <button onClick={() => { setSelectedTool(null); setResult(null); }} className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-gray-400 hover:text-white flex items-center justify-center gap-3 transition"><i className="fas fa-chevron-left text-xs"></i><span className="font-bold text-sm uppercase">Return to Hub</span></button>
              <div className="bg-[#111] border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6"><i className={`${selectedTool.icon} text-blue-500`}></i><h3 className="font-bold text-white uppercase tracking-tighter">{selectedTool.name}</h3></div>
                <form onSubmit={handleLookup} className="space-y-4">
                  <input type="text" required className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg py-3 px-4 text-white focus:border-blue-500 transition outline-none text-sm" placeholder="Target Identifier..." value={lookupValue} onChange={e => setLookupValue(e.target.value)}/>
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-xs">
                    {loading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Execute Scan'}
                  </button>
                </form>
                {selectedTool.description && (
                   <div className="mt-6 pt-6 border-t border-gray-800">
                     <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3">Protocol Brief</p>
                     <div className="text-[11px] text-gray-500 leading-relaxed" dangerouslySetInnerHTML={{ __html: selectedTool.description }}></div>
                   </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-9 space-y-6 min-h-[500px]">
              {error && <div className="p-5 bg-red-900/10 border border-red-500/30 rounded-2xl text-red-400 flex items-start gap-4 animate-in slide-in-from-top-2"><i className="fas fa-exclamation-circle mt-1"></i><div><div className="font-bold text-sm">Scan Halted</div><div className="text-xs opacity-80">{error}</div></div></div>}

              {result ? (
                <div className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in duration-500">
                  <div className="bg-[#1a1a1a] px-4 md:px-6 pt-6 border-b border-gray-800">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Intelligence Stream Secure</span>
                      </div>
                      <button onClick={copyToClipboard} className="text-[10px] font-bold text-blue-500 hover:text-blue-400 flex items-center gap-2 uppercase transition border border-blue-500/20 px-3 py-1.5 rounded-lg bg-blue-500/5">
                        <i className="fas fa-copy"></i> Export Intelligence
                      </button>
                    </div>
                    <div className="flex gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
                      <button onClick={() => setResultTab('raw')} className={`pb-4 px-2 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${resultTab === 'raw' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-white'}`}>Raw Feed</button>
                      <button onClick={() => setResultTab('analysis')} className={`pb-4 px-2 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${resultTab === 'analysis' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-white'}`}>AI Synthesis</button>
                    </div>
                  </div>

                  <div className="p-0 bg-[#0a0a0a] min-h-[400px] overflow-hidden">
                    {resultTab === 'raw' ? (
                      <div className="h-full max-h-[600px] overflow-auto scrollbar-thin scrollbar-thumb-gray-800">
                        <SyntaxHighlighter 
                          language="json" 
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            padding: '1rem md:padding-1.5rem',
                            fontSize: '0.7rem md:fontSize-0.75rem',
                            lineHeight: '1.5',
                            backgroundColor: '#0a0a0a',
                            borderRadius: '0'
                          }}
                          codeTagProps={{
                            style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }
                          }}
                        >
                          {JSON.stringify(result, null, 2)}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <div className="p-6 md:p-8 text-gray-300 leading-relaxed text-xs md:text-sm whitespace-pre-wrap font-medium animate-in fade-in duration-700">
                        {aiAnalysis || (
                          <div className="flex flex-col items-center justify-center py-20 opacity-40">
                            <i className="fas fa-brain text-4xl mb-4 animate-pulse text-blue-500"></i>
                            <p className="uppercase tracking-widest text-[10px] font-bold">Generating Intelligence Analysis...</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : !loading && (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-6 bg-[#111] border border-gray-800 border-dashed rounded-3xl opacity-30">
                  <i className="fas fa-radar text-5xl mb-6 text-gray-700"></i>
                  <h3 className="text-xl font-bold text-gray-500 mb-2 uppercase tracking-widest">System Standby</h3>
                  <p className="text-gray-600 text-xs max-w-sm">Target acquisition ready. Enter parameters to begin reconnaissance.</p>
                </div>
              )}
              {loading && <div className="space-y-6"><div className="h-20 bg-blue-900/5 rounded-2xl border border-blue-900/10 animate-pulse"></div><div className="h-96 bg-gray-800/5 rounded-2xl border border-gray-800/10 animate-pulse"></div></div>}
            </div>
          </div>
        )}
      </main>

      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <div className="bg-[#111] border border-gray-800 w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-tighter flex items-center gap-3">
              <i className="fas fa-lock text-blue-500"></i> Change Password
            </h3>
            {passwordError && <div className="p-4 mb-4 bg-red-900/10 border border-red-500/30 text-red-400 text-xs rounded-xl">{passwordError}</div>}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">New Secret Key</label>
                <input type="password" required className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none transition" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 6 characters"/>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="submit" disabled={passwordLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50 text-xs uppercase">
                  {passwordLoading ? 'UPDATING...' : 'UPDATE KEY'}
                </button>
                <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="flex-1 bg-transparent border border-gray-800 text-gray-500 hover:text-white font-bold py-3 rounded-xl transition text-xs uppercase">CANCEL</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;