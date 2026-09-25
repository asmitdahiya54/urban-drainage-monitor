import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AuthCard, Field, FormAlert, SubmitButton } from "@/components/AuthForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/api";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create Account | Urban Drainage Monitor" },
      {
        name: "description",
        content:
          "Create a free resident account to report blocked drains and waterlogging, and follow what happens next.",
      },
      { property: "og:title", content: "Create Account | Urban Drainage Monitor" },
      {
        property: "og:description",
        content: "Join the community keeping city drains clear and streets flood-free.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

type Errors = { name?: string; email?: string; password?: string; confirm?: string };

function RegisterPage() {
  const { register, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated && !submitting && !success) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, isAuthenticated, submitting, success, navigate]);

  function validate(): Errors {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = "Enter your full name (at least 2 characters)";
    if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(email.trim()))
      next.email = "Enter a valid email address";
    if (password.length < 8) next.password = "Use at least 8 characters";
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
      next.password = "Include at least one letter and one number";
    if (confirm !== password) next.confirm = "Passwords do not match";
    return next;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await register(name, email, password);
      setSuccess("Account created. Taking you to your dashboard…");
      setTimeout(() => navigate({ to: "/dashboard", replace: true }), 700);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        if (error.field) setErrors({ [error.field]: error.message } as Errors);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-14 sm:py-20">
        <AuthCard
          title="Create account"
          subtitle="Resident accounts are free. Every new account is a citizen account."
          footer={
            <>
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {formError && <FormAlert tone="error">{formError}</FormAlert>}
            {success && <FormAlert tone="success">{success}</FormAlert>}
            <Field
              id="name"
              label="Name"
              value={name}
              onChange={setName}
              error={errors.name}
              autoComplete="name"
              placeholder="John Doe"
              disabled={submitting}
            />
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
              autoComplete="new-password"
              placeholder="At least 8 characters"
              disabled={submitting}
            />
            <Field
              id="confirm"
              label="Confirm Password"
              type="password"
              value={confirm}
              onChange={setConfirm}
              error={errors.confirm}
              autoComplete="new-password"
              placeholder="Repeat your password"
              disabled={submitting}
            />
            <SubmitButton loading={submitting}>Create Account</SubmitButton>
          </form>
        </AuthCard>
      </main>
      <SiteFooter />
    </div>
  );
}
