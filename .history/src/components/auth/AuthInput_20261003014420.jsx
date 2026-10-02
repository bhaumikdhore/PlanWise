export default function AuthInput({ label, type = 'text', placeholder, name, ...inputProps }) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input type={type} name={name} placeholder={placeholder} {...inputProps} />
    </label>
  );
}
