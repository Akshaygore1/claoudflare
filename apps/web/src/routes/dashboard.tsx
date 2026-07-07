import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  CheckCircle2,
  CloudUpload,
  Download,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { env } from "@dubbed-i/env/web";
import { DUBBING_LANGUAGES } from "@dubbed-i/api/dubbing-languages";
import { Button } from "@dubbed-i/ui/components/button";
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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dubbed-i/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@dubbed-i/ui/components/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@dubbed-i/ui/components/empty";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dubbed-i/ui/components/table";

import { getServerUrl, trpc } from "@/utils/trpc";

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

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
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
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
    if (!session && !isSessionPending) {
      navigate("/login");
    }
  }, [session, isSessionPending, navigate]);

  useEffect(() => {
    if (accountStatus.data?.isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [accountStatus.data?.isAdmin, navigate]);

  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate("/");
        },
      },
    });
  };

  const resetUploadForm = () => {
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

      if (!response.ok) {
        throw new Error(payload.message ?? "Upload failed");
      }

      toast.success(`Uploaded ${payload.fileName ?? selectedFile.name}`);
      resetUploadForm();
      setIsUploadDialogOpen(false);
      await uploads.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteVideo = async () => {
    if (!videoToDelete) {
      return;
    }

    setDeletingKey(videoToDelete.key);

    try {
      const response = await fetch(
        `${getServerUrl(env.VITE_SERVER_URL)}/api/videos?key=${encodeURIComponent(videoToDelete.key)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Delete failed");
      }

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
        Initializing workspace...
      </div>
    );
  }

  if (accountStatus.data?.isAdmin) {
    return null;
  }

  if (accountStatus.data && !accountStatus.data.isApproved) {
    const isRejected = accountStatus.data.approvalStatus === "rejected";

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <div className="flex size-10 items-center justify-center rounded-full border border-border">
              <ShieldCheck className="text-muted-foreground" />
            </div>
            <CardTitle>{isRejected ? "Access Rejected" : "Approval Pending"}</CardTitle>
            <CardDescription>
              {isRejected
                ? "Your account request was rejected. Contact the admin if this looks incorrect."
                : "Your account is signed in, but an admin must approve it before uploads are available."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Email</span>
                <span className="truncate">{session.user.email}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                <span className="uppercase">{accountStatus.data.approvalStatus}</span>
              </div>
            </div>
            <Button onClick={handleSignOut} variant="outline">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = session.user.name
    ? session.user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "US";

  const uploadedVideos = uploads.data ?? [];
  const hasUploads = uploadedVideos.length > 0;
  const selectedLanguageName =
    DUBBING_LANGUAGES.find((language) => language.code === selectedLanguage)?.name ??
    selectedLanguage;

  const renderUploadForm = () => (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="video-upload">Video File</Label>
          <Input
            ref={fileInputRef}
            id="video-upload"
            type="file"
            accept="video/*"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setSelectedFile(nextFile);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="language-select">Export Language</Label>
          <Select
            items={DUBBING_LANGUAGES.map((language) => ({
              label: language.name,
              value: language.code,
            }))}
            value={selectedLanguage}
            onValueChange={(value) => {
              if (value) {
                setSelectedLanguage(value);
              }
            }}
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

      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Video />
            </div>
            <div className="flex flex-col gap-1">
              <div className="font-medium">
                {selectedFile ? selectedFile.name : "No video selected yet"}
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedFile
                  ? `${formatBytes(selectedFile.size)} • ${selectedFile.type || "video file"}`
                  : "Supported: any browser-selectable video file."}
              </div>
            </div>
          </div>

          <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
            <CloudUpload data-icon="inline-start" />
            {isUploading ? "Uploading..." : "Upload Video"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
              {initials}
            </div>
            <div>
              <div className="font-medium">{session.user.name}</div>
              <div className="text-sm text-muted-foreground">{session.user.email}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut data-icon="inline-start" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <section className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Video Dubbing Dashboard</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Upload a source video to R2 and choose the target dubbing language for export.
          </p>
        </section>

        {!hasUploads ? (
          <Card>
            <CardHeader>
              <CardTitle>Upload Source Video</CardTitle>
              <CardDescription>
                Upload your first video to get started. After that, your videos will appear in a
                table here.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">{renderUploadForm()}</CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Uploaded Videos</CardTitle>
              <CardDescription>Files already stored in R2 for your account.</CardDescription>
              <CardAction>
                <Button size="sm" variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
                  <Plus data-icon="inline-start" />
                  Upload video
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {uploads.isLoading ? (
                <div className="py-8 text-sm text-muted-foreground">Loading uploaded videos...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Video</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadedVideos.map((upload) => (
                      <TableRow key={upload.key}>
                        <TableCell className="min-w-0 max-w-[280px]">
                          <div className="truncate font-medium">{upload.fileName}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {formatBytes(upload.size)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{upload.languageName}</div>
                          <div className="text-xs text-muted-foreground">{upload.languageCode}</div>
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {upload.status}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(upload.uploadedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              render={
                                <a
                                  href={`${getServerUrl(env.VITE_SERVER_URL)}/api/videos/download?key=${encodeURIComponent(upload.key)}`}
                                />
                              }
                            >
                              <Download data-icon="inline-start" />
                              Download
                            </Button>
                            <Button
                              variant="destructive"
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
                              {deletingKey === upload.key ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {!hasUploads ? (
          <Empty className="border border-dashed border-border bg-muted/10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Video />
              </EmptyMedia>
              <EmptyTitle>No uploaded videos yet</EmptyTitle>
              <EmptyDescription>
                Your first uploaded video will appear in the table here with download and status
                actions.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent />
          </Empty>
        ) : null}
      </main>

      {hasUploads ? (
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Video</DialogTitle>
              <DialogDescription>
                Choose another source video and the target dubbing language.
              </DialogDescription>
            </DialogHeader>
            {renderUploadForm()}
          </DialogContent>
        </Dialog>
      ) : null}

      <AlertDialog
        open={videoToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingKey) {
            setVideoToDelete(null);
          }
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
              {deletingKey !== null ? "Deleting..." : "Delete video"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
