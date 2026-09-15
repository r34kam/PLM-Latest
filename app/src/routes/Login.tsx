import * as React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, LoaderCircle, Mail } from "lucide-react";
import { useIdentityProviders, useAuthLogin } from "@unifyapps/app-builder-sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

// ── Demo credentials available for autofill ─────────────────────────────────
const DEMO_USERS = [
  { label: "Document Control Lead", username: "hannerose.santiago@topcon.com", password: "TopconPLM2024!" },
] as const;

// Login route — a template translation of the UnifyApps "login" interface page.
//
// It fetches the identity providers configured for ONE interface and renders the
// right sign-in surface per IDP type, then completes login via the SDK auth hooks:
//   • OPEN_ID / SAML         -> "SSO" buttons  (one click -> redirect)
//   • PASSWORD (non-OTP)     -> username + password form
//   • PASSWORD, provider OTP -> username-only form (OTP is sent, then verified elsewhere)
//
// The interface to load is identified by its interfaceId — the same value as the
// interface's sessionId, injected by the engine as build-time env
// (import.meta.env.VITE_APPLICATION_ID) and read from AppBuilderProvider's context.

type Mode = "sso" | "password" | "otp";

// The SDK doesn't re-export the IdentityProvider type from its root, so derive it
// from the hook's return type — one identity provider record.
type IdentityProvider = NonNullable<
  NonNullable<ReturnType<typeof useIdentityProviders>["data"]>["objects"]
>[number];

// Mirror the interface's returnTo wiring: honor an explicit ?returnTo=, otherwise
// land back on the app root. SSO/redirect flows want an absolute URL.
function resolveReturnTo(): string {
  const returnTo = new URLSearchParams(window.location.search).get("returnTo");
  if (returnTo) {
    return returnTo.startsWith("http")
      ? returnTo
      : `${window.location.origin}${returnTo}`;
  }
  return `${window.location.origin}/`;
}

const isSso = (idp: IdentityProvider) =>
  idp.type === "OPEN_ID" || idp.type === "SAML";
const isPassword = (idp: IdentityProvider) =>
  idp.type === "PASSWORD" && idp.configProvider !== "OTP";
const isOtp = (idp: IdentityProvider) =>
  idp.type === "PASSWORD" && idp.configProvider === "OTP";

function ErrorAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex w-full items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ── Left decorative panel ────────────────────────────────────────────────────
function HeroPanelSvg() {
  // SVG chart curve with milestone dots matching the reference image
  return (
    <svg
      viewBox="0 0 740 800"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.9 }}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Grid lines horizontal */}
      {[200, 300, 400, 500, 600].map((y) => (
        <line key={y} x1="0" y1={y} x2="740" y2={y} stroke="#1e3a52" strokeWidth="1" strokeDasharray="4 6" />
      ))}
      {/* Grid lines vertical */}
      {[150, 300, 450, 600].map((x) => (
        <line key={x} x1={x} y1="0" x2={x} y2="800" stroke="#1e3a52" strokeWidth="1" strokeDasharray="4 6" />
      ))}
      {/* Main curve */}
      <path
        d="M -20 600 C 80 590, 160 560, 230 510 C 310 450, 360 400, 440 310 C 510 230, 580 150, 760 40"
        stroke="#4a9fd4"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Milestone dots */}
      <circle cx="160" cy="548" r="5" fill="#4a9fd4" />
      <circle cx="232" cy="500" r="5" fill="#4a9fd4" />
      {/* Current milestone — larger, with ring */}
      <circle cx="440" cy="310" r="14" stroke="#4a9fd4" strokeWidth="2" fill="#0d2137" />
      <circle cx="440" cy="310" r="6" fill="#4a9fd4" />
      {/* Vertical dashed drop line from current dot */}
      <line x1="440" y1="324" x2="440" y2="800" stroke="#4a9fd4" strokeWidth="1" strokeDasharray="4 6" opacity="0.5" />
      {/* Data labels */}
      <text x="200" y="378" fill="#a0c4e0" fontSize="12" fontFamily="monospace" letterSpacing="1">REV A</text>
      <text x="456" y="258" fill="#ffffff" fontSize="11" fontFamily="monospace" letterSpacing="1">● REV C // CCB APPROVED</text>
      <text x="540" y="190" fill="#a0c4e0" fontSize="11" fontFamily="monospace" letterSpacing="1">PROD SYNC</text>
    </svg>
  );
}

