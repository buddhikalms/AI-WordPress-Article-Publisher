"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type Notice = {
  type: "success" | "error" | "info";
  message: string;
};

const noticeClass: Record<Notice["type"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
};

export default function LoginPage() {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingSignIn, setLoadingSignIn] = useState(false);

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [wpBaseUrl, setWpBaseUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpPassword, setWpPassword] = useState("");
  const [registering, setRegistering] = useState(false);

  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleCredentialsSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);

    try {
      setLoadingSignIn(true);
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setNotice({
          type: "error",
          message: result?.error || "Invalid login credentials.",
        });
        return;
      }

      router.push("/");
      router.refresh();
    } finally {
      setLoadingSignIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    await signIn("google", { callbackUrl: "/" });
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);

    try {
      setRegistering(true);
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: registerName,
          email: registerEmail,
          password: registerPassword,
          wordpressBaseUrl: wpBaseUrl,
          wordpressUsername: wpUsername,
          wordpressPassword: wpPassword,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Registration failed.");
      }

      setNotice({
        type: "success",
        message:
          payload?.message ||
          "Registration successful. Please verify your email with the code we sent.",
      });
      setVerifyEmail(registerEmail.toLowerCase());
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Registration failed.",
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);

    try {
      setVerifying(true);
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: verifyEmail,
          code: verifyCode,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Verification failed.");
      }

      setNotice({
        type: "success",
        message: payload?.message || "Email verified. You can sign in now.",
      });
      setEmail(verifyEmail);
      setPassword("");
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Verification failed.",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!verifyEmail.trim()) {
      setNotice({
        type: "error",
        message: "Enter your email first to resend the code.",
      });
      return;
    }

    const response = await fetch("/api/auth/resend-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: verifyEmail }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setNotice({
        type: "error",
        message: payload?.error || "Failed to resend code.",
      });
      return;
    }

    setNotice({
      type: "info",
      message: payload?.message || "A new code has been sent.",
    });
  };

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-6 px-4 py-8 md:grid-cols-2 md:px-6">
      <section className="panel p-6">
        <h1 className="text-2xl font-bold text-slate-900">Sign In</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use credentials or Google auth to access your publishing dashboard.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleCredentialsSignIn}>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              title="Enter your account email address"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              title="Enter your account password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button className="button-primary w-full" type="submit" disabled={loadingSignIn}>
            {loadingSignIn ? "Signing in..." : "Sign in with credentials"}
          </button>
        </form>

        <button className="button-secondary mt-3 w-full" type="button" onClick={handleGoogleSignIn}>
          Continue with Google
        </button>
      </section>

      <section className="space-y-6">
        <div className="panel p-6">
          <h2 className="text-xl font-semibold text-slate-900">Create Account</h2>
          <p className="mt-2 text-sm text-slate-600">
            Create your account first. WordPress sites can be connected now or later from Site Settings.
          </p>
          <form className="mt-4 space-y-3" onSubmit={handleRegister}>
            <div>
              <label className="label">Full Name</label>
              <input
                className="input"
                title="Enter your full name"
                placeholder="John Doe"
                value={registerName}
                onChange={(event) => setRegisterName(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input
                className="input"
                type="email"
                title="Enter a valid email address for your account"
                placeholder="you@example.com"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                title="Use at least 8 characters for your password"
                placeholder="Minimum 8 characters"
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">WordPress Base URL</label>
              <input
                className="input"
                type="url"
                title="Enter your WordPress site URL"
                placeholder="Optional: https://example.com"
                value={wpBaseUrl}
                onChange={(event) => setWpBaseUrl(event.target.value)}
              />
            </div>
            <div>
              <label className="label">WordPress Username</label>
              <input
                className="input"
                title="Enter your WordPress username"
                placeholder="Optional"
                value={wpUsername}
                onChange={(event) => setWpUsername(event.target.value)}
              />
            </div>
            <div>
              <label className="label">WordPress App Password</label>
              <input
                className="input"
                type="password"
                title="Enter your WordPress application password"
                placeholder="Optional for now"
                value={wpPassword}
                onChange={(event) => setWpPassword(event.target.value)}
              />
            </div>
            <button className="button-primary w-full" type="submit" disabled={registering}>
              {registering ? "Registering..." : "Register"}
            </button>
          </form>
        </div>

        <div className="panel p-6">
          <h2 className="text-xl font-semibold text-slate-900">Verify Email</h2>
          <form className="mt-4 space-y-3" onSubmit={handleVerify}>
            <div>
              <label className="label">Registered Email</label>
              <input
                className="input"
                type="email"
                title="Enter the same email used during registration"
                placeholder="you@example.com"
                value={verifyEmail}
                onChange={(event) => setVerifyEmail(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Verification Code</label>
              <input
                className="input"
                inputMode="numeric"
                pattern="[0-9]{6}"
                title="Enter the 6-digit code sent to your email"
                placeholder="6-digit code"
                value={verifyCode}
                onChange={(event) => setVerifyCode(event.target.value)}
                required
              />
            </div>
            <div className="flex gap-3">
              <button className="button-primary flex-1" type="submit" disabled={verifying}>
                {verifying ? "Verifying..." : "Verify"}
              </button>
              <button className="button-muted" type="button" onClick={handleResendCode}>
                Resend Code
              </button>
            </div>
          </form>
        </div>
      </section>

      {notice ? (
        <div className={`fixed bottom-4 right-4 max-w-md rounded-lg border px-4 py-3 shadow ${noticeClass[notice.type]}`}>
          <p className="text-sm">{notice.message}</p>
        </div>
      ) : null}
    </main>
  );
}
