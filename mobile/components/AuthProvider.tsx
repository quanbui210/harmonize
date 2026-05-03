import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { resolveAuthIdentifierToEmail } from '../lib/auth';

WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signInWithPassword: (identifier: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isLoading: true,
  signInWithPassword: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
      } catch {
        if (!isMounted) return;
        setSession(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    const handleAuthCallbackUrl = async (url: string) => {
      try {
        const parsed = parseAuthCallback(url);

        if (parsed.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
          if (error) {
            throw error;
          }
          return;
        }

        if (parsed.accessToken && parsed.refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          });
          if (error) {
            throw error;
          }
        }
      } catch {
        // Keep provider resilient even if callback parse/session exchange fails.
      }
    };

    void Linking.getInitialURL().then((url) => {
      if (!url) return;
      void handleAuthCallbackUrl(url);
    });

    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleAuthCallbackUrl(url);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const signInWithPassword = async (identifier: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: resolveAuthIdentifierToEmail(identifier),
      password,
    });

    if (error) {
      throw new Error(error.message || 'Invalid username, email, or password.');
    }
  };

  const signInWithGoogle = async () => {
    const redirectTo = Linking.createURL('auth/callback');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      throw new Error(error.message || 'Unable to start Google sign in.');
    }

    const authUrl = data?.url;
    if (!authUrl) {
      throw new Error('Google sign in URL was not returned.');
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);
    if (result.type !== 'success' || !result.url) {
      if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('Google sign in was cancelled.');
      }
      throw new Error('Google sign in did not complete.');
    }

    const callbackData = parseAuthCallback(result.url);
    if (callbackData.code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
        callbackData.code,
      );
      if (exchangeError) {
        throw new Error(exchangeError.message || 'Could not complete Google sign in.');
      }
      return;
    }

    if (callbackData.accessToken && callbackData.refreshToken) {
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: callbackData.accessToken,
        refresh_token: callbackData.refreshToken,
      });
      if (setSessionError) {
        throw new Error(setSessionError.message || 'Could not complete Google sign in.');
      }
      return;
    }

    throw new Error('Google sign in callback did not include a valid session.');
  };

  return (
    <AuthContext.Provider
      value={{ session, user, isLoading, signInWithPassword, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

function parseAuthCallback(url: string) {
  const urlObject = new URL(url);
  const queryParams = new URLSearchParams(urlObject.search);
  const hashParams = new URLSearchParams(urlObject.hash.replace(/^#/, ''));

  const getParam = (key: string) => queryParams.get(key) || hashParams.get(key) || null;

  return {
    code: getParam('code'),
    accessToken: getParam('access_token'),
    refreshToken: getParam('refresh_token'),
  };
}
