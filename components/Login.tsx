import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

interface LoginProps {
  onSwitch: () => void;
}

const Login: React.FC<LoginProps> = ({ onSwitch }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Auth Failure:", err.code, err.message);
      
      if (err.code === 'auth/invalid-credential') {
        setError("Invalid credentials. If you are sure they are correct, please verify that your current URL domain is listed in 'Authorized Domains' under Firebase Console > Authentication > Settings.");
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError("The email or password you entered is incorrect.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Too many failed attempts. Please wait before trying again.");
      } else {
        setError(err.message || "An authentication error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#111] p-8 rounded-2xl shadow-2xl border border-gray-800">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600/10 mb-4 border border-blue-600/30">
            <i className="fas fa-fingerprint text-2xl text-blue-500"></i>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Flexer OSINT</h1>
          <p className="text-gray-400 mt-2">Login to Secure Interface</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start gap-3">
            <i className="fas fa-triangle-exclamation mt-1"></i>
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Email Address</label>
            <input
              type="email"
              required
              className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-all"
              placeholder="agent@flexer.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Access Key</label>
            <input
              type="password"
              required
              className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center shadow-lg shadow-blue-900/20 active:scale-[0.98]"
          >
            {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'INITIALIZE SESSION'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800 text-center">
          <p className="text-gray-500 text-sm">
            Unregistered?{' '}
            <button onClick={onSwitch} className="text-blue-500 hover:text-blue-400 font-bold transition-colors">
              Create Credentials
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;