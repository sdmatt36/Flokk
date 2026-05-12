import { SignIn } from "@clerk/nextjs";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
      <SignIn forceRedirectUrl={redirect_url ?? "/home"} />
      <p className="text-xs text-center max-w-xs" style={{ color: "#999" }}>
        If Google sign-in isn&apos;t working on mobile, use the <strong>Continue with email</strong> option above.
      </p>
    </div>
  );
}
