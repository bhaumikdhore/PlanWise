import Button from '../common/Button';
import { signInWithGoogle } from '../../services/auth/authService';

export default function GoogleAuthButton({ onError }) {
  const handleSignIn = async () => {
    try {
      const { error } = await signInWithGoogle();
      if (error) onError?.(error.message);
    } catch (error) {
      onError?.(error.message || 'Google sign in failed. Please try again.');
    }
  };

  return <Button type="button" variant="secondary" className="auth-google" onClick={handleSignIn}>Continue with Google</Button>;
}
