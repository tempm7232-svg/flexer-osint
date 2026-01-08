import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

interface RegisterProps {
  onSwitch: () => void;
}

const Register: React.FC<RegisterProps> = ({ onSwitch }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Firebase Registration Error:", err.code, err.message);
      
      if (err.code === 'auth/operation-not-allowed') {
        setError("Registration failed: 'Email/Password' login is disabled in your Firebase project. Please check Authentication > Sign-in method in the Firebase Console.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("This email address is already in use by another operative.");
      } else if (err.code === 'auth/weak-password') {
        setError("Your Access Key must be at least 6 characters long.");
      } else if (err.code === 'auth/invalid-email') {
        setError("The email address provided is not in a valid format.");
      } else {
        setError(err.message || "Failed to initialize account.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-[#111] p-8 rounded-2xl shadow-2xl border border-gray-800">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600/10 mb-4 border border-blue-600/30">
            <i className="fas fa-user-plus text-2xl text-blue-500"></i>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Join Flexer</h1>
          <p className="text-gray-400 mt-2">Request Operative Credentials</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <i className="fas fa-circle-exclamation mt-1"></i>
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">Email Address</label>
            <input
              type="email"
              required
              className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-700"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-2 uppercase tracking-wider">Create Access Key</label>
            <input
              type="password"
              required
              className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-700"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center shadow-lg shadow-blue-900/20 active:scale-[0.98]"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              'INITIALIZE ACCOUNT'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800 text-center">
          <p className="text-gray-500 text-sm">
            Already have credentials?{' '}
            <button onClick={onSwitch} className="text-blue-500 hover:text-blue-400 hover:underline font-bold transition-colors">
              Login here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;