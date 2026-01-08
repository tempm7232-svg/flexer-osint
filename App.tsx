import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, ROOT_OWNER_EMAIL, SessionMetadata } from './types';
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
  const [isAdminView, setIsAdminView] = useState(true);

  const getLocalSessionId = useCallback(() => {
    let sid = localStorage.getItem('flexer_sid');
    if (!sid) {
      sid = uuidv4();
      localStorage.setItem('flexer_sid', sid);
    }
    return sid;
  }, []);

  const getDeviceName = () => {
    return navigator.userAgent.split(') ')[0].split('(')[1] || 'Unknown Device';
  };

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
            const session: SessionMetadata = {
              sid: currentSid,
              deviceName: getDeviceName(),
              timestamp: Date.now()
            };
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              isAdmin: isOwner, 
              isOwner: isOwner,
              isApproved: isOwner,
              lastSessionId: currentSid,
              authorizedSessions: isOwner ? [session] : [],
              pendingSessionId: null
            };
            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          } else {
            const existingProfile = userDoc.data() as UserProfile;
            const isPrivileged = existingProfile.isAdmin || existingProfile.isOwner;

            if (isPrivileged) {
              const isAlreadyAuthorized = existingProfile.authorizedSessions?.some(s => s.sid === currentSid);
              if (!isAlreadyAuthorized) {
                const newSession: SessionMetadata = {
                  sid: currentSid,
                  deviceName: getDeviceName(),
                  timestamp: Date.now()
                };
                await updateDoc(userDocRef, {
                  authorizedSessions: arrayUnion(newSession)
                });
              }
            } else if (existingProfile.lastSessionId !== currentSid) {
              await updateDoc(userDocRef, { 
                pendingSessionId: currentSid,
                pendingSessionMetadata: {
                  sid: currentSid,
                  deviceName: getDeviceName(),
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
              setPermissionError("Security system blocked real-time sync.");
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
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

  if (!user || !profile) {
    return view === 'login' ? <Login onSwitch={() => setView('register')} /> : <Register onSwitch={() => setView('login')} />;
  }

  const currentSid = getLocalSessionId();
  const isPrivileged = profile.isAdmin || profile.isOwner;

  const isStale = !isPrivileged 
    ? (profile.lastSessionId !== currentSid && profile.pendingSessionId !== currentSid)
    : !profile.authorizedSessions?.some(s => s.sid === currentSid);

  if (isStale) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 text-center animate-in fade-in duration-500">
        <div className="max-w-md bg-[#111] p-10 rounded-3xl border border-red-500/20 shadow-2xl">
          <i className="fas fa-ghost text-5xl text-red-500 mb-6 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]"></i>
          <h2 className="text-2xl font-bold text-white mb-4 uppercase tracking-tighter">Session Overwritten</h2>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            This account is now active on another device. Only one concurrent session is permitted for standard accounts.
          </p>
          <button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-red-900/20">RE-AUTHENTICATE</button>
        </div>
      </div>
    );
  }

  if (!isPrivileged) {
    if (profile.pendingSessionId === currentSid) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#111] p-8 rounded-3xl border border-gray-800 text-center shadow-2xl">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
              <i className="fas fa-mobile-screen text-3xl text-blue-500 animate-pulse"></i>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Awaiting Verification</h2>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              Open Flexer on your authorized device to approve this switch.
            </p>
            <button onClick={handleLogout} className="w-full bg-transparent border border-gray-800 py-3 rounded-xl text-gray-500 font-bold hover:bg-gray-800 transition">CANCEL</button>
          </div>
        </div>
      );
    }

    if (profile.pendingSessionId && profile.lastSessionId === currentSid) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] relative">
          <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-[#111] border border-blue-500/30 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <i className="fas fa-shield-alt text-blue-500"></i> Security Alert
              </h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                Another device ({profile.pendingSessionMetadata?.deviceName}) is requesting access. Authorizing this will end your current session.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={approvePendingSession} className="bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold transition shadow-lg">AUTHORIZE</button>
                <button onClick={denyPendingSession} className="bg-red-900/20 border border-red-500/30 text-red-500 py-4 rounded-2xl font-bold transition">DENY</button>
              </div>
            </div>
          </div>
          <UserDashboard profile={profile} onLogout={handleLogout} />
        </div>
      );
    }
  }

  if (profile.isAdmin && isAdminView) {
    return <AdminPanel profile={profile} onLogout={handleLogout} onViewLive={() => setIsAdminView(false)} />;
  }

  return <UserDashboard profile={profile} onLogout={handleLogout} onToggleAdmin={() => setIsAdminView(true)} />;
};

export default App;