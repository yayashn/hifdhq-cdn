import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import path from "path";

if (process.argv.length < 3) {
  console.error("Please provide the directory path as an argument");
  process.exit(1);
}

const directoryPath = process.argv[2];

interface WordDB {
  word_index: number;
  word_key: string;
  text: string;
}

interface LineDB {
  page_number: number;
  line_number: number;
  line_type: "surah_name" | "ayah" | "basmala";
  is_centered: number;
  first_word_id: number | null;
  last_word_id: number | null;
  surah_number: number | null;
}

interface Word {
  word_index: number;
  word_key: string;
  text: string;
}

interface Line {
  line_number: number;
  line_type: "surah_name" | "ayah" | "basmala";
  is_centered: number;
  surah_number: number | null;
  words: Word[] | null;
}

interface Page {
  page_number: number;
  lines: Line[];
}

const renameFonts = async (fontPath: string, folderName: string) => {
  try {
    const files = fs.readdirSync(fontPath).filter(f => f.toLowerCase().endsWith('.ttf'));
    
    for (const file of files) {
      try {
        const number = file.split('p')[1].split('.')[0];
        const pageNumber = String(parseInt(number)).padStart(3, '0');
        const newName = `${folderName}${pageNumber}.ttf`;
        
        const oldPath = path.join(fontPath, file);
        const newPath = path.join(fontPath, newName);
        
        if (oldPath !== newPath) {
          fs.renameSync(oldPath, newPath);
          console.log(`Renamed: ${file} -> ${newName}`);
        }
      } catch (e) {
        console.error(`Error processing ${file}:`, e);
      }
    }
  } catch (e) {
    console.error('Error processing fonts:', e);
  }
};

const main = async () => {
  try {
    const pagesDbPath = path.resolve(directoryPath, "pages.sqlite");
    const wordsDbPath = path.resolve(directoryPath, "words.sqlite");
    const outputPath = path.resolve(directoryPath, "quran-data.ts");

    if (!fs.existsSync(pagesDbPath)) {
      throw new Error(`Pages database not found at: ${pagesDbPath}`);
    }
    if (!fs.existsSync(wordsDbPath)) {
      throw new Error(`Words database not found at: ${wordsDbPath}`);
    }

    const pagesDb = await open({
      filename: pagesDbPath,
      driver: sqlite3.Database,
    });

    const wordsDb = await open({
      filename: wordsDbPath,
      driver: sqlite3.Database,
    });

    const pages = await pagesDb.all<LineDB[]>(
      "SELECT * FROM pages ORDER BY page_number, line_number"
    );

    const words = await wordsDb.all<WordDB[]>(
      "SELECT * FROM words ORDER BY word_index"
    );

    const wordsMap = new Map(words.map((word) => [word.word_index, word]));

    const groupedPages = pages.reduce((acc, line) => {
      const pageNum = line.page_number;
      if (!acc[pageNum]) {
        acc[pageNum] = {
          page_number: pageNum,
          lines: [],
        };
      }

      let lineWords: Word[] | null = null;
      
      if (line.first_word_id !== null && line.last_word_id !== null) {
        lineWords = [];
        for (let i = line.first_word_id; i <= line.last_word_id; i++) {
          const word = wordsMap.get(i);
          if (word) {
            lineWords.push(word);
          }
        }
      }

      const lineOutput: Line = {
        line_number: line.line_number,
        line_type: line.line_type,
        is_centered: line.is_centered,
        surah_number: line.surah_number,
        words: lineWords,
      };

      acc[pageNum].lines.push(lineOutput);

      return acc;
    }, {} as Record<number, Page>);

    const quranData = Object.values(groupedPages).sort(
      (a, b) => a.page_number - b.page_number
    );

    const output = `export const q=${JSON.stringify(quranData)};`;

    fs.writeFileSync(outputPath, output);

    await pagesDb.close();
    await wordsDb.close();

    // After generating quran-data.ts, process the fonts
    const fontPath = path.join(directoryPath, 'font');
    if (fs.existsSync(fontPath)) {
      const folderName = path.basename(directoryPath);
      await renameFonts(fontPath, folderName);
    }

    console.log(`Successfully generated quran-data.ts at: ${outputPath}`);
  } catch (error) {
    console.error("Error generating Quran data:", error);
    process.exit(1);
  }
};

main();
