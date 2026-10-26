import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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

    const stateFromSession = (user: {
      id: string;
      email?: string | null;
      email_confirmed_at?: string | null;
    }): AuthState => ({
      status: 'authenticated',
      user: {
        id: user.id,
        email: user.email ?? null,
        emailConfirmed: user.email_confirmed_at !== null,
      },
    });

    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          setState(stateFromSession(session.user));
        } else {
          setState({ status: 'unauthenticated' });
        }
      })
      .catch(() => {
        // Initialization must never hang the whole app in 'loading': an
        // unreachable auth server degrades to the signed-out state, which
        // every guarded page already handles by redirecting to /login.
        setState({ status: 'unauthenticated' });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setState(stateFromSession(session.user));
      } else {
        setState({ status: 'unauthenticated' });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: input.emailRedirectTo || `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error ? { message: error.message, code: error.code } : null };
  }, []);

  const signIn = useCallback(async (input: SignInInput) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    return { error: error ? { message: error.message, code: error.code } : null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (input: ResetPasswordInput) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? { message: error.message, code: error.code } : null };
  }, []);

  const updatePassword = useCallback(async (input: UpdatePasswordInput) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: input.password });
    return { error: error ? { message: error.message, code: error.code } : null };
  }, []);

  const refreshUser = useCallback(async () => {
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
  }, []);

  // Stable context value: auth events re-emit new state objects, but action
  // identities never change, so consumers keyed on the context object don't
  // re-run effects on every token refresh.
  const value = useMemo(
    () => ({ ...state, signUp, signIn, signOut, resetPassword, updatePassword, refreshUser }),
    [state, signUp, signIn, signOut, resetPassword, updatePassword, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
