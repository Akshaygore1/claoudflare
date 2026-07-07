import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { authClient } from "@/lib/auth-client";
import { Card } from "@dubbed-i/ui/components/card";

export default function Login() {
  const [showSignIn, setShowSignIn] = useState(true);
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (session && !isPending) {
      navigate("/dashboard", { replace: true });
    }
  }, [session, isPending, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md p-2">
        {showSignIn ? (
          <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
        ) : (
          <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
        )}
      </Card>
    </div>
  );
}
