import { SignUp } from "@clerk/nextjs";
import { FlokkWordmark } from "@/components/ui/FlokkWordmark";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
      <FlokkWordmark size={28} />
      <SignUp forceRedirectUrl="/onboarding" />
      <p className="text-xs text-center max-w-xs" style={{ color: "#999" }}>
        If Google sign-up isn&apos;t working on mobile, use the <strong>Continue with email</strong> option above.
      </p>
    </div>
  );
}
