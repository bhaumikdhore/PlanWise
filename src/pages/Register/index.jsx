import AuthLayout from '../../layouts/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import AuthInput from '../../components/auth/AuthInput';
import GoogleAuthButton from '../../components/auth/GoogleAuthButton';
import Button from '../../components/common/Button';

export default function RegisterPage({ onNavigate }) {
  return (
    <AuthLayout>
      <AuthCard
        title="Create your account"
        subtitle="Start planning smarter with Planwise."
        linkLabel="Already have an account? Sign in"
        onLinkClick={() => onNavigate('login')}
      >
        <form className="auth-form">
          <AuthInput label="Full Name" name="name" placeholder="Jordan Lee" />
          <AuthInput label="Work Email" type="email" name="email" placeholder="you@company.com" />
          <AuthInput label="Password" type="password" name="password" placeholder="Create a strong password" />

          <GoogleAuthButton />

          <Button type="submit" variant="primary" className="auth-submit" onClick={() => onNavigate('dashboard')}>
            Create account
          </Button>

          <Button type="button" variant="secondary" className="auth-submit auth-secondary-action" onClick={() => onNavigate('home')}>
            Back to home
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
