import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Play, Square, Upload, Globe, Volume2 } from "lucide-react";
import { Button } from "@dubbed-i/ui/components/button";
import { authClient } from "@/lib/auth-client";
import type { Route } from "./+types/_index";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Dubbed.ai - AI Video Dubbing Platform" },
    {
      name: "description",
      content:
        "Dub your video into 30 languages. Upload a file, pick a language, we clone your voice and translate the audio.",
    },
  ];
}

const LANGUAGES = [
  {
    code: "en",
    name: "English (Original)",
    subtitle:
      "Hey everyone! Today I want to show you how our AI dubbing engine clones my exact voice...",
  },
  {
    code: "es",
    name: "Spanish",
    subtitle:
      "¡Hola a todos! Hoy quiero mostrarles cómo nuestro motor de doblaje de IA clona mi voz exacta...",
  },
  {
    code: "ja",
    name: "Japanese",
    subtitle:
      "皆さん、こんにちは！今日は、当社のAIダビングエンジンが私の正確な声をどのようにクローンするかをお見せしたいと思います...",
  },
  {
    code: "fr",
    name: "French",
    subtitle:
      "Bonjour à tous ! Aujourd'hui, je veux vous montrer comment notre moteur de doublage IA clone ma voix exacte...",
  },
];

export default function Home() {
  const { data: session } = authClient.useSession();
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Simulated video playback progress
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1.5;
        });
      }, 100);
    } else {
      if (progress >= 100) setProgress(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, progress]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-foreground selection:text-background flex flex-col">
      {/* Ultra-minimal header */}
      <header className="px-6 py-6 flex items-center justify-between border-b border-border/50">
        <div className="font-semibold tracking-tight text-lg">Dubbed.ai</div>
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex gap-6">
          <Link
            to={session ? "/dashboard" : "/login"}
            className="hover:text-foreground transition-colors"
          >
            {session ? " Workspace " : " Login "}
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 md:py-24">
        {/* Title Group */}
        <div className="text-center space-y-6 max-w-2xl mb-16">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-medium tracking-tighter leading-[1.05]">
            Dub your video into <br className="hidden sm:block" />
            30 languages.
          </h1>
          <p className="text-muted-foreground text-sm md:text-base font-mono max-w-xl mx-auto leading-relaxed">
            Upload a file. Pick a language. We clone your voice and translate the audio. No
            lip-sync, just perfect voice translation.
          </p>
        </div>

        {/* The Minimal Video Placeholder */}
        <div className="w-full max-w-4xl border border-border bg-muted/10 relative flex flex-col">
          {/* Main 16:9 Screen Area */}
          <div className="w-full aspect-video flex flex-col items-center justify-center relative overflow-hidden group">
            {/* Visualizer / Center Play Control */}
            {isPlaying ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <Volume2 className="w-12 h-12 text-muted-foreground animate-pulse mb-4" />
                <div className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
                  Processing Audio
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsPlaying(true)}
                className="flex flex-col items-center gap-4 text-muted-foreground hover:text-foreground transition-colors z-10"
              >
                <Play className="w-16 h-16 stroke-[1]" />
                <span className="font-mono text-[10px] uppercase tracking-widest">Play Sample</span>
              </button>
            )}

            {/* Captions Overlay */}
            {isPlaying && (
              <div className="absolute bottom-12 left-0 right-0 flex justify-center px-8 z-10 pointer-events-none">
                <div className="bg-background/90 border border-border px-6 py-3 max-w-2xl backdrop-blur-sm">
                  <span className="font-medium text-base md:text-lg leading-snug">
                    {selectedLang.subtitle}
                  </span>
                </div>
              </div>
            )}

            {/* Subdued Progress Bar fixed to bottom of video area */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-border/50">
              <div
                className="h-full bg-foreground transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Bottom Control Bar */}
          <div className="h-16 border-t border-border bg-background flex items-center px-6 justify-between shrink-0">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center w-6 h-6"
              >
                {isPlaying ? (
                  <Square className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
              </button>
              <div className="text-xs font-mono text-muted-foreground">
                00:
                {Math.floor(progress / 10)
                  .toString()
                  .padStart(2, "0")}{" "}
                <span className="opacity-40">/ 00:10</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-muted-foreground hidden sm:block" />
              <select
                className="bg-transparent text-sm font-mono uppercase tracking-wider outline-none cursor-pointer hover:text-muted-foreground transition-colors appearance-none pr-4"
                value={selectedLang.code}
                onChange={(e) => {
                  const lang = LANGUAGES.find((l) => l.code === e.target.value) || LANGUAGES[0];
                  setSelectedLang(lang);
                  setProgress(0);
                  setIsPlaying(true);
                }}
              >
                {LANGUAGES.map((lang) => (
                  <option
                    key={lang.code}
                    value={lang.code}
                    className="bg-background text-foreground"
                  >
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Global CTA */}
        <div className="mt-12 flex flex-col items-center gap-4 w-full max-w-sm">
          <Link to={session ? "/dashboard" : "/login"} className="w-full">
            <Button
              size="lg"
              className="w-full rounded-none h-14 text-sm uppercase tracking-widest font-mono"
            >
              <Upload className="w-4 h-4 mr-3" />
              Select Video
            </Button>
          </Link>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            Supports MP4, MOV up to 500MB
          </div>
        </div>
      </main>
    </div>
  );
}
