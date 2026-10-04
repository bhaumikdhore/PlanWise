import { useState } from 'react';
import AuthLayout from '../../layouts/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import AuthInput from '../../components/auth/AuthInput';
import GoogleAuthButton from '../../components/auth/GoogleAuthButton';
import Button from '../../components/common/Button';
import { signInWithEmail } from '../../services/auth/authService';

export default function LoginPage({ onNavigate }) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const { error } = await signInWithEmail({
        email: formData.get('email'),
        password: formData.get('password')
      });
      if (error) setMessage(error.message);
    } catch (error) {
      setMessage(error.message || 'Sign in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        title="Welcome back"
        subtitle="Keep momentum on every project."
        linkLabel="Need an account? Create one"
        onLinkClick={() => onNavigate('register')}
      >
        <form className="auth-form" onSubmit={submit}>
          <AuthInput label="Work email" type="email" name="email" placeholder="you@company.com" autoComplete="email" required />
          <AuthInput label="Password" type="password" name="password" placeholder="••••••••" autoComplete="current-password" required />
          <div className="auth-row">
            <label className="checkbox-row">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>
            <button type="button" className="text-button">Forgot password?</button>
          </div>
          <GoogleAuthButton onError={setMessage} />
          {message && <small className="auth-google-message" role="alert">{message}</small>}
          <Button type="submit" variant="primary" className="auth-submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
          <Button type="button" variant="secondary" className="auth-submit" onClick={() => onNavigate('home')}>
            Back to home
          </Button>
          <p className="auth-legal-notice">
            Read our <a href="/terms" onClick={(event) => { event.preventDefault(); onNavigate('terms'); }}>Terms of Service</a> and <a href="/privacy" onClick={(event) => { event.preventDefault(); onNavigate('privacy'); }}>Privacy Policy</a>.
          </p>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
