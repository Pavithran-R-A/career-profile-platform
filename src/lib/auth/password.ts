export const NEW_PASSWORD_MIN_LENGTH = 12;

export function newPasswordError(password: string): string | null {
  if (password.length < NEW_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${NEW_PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include a lowercase letter';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include an uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include a number';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include a symbol';
  }
  return null;
}
