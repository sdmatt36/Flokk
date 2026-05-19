import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { db } from "@/lib/db";

async function test() {
  console.log("DATABASE_URL set:", !!process.env.DATABASE_URL);
  try {
    const city = await db.city.findUnique({
      where: { slug: "sintra" },
      include: { country: { select: { name: true } } },
    });
    console.log("SUCCESS:", JSON.stringify(city));
  } catch (e: any) {
    console.error("FULL ERROR MESSAGE:\n", e.message);
    console.error("ERROR CODE:", e.code);
    console.error("ERROR META:", JSON.stringify(e.meta));
  } finally {
    await db.$disconnect();
  }
}
test();
