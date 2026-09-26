import { useState } from 'react';
import AuthLayout from '../../layouts/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import AuthInput from '../../components/auth/AuthInput';
import GoogleAuthButton from '../../components/auth/GoogleAuthButton';
import Button from '../../components/common/Button';

export default function LoginPage({ onNavigate }) {
  const [googleMessage, setGoogleMessage] = useState('');

  return (
    <AuthLayout>
      <AuthCard
        title="Welcome back"
        subtitle="Keep momentum on every project."
        linkLabel="Need an account? Create one"
        onLinkClick={() => onNavigate('register')}
      >
        <form className="auth-form">
          <AuthInput label="Work email" type="email" name="email" placeholder="you@company.com" />
          <AuthInput label="Password" type="password" name="password" placeholder="••••••••" />
          <div className="auth-row">
            <label className="checkbox-row">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>
            <button type="button" className="text-button">Forgot password?</button>
          </div>
          <GoogleAuthButton onError={(message) => setGoogleMessage(message)} />
          {googleMessage && <small className="auth-google-message">{googleMessage}</small>}
          <Button type="submit" variant="primary" className="auth-submit" onClick={() => onNavigate('dashboard')}>
            Sign in
          </Button>
          <Button type="button" variant="secondary" className="auth-submit" onClick={() => onNavigate('home')}>
            Back to home
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
