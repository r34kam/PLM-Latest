import * as React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, LoaderCircle, Mail } from "lucide-react";
import { useIdentityProviders, useAuthLogin } from "@unifyapps/app-builder-sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

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

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-[416px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border bg-background px-8 py-10 shadow-sm">
      {children}
    </div>
  );
}

function CardHeading() {
  return (
    <h1 className="mb-8 text-center font-serif text-2xl font-medium text-foreground">
      Log in to your account
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
      <main className="flex min-h-screen items-center justify-center bg-muted/30">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
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
            submitLogin(passwordIdp.id!, {
              username,
              password,
              rememberMe: true,
            })
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

  return (
    <AuthCard>
      <CardHeading />
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(username, password);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">
            {(idp.uiConfig?.form?.usernameLabel as string | undefined) ??
              "Username"}
          </Label>
          <Input
            id="username"
            autoFocus
            autoComplete="username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="-mt-2 flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Forgot password?
          </Link>
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
