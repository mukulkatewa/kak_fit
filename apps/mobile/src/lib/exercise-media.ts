type ExerciseMediaPreview = {
  storageUrl: string;
  thumbnailUrl?: string | null;
};

type ExerciseWithMediaPreview = {
  imageUrl?: string | null;
  media?: readonly ExerciseMediaPreview[] | null;
};

function isWgerUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "wger.de" || hostname.endsWith(".wger.de");
  } catch {
    return false;
  }
}

export function safeExerciseImageUrl(url?: string | null) {
  if (!url || isWgerUrl(url)) return null;
  return url;
}

export function getExerciseMediaUrl(exercise?: ExerciseWithMediaPreview | null) {
  const media = exercise?.media?.[0];
  if (media) return media.thumbnailUrl ?? media.storageUrl;
  return safeExerciseImageUrl(exercise?.imageUrl);
}
