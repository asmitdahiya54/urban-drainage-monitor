import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { AuthCard } from "@/components/AuthForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/context/AuthContext";

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
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();

  // Already signed in? Continue to the role-appropriate dashboard.
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate({ to: user?.role === "admin" ? "/admin" : "/dashboard", replace: true });
    }
  }, [loading, isAuthenticated, user, navigate]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-14 sm:py-20">
        <AuthCard
          title="Sign in to Drainage Watch"
          subtitle="Use your Google account to access your dashboard."
        >
          <GoogleSignInButton label="Continue with Google" />
        </AuthCard>
      </main>
      <SiteFooter />
    </div>
  );
}