function HeroPanel() {
  return (
    <div
      style={{
        flex: "0 0 49%",
        background: "linear-gradient(160deg, #0d2137 0%, #0a1929 60%, #061220 100%)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "28px 32px 40px",
        minHeight: "100vh",
      }}
      data-test-id="login-hero-panel"
    >
      <HeroPanelSvg />

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4a9fd4", border: "2px solid #4a9fd4" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid #4a9fd4", background: "transparent" }} />
        </div>
        <span style={{ color: "#ffffff", fontSize: 16, fontWeight: 600, letterSpacing: "0.02em" }}>Topcon PLM</span>
      </div>

      {/* System data top-right */}
      <div style={{ position: "absolute", top: 28, right: 32, zIndex: 1 }}>
        <span style={{ color: "#4a9fd4", fontSize: 11, fontFamily: "monospace", letterSpacing: "0.08em" }}>
          SYS: LIV-HQ / TOL: ±0.01MM
        </span>
      </div>

      {/* Bottom copy */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <h2 style={{
          color: "#ffffff",
          fontSize: "clamp(28px, 4vw, 42px)",
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
          marginBottom: 16,
          fontFamily: "Georgia, 'Times New Roman', serif",
          textWrap: "balance",
        }}>
          Nobody notices the bill of materials until the line stops.
        </h2>
        <p style={{
          color: "#7aafcf",
          fontSize: 14,
          lineHeight: 1.65,
          maxWidth: 480,
        }}>
          So Topcon PLM traces every engineering change, CAD revision, and supplier sign-off back to the rule, the spec and the deal that produced it — before anyone has to come and ask.
        </p>
      </div>
    </div>
  );
}

// ── Right panel shell ────────────────────────────────────────────────────────
function AuthPanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: "0 0 51%",
        background: "#f4f6f8",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "48px 32px",
      }}
      data-test-id="login-auth-panel"
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        {children}
      </div>
    </div>
  );
}

function AuthCard({ children }: { children: React.ReactNode }) {
  return <div style={{ width: "100%" }}>{children}</div>;
}

function CardHeading() {
  return (
    <h1
      style={{
        fontSize: 32,
        fontWeight: 400,
        color: "#0a1929",
        marginBottom: 32,
        fontFamily: "Georgia, 'Times New Roman', serif",
        letterSpacing: "-0.02em",
      }}
      data-test-id="login-heading"
    >
      Sign in
    </h1>
  );
}

