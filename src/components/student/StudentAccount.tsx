import { useState } from "react";
import { studentCloud } from "../../lib/student-cloud";

export function StudentAccount({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (!studentCloud)
    return (
      <div className="student-editor">
        <p>
          Online student accounts are not enabled for this website yet. You can
          create a profile and choose a character on this device.
        </p>
        <button className="campus-secondary" onClick={onDone}>
          Back to profile
        </button>
      </div>
    );
  return (
    <form
      className="student-editor student-account"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        try {
          const { data, error } =
            mode === "signin"
              ? await studentCloud!.auth.signInWithPassword({
                  email: email.trim(),
                  password,
                })
              : await studentCloud!.auth.signUp({
                  email: email.trim(),
                  password,
                  options: {
                    emailRedirectTo: location.origin + location.pathname,
                  },
                });
          if (error) throw error;
          setPassword("");
          if (data.session) onDone();
          else
            setNotice(
              "Check your email to confirm your account, then sign in here.",
            );
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Your account request could not be completed.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Use your separate Campus Explorer student account. Your device profile
        stays on this device; it is not uploaded automatically.
      </p>
      <div className="student-account-modes">
        <button
          type="button"
          className="campus-secondary"
          aria-pressed={mode === "signin"}
          disabled={busy}
          onClick={() => {
            setMode("signin");
            setError("");
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          className="campus-secondary"
          aria-pressed={mode === "signup"}
          disabled={busy}
          onClick={() => {
            setMode("signup");
            setError("");
          }}
        >
          Create account
        </button>
      </div>
      <label>
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          disabled={busy}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          required
          minLength={mode === "signup" ? 8 : 1}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          disabled={busy}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {mode === "signup" && (
        <p className="student-help">
          Use at least 8 characters. Your profile and photo start private.
        </p>
      )}
      {notice && (
        <p role="status" className="student-success">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="student-error">
          {error}
        </p>
      )}
      <div className="student-actions">
        <button
          type="button"
          className="campus-secondary"
          onClick={onDone}
          disabled={busy}
        >
          Cancel
        </button>
        <button className="campus-primary" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "signup"
              ? "Create student account"
              : "Sign in to student account"}
        </button>
      </div>
    </form>
  );
}
