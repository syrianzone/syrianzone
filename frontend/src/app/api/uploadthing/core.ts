import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

async function requireAdmin(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) throw new UploadThingError("Server misconfigured: NEXT_PUBLIC_API_URL missing");

  const res = await fetch(`${apiBase}/user`, {
    headers: { cookie, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new UploadThingError("Unauthorized");
  const user = await res.json();
  if (user?.role !== "admin") throw new UploadThingError("Forbidden");
  return user;
}

export const ourFileRouter = {
  candidateImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const user = await requireAdmin(req);
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.ufsUrl ?? file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