export default function Login() {
  // The app's application / interface id — the SAME value as this build's code-builder
  // session id — reaches useIdentityProviders through AppBuilderProvider's context
  // (main.tsx passes interfaceId = import.meta.env.VITE_APPLICATION_ID, injected
  // by the engine at build time). It selects WHICH interface's sign-in providers
  // to load; never hardcode a literal id here.
  const { data, isLoading, isError } = useIdentityProviders();

  const { ssoIdps, passwordIdp, otpIdp } = React.useMemo(() => {
    // Only show ACTIVE providers — a deactivated IDP must never render a sign-in
    // surface. Treat a missing `active` flag as active (older records omit it).
    const objects = (data?.objects ?? []).filter(
      (p: IdentityProvider) => p.active !== false,
    );
    return {
      ssoIdps: objects.filter(isSso),
      passwordIdp: objects.find(isPassword),
      otpIdp: objects.find(isOtp),
    };
  }, [data]);

  // Default surface, derived during render (not in an effect, so there's no blank
  // frame): SSO first, then password, then OTP. null = no sign-in methods at all.
  const defaultMode: Mode | null = ssoIdps.length
    ? "sso"
    : passwordIdp
      ? "password"
      : otpIdp
        ? "otp"
        : null;

  // A user switch (Login-via-username / Back-to-login) overrides the default.
  const [override, setMode] = React.useState<Mode | null>(null);
  const mode = override ?? defaultMode;

  const login = useAuthLogin();
  const returnTo = React.useMemo(resolveReturnTo, []);

  const submitLogin = React.useCallback(
    (identityProviderId: string, formData: Record<string, unknown>) => {
      login.mutate(
        { data: { identityProviderId, formData, returnTo } },
        {
          onSuccess: ({ redirectUrl }) => {
            if (redirectUrl) window.location.href = redirectUrl;
          },
        },
      );
    },
    [login, returnTo],
  );

  const errorMessage = isError
    ? "Sorry, we could not fetch the login details."
    : (login.error as { message?: string } | null)?.message;

  if (isLoading) {
    return (
      <main style={{ display: "flex", minHeight: "100vh" }}>
        <HeroPanel />
        <AuthPanel>
          <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
        </AuthPanel>
      </main>
    );
  }

  return (
    <main style={{ display: "flex", minHeight: "100vh" }} data-test-id="login-page">
      <HeroPanel />
      <AuthPanel>
        {mode === "sso" && (
          <SsoView
            idps={ssoIdps}
            hasUsernameLogin={Boolean(passwordIdp || otpIdp)}
            error={errorMessage}
            pending={login.isPending}
            onSelect={(idp) => submitLogin(idp.id!, {})}
            onUsernameLogin={() => setMode(passwordIdp ? "password" : "otp")}
          />
        )}

        {mode === "password" && passwordIdp && (
          <PasswordView
            idp={passwordIdp}
            error={errorMessage}
            pending={login.isPending}
            showBack={ssoIdps.length > 0}
            onBack={() => setMode("sso")}
            onSubmit={(username, password) =>
              submitLogin(passwordIdp.id!, { username, password, rememberMe: true })
            }
          />
        )}

        {mode === "otp" && otpIdp && (
          <OtpView
            error={errorMessage}
            pending={login.isPending}
            showBack={ssoIdps.length > 0}
            onBack={() => setMode("sso")}
            onSubmit={(username) =>
              submitLogin(otpIdp.id!, { username, rememberMe: true })
            }
          />
        )}

        {mode === null && (
          <AuthCard>
            <CardHeading />
            <ErrorAlert
              message={
                errorMessage ??
                "No sign-in methods are configured for this application."
              }
            />
          </AuthCard>
        )}
      </AuthPanel>
    </main>
  );
}

function SsoView({
  idps,
  hasUsernameLogin,
  error,
  pending,
  onSelect,
  onUsernameLogin,
}: {
  idps: IdentityProvider[];
  hasUsernameLogin: boolean;
  error?: string;
  pending: boolean;
  onSelect: (idp: IdentityProvider) => void;
  onUsernameLogin: () => void;
}) {
  return (
    <AuthCard>
      <CardHeading />
      <div className="flex flex-col gap-3">
        {idps.map((idp, index) => (
          <Button
            key={idp.id}
            variant={index === 0 ? "default" : "outline"}
            size="lg"
            className="h-10 w-full"
            disabled={pending}
            onClick={() => onSelect(idp)}
          >
            {idp.iconUrl ? (
              <img src={idp.iconUrl} alt="" className="size-4" />
            ) : null}
            {(idp.uiConfig?.button?.value as string | undefined) ?? idp.name}
          </Button>
        ))}
      </div>

      {hasUsernameLogin && (
        <div className="mt-3">
          <Button
            variant="outline"
            size="lg"
            className="h-10 w-full"
            disabled={pending}
            onClick={onUsernameLogin}
          >
            <Mail className="size-4" />
            Login via Username
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <ErrorAlert message={error} />
        </div>
      )}
    </AuthCard>
  );
}

