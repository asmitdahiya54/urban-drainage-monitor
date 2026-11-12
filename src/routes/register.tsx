import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Sign In | Urban Drainage Monitor" },
      {
        name: "description",
        content:
          "Sign in with Google to report blocked drains and waterlogging, and follow what happens next.",
      },
      { property: "og:title", content: "Sign In | Urban Drainage Monitor" },
      {
        property: "og:description",
        content: "Access Drainage Watch with your Google account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/login", replace: true });
  },
});
