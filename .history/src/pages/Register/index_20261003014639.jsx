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
    setSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const { data, error } = await signUpWithEmail({
        name: formData.get('name').trim(),
        email: formData.get('email'),
        password: formData.get('password')
      });
      if (error) setMessage(error.message);
      else if (!data.session) setMessage('Account created. Check your email to confirm your address before signing in.');
    } catch (error) {
      setMessage(error.message || 'Account creation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        title="Create your account"
        subtitle="Start planning smarter with Planwise."
        linkLabel="Already have an account? Sign in"
        onLinkClick={() => onNavigate('login')}
      >
        <form className="auth-form" onSubmit={submit}>
          <AuthInput label="Full Name" name="name" placeholder="Jordan Lee" autoComplete="name" required />
          <AuthInput label="Work Email" type="email" name="email" placeholder="you@company.com" autoComplete="email" required />
          <AuthInput label="Password" type="password" name="password" placeholder="Create a strong password" autoComplete="new-password" required minLength={6} />

          <GoogleAuthButton onError={setMessage} />
          {message && <small className="auth-google-message" role={message.startsWith('Account created') ? 'status' : 'alert'}>{message}</small>}

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
