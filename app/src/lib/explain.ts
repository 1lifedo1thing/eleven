const ARCH: Readonly<Record<string, string>> = {
  arm64e: "Apple Silicon code with signed pointers. Runs on M-series Macs and recent iPhones.",
  arm64: "64-bit ARM code, as on Apple Silicon Macs, iPhones and most Android phones.",
  x86_64: "64-bit Intel and AMD code. On Apple Silicon it runs through Rosetta.",
  i386: "32-bit Intel code, from older Macs and PCs.",
  armv7: "32-bit ARM code, from older phones and devices.",
  arm: "32-bit ARM code, from older phones and devices.",
};

/** What a CPU architecture name means, in a sentence. */
export function explainArch(arch: string): string {
  return ARCH[arch] ?? `The processor this code is built for: ${arch}.`;
}
