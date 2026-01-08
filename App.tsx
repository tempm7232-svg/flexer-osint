import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, ROOT_OWNER_EMAIL } from './types';
import Login from './components/Login';
import Register from './components/Register';
import UserDashboard from './components/UserDashboard';
import AdminPanel from './components/AdminPanel';
import { v4 as uuidv4 } from 'uuid';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'login' | 'register'>('login');
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const getLocalSessionId = useCallback(() => {
    let sid = localStorage.getItem('flexer_sid');
    if (!sid) {
      sid = uuidv4();
      localStorage.setItem('flexer_sid', sid);
    }
    return sid;
  }, []);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setPermissionError(null);

      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const currentSid = getLocalSessionId();

        try {
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            const isOwner = firebaseUser.email === ROOT_OWNER_EMAIL;
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              isAdmin: isOwner, 
              isOwner: isOwner,
              isApproved: isOwner,
              lastSessionId: currentSid,
              pendingSessionId: null
            };
            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          } else {
            const existingProfile = userDoc.data() as UserProfile;
            
            // Session logic: If session is different, request approval instead of forcing conflict
            if (existingProfile.lastSessionId !== currentSid) {
              await updateDoc(userDocRef, { 
                pendingSessionId: currentSid,
                pendingSessionMetadata: {
                  deviceName: navigator.userAgent.split(') ')[0].split('(')[1] || 'Unknown Device',
                  timestamp: Date.now()
                }
              });
            }
          }

          unsubscribeProfile = onSnapshot(userDocRef, (snapshot) => {
            if (snapshot.exists()) {
              setProfile(snapshot.data() as UserProfile);
            }
          }, (error) => {
            if (error.code === 'permission-denied') {
              setPermissionError("Security system blocked real-time sync. Check Firestore Rules.");
            }
          });

          setUser(firebaseUser);
        } catch (err: any) {
          console.error("Auth Error:", err);
          setPermissionError(err.message);
        }
      } else {
        setUser(null);
        setProfile(null);
        if (unsubscribeProfile) unsubscribeProfile();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [getLocalSessionId]);

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem('flexer_sid');
  };

  const approvePendingSession = async () => {
    if (!profile || !profile.pendingSessionId) return;
    await updateDoc(doc(db, 'users', profile.uid), {
      lastSessionId: profile.pendingSessionId,
      pendingSessionId: null,
      pendingSessionMetadata: null
    });
  };

  const denyPendingSession = async () => {
    if (!profile) return;
    await updateDoc(doc(db, 'users', profile.uid), {
      pendingSessionId: null,
      pendingSessionMetadata: null
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 bg-blue-500 rounded-full animate-ping"></div>
          </div>
        </div>
      </div>
    );
  }

  if (permissionError) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#111] p-8 rounded-2xl border border-red-900/30 text-center">
          <i className="fas fa-shield-virus text-4xl text-red-500 mb-4"></i>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 text-sm mb-6">{permissionError}</p>
          <button onClick={() => window.location.reload()} className="w-full bg-blue-600 py-3 rounded-xl font-bold">RETRY</button>
        </div>
      </div>
    );
  }

  if (!user) {
    return view === 'login' ? <Login onSwitch={() => setView('register')} /> : <Register onSwitch={() => setView('login')} />;
  }

  if (!profile) return null;

  const currentSid = getLocalSessionId();

  // SCENARIO 1: This is the NEW device waiting for approval
  if (profile.pendingSessionId === currentSid) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#111] p-8 rounded-3xl border border-gray-800 text-center shadow-2xl">
          <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
            <i className="fas fa-mobile-screen text-3xl text-blue-500 animate-pulse"></i>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Awaiting Verification</h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Your login request has been sent. Please open Flexer on your <span className="text-white font-bold underline">authorized device</span> to approve this session.
          </p>
          <div className="space-y-4">
            <div className="p-4 bg-blue-900/5 rounded-2xl border border-blue-500/10 text-xs text-blue-400 text-left">
              <div className="flex justify-between mb-1 uppercase tracking-widest font-bold"><span>Status</span> <span>Pending...</span></div>
              <div className="opacity-60 italic">If you no longer have access to your previous device, please contact an Admin to manually authorize this session.</div>
            </div>
            <button onClick={handleLogout} className="w-full bg-transparent border border-gray-800 py-3 rounded-xl text-gray-500 font-bold hover:bg-gray-800 transition">CANCEL REQUEST</button>
          </div>
        </div>
      </div>
    );
  }

  // SCENARIO 2: This is the AUTHORIZED device seeing a pending request
  if (profile.pendingSessionId && profile.lastSessionId === currentSid) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] relative">
        <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#111] border border-blue-500/30 rounded-3xl p-8 shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] animate-in zoom-in-95">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/20 rounded-2xl"><i className="fas fa-shield-alt text-xl text-blue-500"></i></div>
              <div>
                <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Security Alert</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">New Device Recognition</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              A login attempt was detected on <span className="text-white font-bold">{profile.pendingSessionMetadata?.deviceName}</span>. 
              Do you authorize this device to take over your secure session?
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={approvePendingSession} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition shadow-lg shadow-blue-900/20">AUTHORIZE</button>
              <button onClick={denyPendingSession} className="bg-red-900/20 border border-red-500/30 text-red-500 font-bold py-4 rounded-2xl hover:bg-red-900/40 transition">DENY</button>
            </div>
          </div>
        </div>
        {profile.isAdmin ? <AdminPanel profile={profile} onLogout={handleLogout} /> : <UserDashboard profile={profile} onLogout={handleLogout} />}
      </div>
    );
  }

  // SCENARIO 3: Normal authenticated state
  if (profile.isAdmin) {
    return <AdminPanel profile={profile} onLogout={handleLogout} />;
  }

  return <UserDashboard profile={profile} onLogout={handleLogout} />;
};

export default App;