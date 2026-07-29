import { supabase } from "../../supabase";

export function getSession() {
  return supabase.auth.getSession();
}

export function subscribeToAuthChanges(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function signOut() {
  return supabase.auth.signOut();
}

export function getStaffMember(userId) {
  return supabase
    .from("staff_members")
    .select("user_id, display_name, active")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
}
