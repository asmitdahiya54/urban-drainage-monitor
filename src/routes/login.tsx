import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { AuthCard, Field, FormAlert, SubmitButton } from "@/components/AuthForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In | Urban Drainage Monitor" },
      {
        name: "description",
        content:
          "Sign in to Urban Drainage Monitor to track the drainage issues you reported in your neighbourhood.",
      },
      { property: "og:title", content: "Sign In | Urban Drainage Monitor" },
      {
        property: "og:description",
        content: "Access your resident or municipal account on Urban Drainage Monitor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Don't show the form.
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate({ to: user?.role === "admin" ? "/admin" : "/dashboard", replace: true });
    }
  }, [loading, isAuthenticated, user, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = "Email is required";
    if (!password) nextErrors.password = "Password is required";
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const signedIn = await login(email, password);
      navigate({ to: signedIn.role === "admin" ? "/admin" : "/dashboard", replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-14 sm:py-20">
        <AuthCard
          title="Sign in"
          subtitle="Urban Drainage Monitor — residents and municipal staff."
          footer={
            <>
              Don&apos;t have an account?{" "}
              <Link to="/register" className="font-semibold text-primary hover:underline">
                Create account
              </Link>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {formError && <FormAlert tone="error">{formError}</FormAlert>}
            <Field
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              error={errors.email}
              autoComplete="email"
              placeholder="you@example.com"
              disabled={submitting}
            />
            <Field
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              error={errors.password}
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={submitting}
            />
            <SubmitButton loading={submitting}>Login</SubmitButton>
          </form>
          <GoogleSignInButton label="Continue with Google" />
        </AuthCard>
      </main>
      <SiteFooter />
    </div>
  );
}
