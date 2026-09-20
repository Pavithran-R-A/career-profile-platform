import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type {
  AuthState,
  AuthError,
  SignUpInput,
  SignInInput,
  ResetPasswordInput,
  UpdatePasswordInput,
} from './types';
import { getSupabaseClient } from '../supabase/client';

const AuthContext = createContext<
  | (AuthState & {
      signUp: (input: SignUpInput) => Promise<{ error: AuthError | null }>;
      signIn: (input: SignInInput) => Promise<{ error: AuthError | null }>;
      signOut: () => Promise<void>;
      resetPassword: (input: ResetPasswordInput) => Promise<{ error: AuthError | null }>;
      updatePassword: (input: UpdatePasswordInput) => Promise<{ error: AuthError | null }>;
      refreshUser: () => Promise<void>;
    })
  | null
>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    const supabase = getSupabaseClient();

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setState({
          status: 'authenticated',
          user: {
            id: session.user.id,
            email: session.user.email ?? null,
            emailConfirmed: session.user.email_confirmed_at !== null,
          },
        });
      } else {
        setState({ status: 'unauthenticated' });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setState({
          status: 'authenticated',
          user: {
            id: session.user.id,
            email: session.user.email ?? null,
            emailConfirmed: session.user.email_confirmed_at !== null,
          },
        });
      } else {
        setState({ status: 'unauthenticated' });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (input: SignUpInput) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
    });
    return { error: error ? { message: error.message, code: error.code } : null };
  };

  const signIn = async (input: SignInInput) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    return { error: error ? { message: error.message, code: error.code } : null };
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  };

  const resetPassword = async (input: ResetPasswordInput) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? { message: error.message, code: error.code } : null };
  };

  const updatePassword = async (input: UpdatePasswordInput) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: input.password });
    return { error: error ? { message: error.message, code: error.code } : null };
  };

  const refreshUser = async () => {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setState({
        status: 'authenticated',
        user: {
          id: user.id,
          email: user.email ?? null,
          emailConfirmed: user.email_confirmed_at !== null,
        },
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{ ...state, signUp, signIn, signOut, resetPassword, updatePassword, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
