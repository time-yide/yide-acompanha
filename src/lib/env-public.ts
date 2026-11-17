// Variáveis NEXT_PUBLIC_* pro navegador, SEM zod. O `env` de ./env valida com
// zod, e como o client do Supabase do browser é usado em quase toda página, o
// zod inteiro (~90KB gzip) ia pro JS inicial de todo mundo. Aqui é a mesma
// checagem, feita à mão. Cada `process.env.X` precisa ser escrito literalmente
// pro Next conseguir embutir o valor no bundle.

function required(name: string, value: string | undefined, minLength = 1): string {
  if (!value || value.length < minLength) {
    console.error(`❌ Invalid client environment variables: ${name}`);
    throw new Error("Invalid environment variables");
  }
  return value;
}

export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    20,
  ),
  NEXT_PUBLIC_APP_URL: required("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
};
