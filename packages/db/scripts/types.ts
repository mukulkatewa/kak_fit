export type WgerPaginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type WgerExerciseInfo = {
  id: number;
  uuid: string;
  category: { id: number; name: string };
  muscles: Array<{ id: number; name: string; name_en?: string }>;
  muscles_secondary: Array<{ id: number; name: string; name_en?: string }>;
  equipment: Array<{ id: number; name: string }>;
  images: Array<{ image: string; is_main: boolean }>;
  translations: Array<{
    name: string;
    description: string;
    language: number;
  }>;
};
