import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "MyGolf-Digital — Member Onboarding Guide",
  description: "Welcome to MyGolf-Digital",
}

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
