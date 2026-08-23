import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const cafe = await prisma.category.findUnique({ where: { slug: "cafe" } });
  const doctor = await prisma.category.findUnique({ where: { slug: "doctor-appointment" } });

  if (!cafe) {
    console.log("No category with slug 'cafe' found. Nothing to do.");
    return;
  }

  if (doctor) {
    console.log("Found both 'cafe' and 'doctor-appointment' categories. Migrating businesses and deleting 'cafe'...");
    // Move businesses from cafe -> doctor
    const updated = await prisma.business.updateMany({ where: { categoryId: cafe.id }, data: { categoryId: doctor.id } });
    console.log(`Updated ${updated.count} businesses to use 'doctor-appointment' category.`);
    // Delete the cafe category
    await prisma.category.delete({ where: { id: cafe.id } });
    console.log("Deleted the old 'cafe' category.");
  } else {
    console.log("Found 'cafe' category but no 'doctor-appointment' category. Renaming 'cafe' to 'doctor-appointment'...");
    await prisma.category.update({
      where: { id: cafe.id },
      data: { slug: "doctor-appointment", name: "Doctor Appointment", icon: "🩺" },
    });
    console.log("Renamed 'cafe' -> 'doctor-appointment'.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
