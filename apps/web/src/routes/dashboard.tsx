import { useQuery } from "@tanstack/react-query";
import { CloudUpload, Download, LogOut, ShieldCheck, Trash2, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { getServerUrl, trpc } from "@/utils/trpc";
import { DUBBING_LANGUAGES } from "@dubbed-i/api/dubbing-languages";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@dubbed-i/ui/components/alert-dialog";
import { Button, buttonVariants } from "@dubbed-i/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dubbed-i/ui/components/card";
import { Input } from "@dubbed-i/ui/components/input";
import { Label } from "@dubbed-i/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dubbed-i/ui/components/select";
import { env } from "@dubbed-i/env/web";
import { cn } from "@dubbed-i/ui/lib/utils";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;

  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export default function Dashboard() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("hi-IN");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<{
    key: string;
    fileName: string;
  } | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const accountStatus = useQuery({
    ...trpc.getMyAccountStatus.queryOptions(),
    enabled: !!session,
  });
  const uploads = useQuery({
    ...trpc.listUploadedVideos.queryOptions(),
    enabled: accountStatus.data?.isApproved === true,
  });

  useEffect(() => {
    if (!session && !isSessionPending) navigate("/login");
  }, [session, isSessionPending, navigate]);

  useEffect(() => {
    if (accountStatus.data?.isAdmin) navigate("/admin", { replace: true });
  }, [accountStatus.data?.isAdmin, navigate]);

  const handleSignOut = () => {
    authClient.signOut({ fetchOptions: { onSuccess: () => navigate("/") } });
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Choose a video file first");
      return;
    }

    const formData = new FormData();
    formData.append("video", selectedFile);
    formData.append("languageCode", selectedLanguage);
    setIsUploading(true);

    try {
      const response = await fetch(`${getServerUrl(env.VITE_SERVER_URL)}/api/videos/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const payload = (await response.json()) as {
        message?: string;
        fileName?: string;
      };
      if (!response.ok) throw new Error(payload.message ?? "Upload failed");

      toast.success(`Uploaded ${payload.fileName ?? selectedFile.name}`);
      resetUploadForm();
      await uploads.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteVideo = async () => {
    if (!videoToDelete) return;
    setDeletingKey(videoToDelete.key);

    try {
      const response = await fetch(
        `${getServerUrl(env.VITE_SERVER_URL)}/api/videos?key=${encodeURIComponent(videoToDelete.key)}`,
        { method: "DELETE", credentials: "include" },
      );
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Delete failed");

      toast.success(`Deleted ${videoToDelete.fileName}`);
      setVideoToDelete(null);
      await uploads.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeletingKey(null);
    }
  };

  if (isSessionPending || !session || accountStatus.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Initializing workspace…
      </div>
    );
  }

  if (accountStatus.data?.isAdmin) return null;

  if (accountStatus.data && !accountStatus.data.isApproved) {
    const isRejected = accountStatus.data.approvalStatus === "rejected";

    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border px-5 py-5 sm:px-8">
          <div className="mx-auto max-w-5xl text-lg font-semibold tracking-[-0.045em]">
            Dubbed.ai
          </div>
        </header>
        <main className="flex items-center justify-center px-6 py-16 sm:py-24">
          <Card className="w-full max-w-md border-0 shadow-none">
            <CardHeader>
              <div className="mb-5 flex size-11 items-center justify-center rounded-full bg-muted">
                <ShieldCheck className="text-muted-foreground" aria-hidden="true" />
              </div>
              <CardTitle className="text-3xl tracking-tight">
                {isRejected ? "Access rejected" : "Approval pending"}
              </CardTitle>
              <CardDescription>
                {isRejected
                  ? "Your account request was rejected. Contact the admin if this looks incorrect."
                  : "Your account is signed in, but an admin must approve it before uploads are available."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-3 border-y border-border py-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Email</span>
                  <span className="truncate">{session.user.email}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Status</span>
                  <span className="capitalize">{accountStatus.data.approvalStatus}</span>
                </div>
              </div>
              <Button onClick={handleSignOut} variant="outline">
                <LogOut data-icon="inline-start" /> Sign out
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const uploadedVideos = uploads.data ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="text-lg font-semibold tracking-[-0.045em]">Dubbed.ai</div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <div className="min-w-0 max-w-28 text-right sm:max-w-56">
              <p className="truncate text-sm font-medium">{session.user.name}</p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {session.user.email}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut data-icon="inline-start" />
              <span className="hidden sm:inline">Sign out</span>
              <span className="sm:hidden">Exit</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="landing-enter mx-auto flex w-full max-w-5xl flex-col px-5 py-10 sm:px-8 sm:py-14">
        <section className="border-b border-border pb-7">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Your videos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {uploads.isLoading
              ? "Loading projects…"
              : `${uploadedVideos.length} ${uploadedVideos.length === 1 ? "project" : "projects"}`}
          </p>
        </section>

        <section aria-labelledby="upload-heading" className="border-b border-border py-7">
          <div className="mb-5">
            <h2 id="upload-heading" className="text-sm font-semibold">
              Upload a video
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose a source and its output language.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.65fr)]">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(11rem,0.65fr)]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="video-upload">Source video</Label>
                <Input
                  ref={fileInputRef}
                  id="video-upload"
                  type="file"
                  accept="video/*"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="language-select">Output language</Label>
                <Select
                  items={DUBBING_LANGUAGES.map((language) => ({
                    label: language.name,
                    value: language.code,
                  }))}
                  value={selectedLanguage}
                  onValueChange={(value) => value && setSelectedLanguage(value)}
                >
                  <SelectTrigger id="language-select">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {DUBBING_LANGUAGES.map((language) => (
                        <SelectItem key={language.code} value={language.code}>
                          {language.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col justify-between gap-4 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Video className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {selectedFile?.name ?? "No video selected"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedFile
                      ? `${formatBytes(selectedFile.size)} · ${selectedFile.type || "video file"}`
                      : "Select a source file to begin."}
                  </p>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
              >
                <CloudUpload data-icon="inline-start" />
                {isUploading ? "Uploading…" : "Upload video"}
              </Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="video-list-heading">
          <h2 id="video-list-heading" className="sr-only">
            Uploaded videos
          </h2>
          {uploads.isLoading ? (
            <p className="border-b border-border py-10 text-sm text-muted-foreground" role="status">
              Loading uploaded videos…
            </p>
          ) : uploadedVideos.length === 0 ? (
            <div className="border-b border-border py-12">
              <p className="text-sm font-medium">No videos yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Your uploaded videos will appear here.
              </p>
            </div>
          ) : (
            <ul>
              {uploadedVideos.map((upload) => {
                const uploadedAt = new Date(upload.uploadedAt);

                return (
                  <li
                    key={upload.key}
                    className="grid gap-5 border-b border-border py-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{upload.fileName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatBytes(upload.size)}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{upload.languageName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{upload.status}</span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={uploadedAt.toISOString()}>
                          {uploadedAt.toLocaleString()}
                        </time>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        href={`${getServerUrl(env.VITE_SERVER_URL)}/api/videos/download?key=${encodeURIComponent(upload.key)}`}
                      >
                        <Download data-icon="inline-start" /> Download
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deletingKey === upload.key}
                        onClick={() =>
                          setVideoToDelete({
                            key: upload.key,
                            fileName: upload.fileName,
                          })
                        }
                      >
                        <Trash2 data-icon="inline-start" />
                        {deletingKey === upload.key ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <AlertDialog
        open={videoToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingKey) setVideoToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete video?</AlertDialogTitle>
            <AlertDialogDescription>
              {videoToDelete
                ? `This will permanently remove ${videoToDelete.fileName} from your dashboard and storage.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingKey !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deletingKey !== null} onClick={handleDeleteVideo}>
              {deletingKey !== null ? "Deleting…" : "Delete video"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
