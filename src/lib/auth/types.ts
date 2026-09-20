export type AuthError = {
  message: string;
  code?: string;
};

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated' };

export type AuthUser = {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
};

export type SignUpInput = {
  email: string;
  password: string;
  emailRedirectTo?: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type ResetPasswordInput = {
  email: string;
};

export type UpdatePasswordInput = {
  password: string;
};
