import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadArchivoBlack } from "@remotion/google-fonts/ArchivoBlack";

export type FontKey = "inter" | "montserrat" | "bebas" | "oswald" | "poppins" | "roboto" | "anton" | "archivo_black";

const LOADERS: Record<FontKey, () => { fontFamily: string }> = {
  inter: loadInter,
  montserrat: loadMontserrat,
  bebas: loadBebas,
  oswald: loadOswald,
  poppins: loadPoppins,
  roboto: loadRoboto,
  anton: loadAnton,
  archivo_black: loadArchivoBlack,
};

export function getFontFamily(key: FontKey): string {
  return LOADERS[key]().fontFamily;
}
