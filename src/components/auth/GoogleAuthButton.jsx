import Button from '../common/Button';
import { signInWithGoogle } from '../../services/auth/authService';

export default function GoogleAuthButton({ onError }) {
  const handleSignIn = async () => {
    const { error } = await signInWithGoogle();
    if (error) onError?.(error.message);
  };

  return <Button type="button" variant="secondary" className="auth-google" onClick={handleSignIn}>Continue with Google</Button>;
}
