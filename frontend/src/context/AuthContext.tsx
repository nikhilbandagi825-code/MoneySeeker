import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

import { api, setAuthToken, User } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "ms_session_token";
const AUTH_URL = "https://auth.emergentagent.com/";

function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/[?#&]session_id=([^&#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loginEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (email: string, password: string, name: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const processed = useRef<Set<string>>(new Set());

  const persist = useCallback(async (token: string, u: User) => {
    setAuthToken(token);
    await storage.secureSet(TOKEN_KEY, token);
    setUser(u);
  }, []);

  const handleSessionId = useCallback(
    async (sessionId: string) => {
      if (!sessionId || processed.current.has(sessionId)) return;
      processed.current.add(sessionId);
      try {
        const res = await api.googleSession(sessionId);
        await persist(res.session_token, res.user);
      } catch (e) {
        console.warn("google session exchange failed", e);
      }
    },
    [persist],
  );

  // Bootstrap: process any pending session_id, then validate stored token.
  useEffect(() => {
    let urlSub: { remove: () => void } | undefined;

    (async () => {
      try {
        if (Platform.OS === "web") {
          const id =
            extractSessionId(window.location.hash) ||
            extractSessionId(window.location.search);
          if (id) {
            await handleSessionId(id);
            // Clean only the session_id from the URL, preserve everything else.
            const clean = window.location.href
              .replace(/([?#&])session_id=[^&#]+/, "$1")
              .replace(/[?#&]$/, "");
            window.history.replaceState(window.history.state, "", clean);
          }
        } else {
          const initial = await Linking.getInitialURL();
          const id = extractSessionId(initial);
          if (id) await handleSessionId(id);
          urlSub = Linking.addEventListener("url", (e) => {
            const hot = extractSessionId(e.url);
            if (hot) handleSessionId(hot);
          });
        }

        if (!user) {
          const token = await storage.secureGet<string>(TOKEN_KEY, "");
          if (token) {
            setAuthToken(token);
            try {
              const me = await api.me();
              setUser(me);
            } catch {
              setAuthToken(null);
              await storage.secureRemove(TOKEN_KEY);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => urlSub?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginEmail = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email.trim(), password);
      await persist(res.session_token, res.user);
    },
    [persist],
  );

  const registerEmail = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await api.register(email.trim(), password, name.trim());
      await persist(res.session_token, res.user);
    },
    [persist],
  );

  const loginGoogle = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("");
    const authUrl = `${AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }

    const sub = Linking.addEventListener("url", (e) => {
      const id = extractSessionId(e.url);
      if (id) handleSessionId(id);
    });
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      let url: string | null = result.type === "success" ? result.url : null;
      if (!url) url = await Linking.getInitialURL();
      const id = extractSessionId(url);
      if (id) await handleSessionId(id);
    } finally {
      sub.remove();
    }
  }, [handleSessionId]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore network errors on logout
    }
    setAuthToken(null);
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, loginEmail, registerEmail, loginGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
