"use client";

import { useSession } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * One Supabase client for the page. Every request and the Realtime socket send
 * the Clerk session token, so row-level security knows who is asking
 * (auth.jwt()->>'sub' is the Clerk user id).
 */
export function useSupabase(): SupabaseClient | null {
  const { session, isLoaded } = useSession();
  const sessionRef = useRef(session);
  const [client, setClient] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!isLoaded || !session || client) return;
    setClient(
      createClient(url, key, {
        accessToken: async () => (await sessionRef.current?.getToken()) ?? null,
      }),
    );
  }, [isLoaded, session, client]);

  return client;
}
