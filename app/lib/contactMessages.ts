// Messages sent through the Contact page form. Like featured listings (lib/featuredStore.ts), they
// live in the Postgres `contact_messages` table when DATABASE_URL is set, and otherwise (or when
// CONTACT_STORE_PATH is set, in tests) in a git-ignored JSON file. Admins read them on /admin.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { type ContactMessage, type NewContactMessage } from "./contactForm";
import { db } from "./db";

function storedInDatabase() {
  return !process.env.CONTACT_STORE_PATH && Boolean(db());
}

function storePath() {
  return process.env.CONTACT_STORE_PATH ?? path.join(process.cwd(), "data", "contact-messages.json");
}

async function readAll(): Promise<ContactMessage[]> {
  try {
    return JSON.parse(await readFile(storePath(), "utf8")) as ContactMessage[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

type Row = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  message: string;
  created_at: Date;
};

function fromRow(row: Row): ContactMessage {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createContactMessage(input: NewContactMessage) {
  if (storedInDatabase()) {
    const [row] = await db()!<Row[]>`
      insert into contact_messages ${db()!({
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        phone: input.phone,
        message: input.message,
      })}
      returning *`;
    return fromRow(row);
  }

  const messages = await readAll();
  const message: ContactMessage = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  messages.push(message);
  await mkdir(path.dirname(storePath()), { recursive: true });
  await writeFile(storePath(), JSON.stringify(messages, null, 2));
  return message;
}

// Newest first.
export async function listContactMessages() {
  if (storedInDatabase()) return (await db()!<Row[]>`select * from contact_messages order by created_at desc`).map(fromRow);
  return (await readAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteContactMessage(id: string) {
  if (storedInDatabase()) {
    await db()!`delete from contact_messages where id::text = ${id}`;
    return;
  }
  const messages = await readAll();
  await writeFile(storePath(), JSON.stringify(messages.filter((message) => message.id !== id), null, 2));
}
