import { Button } from "@dubbed-i/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, LogOut, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { trpc, trpcClient } from "@/utils/trpc";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export default function Admin() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  const accountStatus = useQuery({
    ...trpc.getMyAccountStatus.queryOptions(),
    enabled: !!session,
  });

  const users = useQuery({
    ...trpc.listUsersForApproval.queryOptions(),
    enabled: accountStatus.data?.isAdmin === true,
  });

  useEffect(() => {
    if (!session && !isSessionPending) {
      navigate("/login");
    }
  }, [session, isSessionPending, navigate]);

  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate("/");
        },
      },
    });
  };

  const updateUserStatus = async (userId: string, action: "approve" | "delete") => {
    setActiveUserId(userId);
    try {
      if (action === "approve") {
        await trpcClient.approveUser.mutate({ userId });
        toast.success("User approved");
      } else {
        await trpcClient.deleteUser.mutate({ userId });
        toast.success("User deleted");
      }

      await users.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActiveUserId(null);
    }
  };

  if (isSessionPending || !session || accountStatus.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground text-sm font-mono uppercase tracking-widest">
        Loading Admin Console...
      </div>
    );
  }

  if (!accountStatus.data?.isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="w-full max-w-md border border-border p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold">Admin Access Required</h1>
          <p className="text-sm text-muted-foreground">
            This page is only available to approved admin users.
          </p>
          <Link to="/dashboard">
            <Button variant="outline" className="w-full rounded-none text-xs">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="text-sm font-bold leading-none">Admin Console</div>
              <div className="text-xs text-muted-foreground mt-1">Review platform access</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3 w-3 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">User Approvals</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Approve access requests or permanently delete user accounts.
          </p>
        </div>

        <div className="border border-border overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-[1.5fr_1fr_0.8fr_1fr] gap-4 border-b border-border bg-muted/20 p-4 text-xs font-semibold tracking-widest uppercase text-muted-foreground">
            <div>User</div>
            <div>Status</div>
            <div>Role</div>
            <div className="text-right">Actions</div>
          </div>

          {users.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading users...</div>
          ) : users.data?.length ? (
            <div className="divide-y divide-border">
              {users.data.map((user) => {
                const isBusy = activeUserId === user.id;
                const isCurrentUser = user.id === session.user.id;

                return (
                  <div
                    key={user.id}
                    className="grid min-w-[760px] grid-cols-[1.5fr_1fr_0.8fr_1fr] gap-4 p-4 items-center text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{user.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    </div>
                    <div>
                      <span className="inline-flex border border-border px-2 py-1 text-[10px] font-mono uppercase tracking-widest">
                        {user.approvalStatus}
                      </span>
                    </div>
                    <div className="text-xs font-mono uppercase text-muted-foreground">
                      {user.role}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-none text-xs"
                        disabled={isBusy || user.approvalStatus === "approved"}
                        onClick={() => updateUserStatus(user.id, "approve")}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-none text-xs"
                        disabled={isBusy || isCurrentUser}
                        onClick={() => updateUserStatus(user.id, "delete")}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">No users found.</div>
          )}
        </div>
      </main>
    </div>
  );
}
