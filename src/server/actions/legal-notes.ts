"use server";

import { prisma } from "@/lib/prisma";

interface LegalNoteInput {
  chapter: number;
  heading?: number;
  noteKey?: string;
  content: string;
}

export async function ingestLegalNotesAction(notes: LegalNoteInput[]) {
  const results = await Promise.all(
    notes.map(async (note) => {
      const existing = await prisma.legalNote.findFirst({
        where: {
          chapter: note.chapter,
          heading: note.heading || null,
          noteKey: note.noteKey || null,
        },
      });

      if (existing) {
        return prisma.legalNote.update({
          where: { id: existing.id },
          data: { content: note.content },
        });
      }

      return prisma.legalNote.create({
        data: {
          chapter: note.chapter,
          heading: note.heading || null,
          noteKey: note.noteKey || null,
          content: note.content,
        },
      });
    }),
  );

  return { count: results.length };
}