const FIELD_LABEL: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#374151",
  marginBottom: 6,
  display: "block",
};

const FIELD_INPUT: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  background: "#ffffff",
  color: "#111827",
  outline: "none",
  boxSizing: "border-box",
};

function PasswordView({
  idp,
  error,
  pending,
  showBack,
  onBack,
  onSubmit,
}: {
  idp: IdentityProvider;
  error?: string;
  pending: boolean;
  showBack: boolean;
  onBack: () => void;
  onSubmit: (username: string, password: string) => void;
}) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const usernameLabel = (idp.uiConfig?.form?.usernameLabel as string | undefined) ?? "Username";

  function handleAutofill(u: string, p: string) {
    setUsername(u);
    setPassword(p);
  }

  return (
    <AuthCard>
      <CardHeading />
      <form
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(username, password);
        }}
        data-test-id="login-form"
      >
        {/* Username */}
        <div>
          <label htmlFor="username" style={FIELD_LABEL}>{usernameLabel}</label>
          <Input
            id="username"
            autoFocus
            autoComplete="username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={FIELD_INPUT}
            data-test-id="login-username-input"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" style={FIELD_LABEL}>Password</label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={FIELD_INPUT}
            data-test-id="login-password-input"
          />
          {/* Forgot password — right-aligned, below the field */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <Link
              to="/forgot-password"
              style={{ fontSize: 13, color: "#1e3a8a", fontWeight: 500, textDecoration: "none" }}
              data-test-id="login-forgot-password-link"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <ErrorAlert message={error} />

        {/* Sign in button */}
        <button
          type="submit"
          disabled={pending}
          data-test-id="login-submit-btn"
          style={{
            width: "100%",
            padding: "13px 0",
            background: pending ? "#3b6ea8" : "#1d4ed8",
            color: "#ffffff",
            border: "none",
            borderRadius: 6,
            fontSize: 15,
            fontWeight: 600,
            cursor: pending ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "background .15s",
          }}
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          Sign in
        </button>
      </form>

      {/* Demo user autofill */}
      <div style={{ marginTop: 32, borderTop: "1px solid #e5e7eb", paddingTop: 20 }}>
        {DEMO_USERS.map((u) => (
          <div
            key={u.username}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <span style={{ fontSize: 12, color: "#6b7280" }}>Demo user: {u.label}</span>
            <button
              type="button"
              onClick={() => handleAutofill(u.username, u.password)}
              data-test-id="login-autofill-btn"
              style={{
                fontSize: 12, fontWeight: 600, color: "#1d4ed8",
                background: "none", border: "none", cursor: "pointer",
                textDecoration: "underline", padding: 0,
              }}
            >
              Autofill
            </button>
          </div>
        ))}
      </div>

      {showBack && <BackToLogin onBack={onBack} />}
    </AuthCard>
  );
}

function OtpView({
  error,
  pending,
  showBack,
  onBack,
  onSubmit,
}: {
  error?: string;
  pending: boolean;
  showBack: boolean;
  onBack: () => void;
  onSubmit: (username: string) => void;
}) {
  const [username, setUsername] = React.useState("");

  return (
    <AuthCard>
      <CardHeading />
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(username);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="otp-username">Username</Label>
          <Input
            id="otp-username"
            autoFocus
            autoComplete="username"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <ErrorAlert message={error} />

        <Button
          type="submit"
          size="lg"
          className="h-11 w-full"
          disabled={pending}
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          Continue
        </Button>
      </form>

      {showBack && <BackToLogin onBack={onBack} />}
    </AuthCard>
  );
}

function BackToLogin({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="mt-5 inline-flex items-center justify-center gap-1.5 self-center text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to login
    </button>
  );
}
