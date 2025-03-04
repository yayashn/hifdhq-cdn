import { q as QCF2 } from "./QCF2/quran-data"
import { q as QCF_P } from "./QCF_P/quran-data"

export const fonts = {
    QCF2,
    QCF_P
} as const;

export type QuranFont = keyof typeof fonts;