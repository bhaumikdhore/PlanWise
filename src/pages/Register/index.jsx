import { useState } from 'react';
import AuthLayout from '../../layouts/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import AuthInput from '../../components/auth/AuthInput';
import GoogleAuthButton from '../../components/auth/GoogleAuthButton';
import Button from '../../components/common/Button';
import { signUpWithEmail } from '../../services/auth/authService';

export default function RegisterPage({ onNavigate }) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');

    const formData = new FormData(event.currentTarget);
    const password = formData.get('password');
    if (password !== formData.get('confirmPassword')) {
      setMessage('Password and Confirm Password do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await signUpWithEmail({
        name: formData.get('name').trim(),
        email: formData.get('email'),
        password
      });
      const errorCode = error?.code?.toLowerCase();
      const errorMessage = error?.message?.toLowerCase() || '';
      const existingAccount = ['user_already_exists', 'email_exists'].includes(errorCode)
        || errorMessage.includes('already registered')
        || errorMessage.includes('already exists')
        || data?.user?.identities?.length === 0;

      if (existingAccount) {
        setMessage('An account with this email already exists');
      } else if (error) {
        setMessage(error.message || 'Account creation failed. Please try again.');
      } else if (!data?.session) {
        setMessage('Account creation did not return an active session. Check that email confirmation is disabled in Supabase.');
      }
    } catch (error) {
      setMessage(error.message || 'Account creation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout variant="register">
      <AuthCard
        className="auth-card--register"
        title="Create your account"
        subtitle="Start planning smarter with Planwise."
        linkLabel="Already have an account? Sign in"
        onLinkClick={() => onNavigate('login')}
      >
        <form className="auth-form register-form" onSubmit={submit}>
          <AuthInput label="Full Name" name="name" placeholder="Jordan Lee" autoComplete="name" required />
          <AuthInput label="Work Email" type="email" name="email" placeholder="you@company.com" autoComplete="email" required />
          <AuthInput label="Password" type="password" name="password" placeholder="Create password" autoComplete="new-password" required minLength={6} />
          <AuthInput label="Confirm Password" type="password" name="confirmPassword" placeholder="Confirm password" autoComplete="new-password" required minLength={6} />

          <GoogleAuthButton onError={setMessage} />
          {message && <small className="auth-google-message" role="alert">{message}</small>}

          <Button type="submit" variant="primary" className="auth-submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>

          <Button type="button" variant="secondary" className="auth-submit auth-secondary-action" onClick={() => onNavigate('home')}>
            Back to home
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
