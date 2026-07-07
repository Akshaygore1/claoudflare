import { Link } from "react-router";

import { Button } from "@dubbed-i/ui/components/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md space-y-4 border border-border p-8 text-center">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">404</div>
        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The requested page does not exist or is no longer available.
        </p>
        <Link to="/">
          <Button variant="outline" className="w-full rounded-none text-xs">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
