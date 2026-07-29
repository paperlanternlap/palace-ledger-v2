import { useEffect, useState } from "react";
import { KeyRound, LogOut, ShieldCheck, UserX } from "lucide-react";
import {
  getSession,
  getStaffMember,
  signIn,
  signOut,
  subscribeToAuthChanges,
} from "./authService";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const { error: signInError } = await signIn(email.trim(), password);
    setSubmitting(false);

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : signInError.message,
      );
    }
  }

  return (
    <main className="auth-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark">紅</div>
          <div>
            <h1>หลันโจว</h1>
            <p>PALACE LEDGER · STAFF</p>
          </div>
        </div>

        <div className="auth-icon">
          <KeyRound size={23} />
        </div>
        <h2>เข้าสู่ระบบสตาฟ</h2>
        <p className="auth-description">
          ใช้บัญชีที่ได้รับสิทธิ์จากผู้ดูแลระบบเท่านั้น
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            อีเมล
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              placeholder="staff@example.com"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            รหัสผ่าน
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              placeholder="••••••••"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={submitting}>
            {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </section>
    </main>
  );
}

function AccessDenied({ email }) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSignOut() {
    setSubmitting(true);
    await signOut();
    setSubmitting(false);
  }

  return (
    <main className="auth-page">
      <section className="access-card">
        <div className="auth-icon denied">
          <UserX size={24} />
        </div>
        <h2>บัญชีนี้ไม่มีสิทธิ์สตาฟ</h2>
        <p>
          เข้าสู่ระบบด้วย <strong>{email}</strong> สำเร็จ
          แต่ยังไม่อยู่ในรายชื่อ staff_members
        </p>
        <button type="button" onClick={handleSignOut} disabled={submitting}>
          <LogOut size={16} />
          {submitting ? "กำลังออก..." : "ออกจากระบบ"}
        </button>
      </section>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="auth-page">
      <section className="auth-loading">
        <ShieldCheck size={28} />
        <p>กำลังตรวจสอบสิทธิ์สตาฟ...</p>
      </section>
    </main>
  );
}

export function StaffGate({ children }) {
  const [authState, setAuthState] = useState({
    loading: true,
    session: null,
    staff: null,
  });

  useEffect(() => {
    let active = true;

    async function resolveSession(session) {
      if (!session) {
        if (active) {
          setAuthState({ loading: false, session: null, staff: null });
        }
        return;
      }

      const { data: staff } = await getStaffMember(session.user.id);
      if (active) {
        setAuthState({ loading: false, session, staff: staff || null });
      }
    }

    getSession().then(({ data }) => resolveSession(data.session));
    const { data: subscription } = subscribeToAuthChanges(resolveSession);

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (authState.loading) return <LoadingScreen />;
  if (!authState.session) return <LoginForm />;
  if (!authState.staff) {
    return <AccessDenied email={authState.session.user.email} />;
  }

  return children;
}
