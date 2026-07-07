export const DUBBING_LANGUAGES = [
  { code: "bn-IN", name: "Bengali" },
  { code: "en-IN", name: "English" },
  { code: "gu-IN", name: "Gujarati" },
  { code: "hi-IN", name: "Hindi" },
  { code: "kn-IN", name: "Kannada" },
  { code: "ml-IN", name: "Malayalam" },
  { code: "mr-IN", name: "Marathi" },
  { code: "od-IN", name: "Odia" },
  { code: "pa-IN", name: "Punjabi" },
  { code: "ta-IN", name: "Tamil" },
  { code: "te-IN", name: "Telugu" },
] as const;

export type DubbingLanguageCode = (typeof DUBBING_LANGUAGES)[number]["code"];
