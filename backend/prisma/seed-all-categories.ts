import { PrismaClient, BusinessStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DateTime } from "luxon";

const prisma = new PrismaClient();

interface SeedBusinessData {
  categorySlug: string;
  categoryName: string;
  categoryIcon: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  city: string;
  state: string;
  mapUrl: string;
  phone: string;
  latitude: number;
  longitude: number;
  ownerName: string;
  ownerEmail: string;
  services: Array<{ name: string; durationMin: number; price: number; tokenFee?: number; desc?: string }>;
  staffNames: string[];
}

const BUSINESSES_TO_SEED: SeedBusinessData[] = [
  // ─── RESTAURANTS ─────────────────────────────────────────────────────────────
  {
    categorySlug: "restaurant",
    categoryName: "Restaurant",
    categoryIcon: "🍽️",
    name: "The Reservoire",
    slug: "the-reservoire-koramangala",
    description: "Cocktail bar & modern Indian bistro with lush rooftop dining and vibrant ambience.",
    address: "17th Main Rd, 5th Block, Koramangala",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=The+Reservoire+Koramangala+Bengaluru",
    phone: "+91 80 4748 3001",
    latitude: 12.9352,
    longitude: 77.6245,
    ownerName: "Sameer Joshi",
    ownerEmail: "reservoire@example.com",
    services: [
      { name: "Table for 2 (Dinner)", durationMin: 90, price: 100, tokenFee: 50 },
      { name: "Table for 4 (Family Dining)", durationMin: 90, price: 200, tokenFee: 50 },
      { name: "Rooftop Lounge Seating (Group 6+)", durationMin: 120, price: 500, tokenFee: 100 },
      { name: "Weekend Brunch Buffet", durationMin: 120, price: 1200, tokenFee: 100 },
    ],
    staffNames: ["Rohan Host", "Priya Reservation Desk"],
  },
  {
    categorySlug: "restaurant",
    categoryName: "Restaurant",
    categoryIcon: "🍽️",
    name: "Toit Brewpub",
    slug: "toit-brewpub-indiranagar",
    description: "Iconic microbrewery serving craft beers, wood-fired pizzas, and pub fare.",
    address: "100 Feet Rd, Near CMH Road, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=Toit+Indiranagar+Bengaluru",
    phone: "+91 80 4748 3002",
    latitude: 12.9719,
    longitude: 77.6412,
    ownerName: "Mukesh Sharma",
    ownerEmail: "toit@example.com",
    services: [
      { name: "Indoor High-Top (2 Guests)", durationMin: 90, price: 100, tokenFee: 50 },
      { name: "Main Dining Area (4-6 Guests)", durationMin: 120, price: 300, tokenFee: 50 },
      { name: "Brewery Tour & Tasting Session", durationMin: 60, price: 800, tokenFee: 100 },
    ],
    staffNames: ["Arjun Lead Steward", "Sneha Floor Captain"],
  },
  {
    categorySlug: "restaurant",
    categoryName: "Restaurant",
    categoryIcon: "🍽️",
    name: "Chianti Italian Ristorante",
    slug: "chianti-italian-koramangala",
    description: "Authentic Italian restaurant specializing in handmade pastas, risottos, and fine wines.",
    address: "12, 5th A Block, Koramangala",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=Chianti+Koramangala+Bengaluru",
    phone: "+91 80 4748 3003",
    latitude: 12.9341,
    longitude: 77.6219,
    ownerName: "Chef Marco Rossi",
    ownerEmail: "chianti@example.com",
    services: [
      { name: "Candlelight Dinner for 2", durationMin: 90, price: 200, tokenFee: 50 },
      { name: "Family Italian Dining (4-6)", durationMin: 120, price: 400, tokenFee: 50 },
      { name: "Chef's 5-Course Tasting Menu", durationMin: 120, price: 2200, tokenFee: 200 },
    ],
    staffNames: ["Lucia Hostess", "Vikram Head Server"],
  },
  {
    categorySlug: "restaurant",
    categoryName: "Restaurant",
    categoryIcon: "🍽️",
    name: "Truffles Ice & Spice",
    slug: "truffles-st-marks-road",
    description: "Beloved urban diner famous for gourmet burgers, pasta, steaks, and desserts.",
    address: "22, St. Marks Road, Ashok Nagar",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=Truffles+St+Marks+Road+Bengaluru",
    phone: "+91 80 4748 3004",
    latitude: 12.9716,
    longitude: 77.6012,
    ownerName: "Sunil Mathew",
    ownerEmail: "truffles@example.com",
    services: [
      { name: "Quick Lunch Seating (2 Guests)", durationMin: 60, price: 50, tokenFee: 50 },
      { name: "Diner Table (4 Guests)", durationMin: 75, price: 100, tokenFee: 50 },
    ],
    staffNames: ["Kavita Front Desk"],
  },
  {
    categorySlug: "restaurant",
    categoryName: "Restaurant",
    categoryIcon: "🍽️",
    name: "Nagarjuna Andhra Dining",
    slug: "nagarjuna-andhra-residency-road",
    description: "Famous spicy traditional Andhra banana-leaf meals, biryanis, and mutton delicacies.",
    address: "44/1, Residency Road",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=Nagarjuna+Residency+Road+Bengaluru",
    phone: "+91 80 4748 3005",
    latitude: 12.9723,
    longitude: 77.6045,
    ownerName: "Venkat Reddy",
    ownerEmail: "nagarjuna@example.com",
    services: [
      { name: "Traditional Banana Leaf Lunch", durationMin: 60, price: 100, tokenFee: 50 },
      { name: "Dinner Table Reservation (4 Guests)", durationMin: 75, price: 200, tokenFee: 50 },
    ],
    staffNames: ["Ramesh Manager", "Prasad Steward"],
  },
  {
    categorySlug: "restaurant",
    categoryName: "Restaurant",
    categoryIcon: "🍽️",
    name: "Smoke House Deli",
    slug: "smoke-house-deli-lavelle-road",
    description: "European cafe & all-day delicatessen serving wholesome breakfasts, salads, and steaks.",
    address: "52, Lavelle Road, Shanthala Nagar",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=Smoke+House+Deli+Lavelle+Road+Bengaluru",
    phone: "+91 80 4748 3006",
    latitude: 12.9691,
    longitude: 77.5983,
    ownerName: "Riya Sen",
    ownerEmail: "smokehousedeli@example.com",
    services: [
      { name: "Artisanal Breakfast Table (2 Guests)", durationMin: 60, price: 100, tokenFee: 50 },
      { name: "Gourmet Lunch / Dinner (4 Guests)", durationMin: 90, price: 250, tokenFee: 50 },
    ],
    staffNames: ["Maya Captain"],
  },

  // ─── SALONS & SPAS ───────────────────────────────────────────────────────────
  {
    categorySlug: "salon",
    categoryName: "Salon & Spa",
    categoryIcon: "💇",
    name: "Bodycraft Salon & Luxury Spa",
    slug: "bodycraft-salon-indiranagar",
    description: "Premium hair styling, advanced facials, wellness massages, and bridal makeovers.",
    address: "100 Feet Rd, HAL 2nd Stage, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=Bodycraft+Salon+Indiranagar+Bengaluru",
    phone: "+91 80 4748 3010",
    latitude: 12.9719,
    longitude: 77.6412,
    ownerName: "Manjul Gupta",
    ownerEmail: "bodycraft@example.com",
    services: [
      { name: "Signature Haircut & Blowdry", durationMin: 45, price: 1200, tokenFee: 50 },
      { name: "Aromatherapy Full Body Massage", durationMin: 60, price: 2800, tokenFee: 100 },
      { name: "Hydra-Radiance Facial", durationMin: 60, price: 2500, tokenFee: 100 },
      { name: "Keratin Hair Smoothing Treatment", durationMin: 120, price: 5500, tokenFee: 200 },
    ],
    staffNames: ["Anand Master Stylist", "Deepika Spa Therapist"],
  },
  {
    categorySlug: "salon",
    categoryName: "Salon & Spa",
    categoryIcon: "💇",
    name: "Toni & Guy Hairdressing",
    slug: "toni-and-guy-koramangala",
    description: "International award-winning salon offering bespoke haircuts, creative colouring, and hair spa.",
    address: "80 Feet Rd, 4th Block, Koramangala",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=Toni+and+Guy+Koramangala+Bengaluru",
    phone: "+91 80 4748 3011",
    latitude: 12.9352,
    longitude: 77.6245,
    ownerName: "Farhan Akhtar",
    ownerEmail: "toniandguy@example.com",
    services: [
      { name: "Creative Director Haircut", durationMin: 45, price: 1500, tokenFee: 50 },
      { name: "Balayage / Ombre Colouring", durationMin: 120, price: 6000, tokenFee: 200 },
      { name: "Moroccanoil Deep Conditioning Spa", durationMin: 60, price: 2200, tokenFee: 100 },
    ],
    staffNames: ["Neil Style Director", "Sara Colour Specialist"],
  },
  {
    categorySlug: "salon",
    categoryName: "Salon & Spa",
    categoryIcon: "💇",
    name: "Bounce Style Lounge",
    slug: "bounce-style-lounge-lavelle-road",
    description: "Trendy hair studio and grooming lounge providing precision cuts, beard grooming, and nail art.",
    address: "36, Lavelle Road",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=Bounce+Style+Lounge+Lavelle+Road+Bengaluru",
    phone: "+91 80 4748 3012",
    latitude: 12.9698,
    longitude: 77.5985,
    ownerName: "Vikram Mohan",
    ownerEmail: "bounce@example.com",
    services: [
      { name: "Men's Precision Cut & Beard Trim", durationMin: 40, price: 900, tokenFee: 50 },
      { name: "Women's Styling & Texture Wash", durationMin: 60, price: 1400, tokenFee: 50 },
      { name: "Gel Nail Extension & Art", durationMin: 75, price: 2000, tokenFee: 100 },
    ],
    staffNames: ["Karan Senior Stylist", "Pooja Nail Artist"],
  },
  {
    categorySlug: "salon",
    categoryName: "Salon & Spa",
    categoryIcon: "💇",
    name: "O2 Wellness Spa",
    slug: "o2-wellness-spa-whitefield",
    description: "Luxury day spa offering authentic Swedish massages, Thai body therapies, and foot reflexology.",
    address: "Forum Shantiniketan Mall, Whitefield",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=O2+Spa+Whitefield+Bengaluru",
    phone: "+91 80 4748 3013",
    latitude: 12.9892,
    longitude: 77.7285,
    ownerName: "Swapnil Shinde",
    ownerEmail: "o2spa@example.com",
    services: [
      { name: "Deep Tissue Muscle Therapy (60m)", durationMin: 60, price: 2999, tokenFee: 100 },
      { name: "Thai Herbal Compress Massage (90m)", durationMin: 90, price: 3800, tokenFee: 150 },
      { name: "Foot Reflexology & Scrub (45m)", durationMin: 45, price: 1500, tokenFee: 50 },
    ],
    staffNames: ["Nalini Lead Therapist", "Somchai Thai Specialist"],
  },
  {
    categorySlug: "salon",
    categoryName: "Salon & Spa",
    categoryIcon: "💇",
    name: "Green Trends Salon",
    slug: "green-trends-hsr-layout",
    description: "Family salon brand providing friendly, hygienic hair and skin services at pocket-friendly rates.",
    address: "Sector 1, 27th Main Rd, HSR Layout",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=Green+Trends+HSR+Layout+Bengaluru",
    phone: "+91 80 4748 3014",
    latitude: 12.9116,
    longitude: 77.6474,
    ownerName: "Karthik Raja",
    ownerEmail: "greentrends@example.com",
    services: [
      { name: "Haircut, Wash & Blowdry", durationMin: 30, price: 500, tokenFee: 50 },
      { name: "Herbal Fruit Facial", durationMin: 45, price: 1100, tokenFee: 50 },
      { name: "Anti-Dandruff Scalp Treatment", durationMin: 45, price: 950, tokenFee: 50 },
    ],
    staffNames: ["Vasanth Stylist", "Lakshmi Beautician"],
  },

  // ─── DOCTORS & CLINICS ───────────────────────────────────────────────────────
  {
    categorySlug: "general-practitioners",
    categoryName: "General Practitioners",
    categoryIcon: "🩺",
    name: "MediCare Family Health Clinic",
    slug: "medicare-family-health-clinic",
    description: "Complete general medical checkups, fever consultations, preventive health, and lab tests.",
    address: "14, MG Road, Central Business District",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=MediCare+Clinic+MG+Road+Bengaluru",
    phone: "+91 80 4748 3020",
    latitude: 12.9716,
    longitude: 77.5946,
    ownerName: "Dr. Ananya Rao",
    ownerEmail: "dr.ananya@example.com",
    services: [
      { name: "General Physician Consultation", durationMin: 20, price: 500, tokenFee: 50 },
      { name: "Preventive Annual Health Checkup", durationMin: 40, price: 1500, tokenFee: 100 },
      { name: "Vaccination & Immunization", durationMin: 15, price: 400, tokenFee: 50 },
    ],
    staffNames: ["Dr. Ananya Rao (MBBS, MD)"],
  },
  {
    categorySlug: "cardiologists",
    categoryName: "Cardiologists",
    categoryIcon: "❤️",
    name: "Pulse Heart & Vascular Clinic",
    slug: "pulse-heart-clinic-koramangala",
    description: "Expert cardiology consultation, ECG, 2D Echo, hypertension and lipid management.",
    address: "100 Feet Intermediate Ring Rd, Koramangala",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=Pulse+Cardiology+Koramangala+Bengaluru",
    phone: "+91 80 4748 3021",
    latitude: 12.9352,
    longitude: 77.6245,
    ownerName: "Dr. Karan Mehta",
    ownerEmail: "dr.karan@example.com",
    services: [
      { name: "Cardiology Consultation & ECG", durationMin: 30, price: 1000, tokenFee: 50 },
      { name: "2D Echocardiography Scan", durationMin: 30, price: 2200, tokenFee: 100 },
      { name: "Cardiac Risk Assessment", durationMin: 45, price: 1800, tokenFee: 100 },
    ],
    staffNames: ["Dr. Karan Mehta (DM Cardiology)"],
  },
  {
    categorySlug: "pediatricians",
    categoryName: "Pediatricians",
    categoryIcon: "👶",
    name: "LittleSprouts Child Hospital",
    slug: "littlesprouts-child-hospital",
    description: "Gentle and caring newborn care, child growth monitoring, vaccinations, and pediatric consultations.",
    address: "12th Main, HAL 2nd Stage, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=LittleSprouts+Indiranagar+Bengaluru",
    phone: "+91 80 4748 3022",
    latitude: 12.9719,
    longitude: 77.6412,
    ownerName: "Dr. Neha Iyer",
    ownerEmail: "dr.neha@example.com",
    services: [
      { name: "Pediatric Consultation", durationMin: 20, price: 700, tokenFee: 50 },
      { name: "Child Immunization & Growth Tracking", durationMin: 30, price: 900, tokenFee: 50 },
    ],
    staffNames: ["Dr. Neha Iyer (MD Pediatrics)"],
  },
  {
    categorySlug: "dentists",
    categoryName: "Dentists",
    categoryIcon: "🦷",
    name: "BrightSmile Dental & Implant Studio",
    slug: "brightsmile-dental-studio",
    description: "Painless root canals, teeth whitening, clear aligners, dental implants, and cosmetic smiles.",
    address: "48, 14th Main, HSR Layout Sector 4",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=BrightSmile+Dental+HSR+Layout+Bengaluru",
    phone: "+91 80 4748 3023",
    latitude: 12.9116,
    longitude: 77.6474,
    ownerName: "Dr. Tarun Varma",
    ownerEmail: "dr.tarun@example.com",
    services: [
      { name: "Dental Checkup & Consultation", durationMin: 20, price: 500, tokenFee: 50 },
      { name: "Ultrasonic Teeth Cleaning & Polishing", durationMin: 40, price: 1500, tokenFee: 100 },
      { name: "Laser Teeth Whitening", durationMin: 60, price: 4500, tokenFee: 150 },
    ],
    staffNames: ["Dr. Tarun Varma (MDS Orthodontics)"],
  },

  // ─── GOVERNMENT OFFICES & PUBLIC SECTOR ──────────────────────────────────────
  {
    categorySlug: "government-office",
    categoryName: "Government Office",
    categoryIcon: "🏛️",
    name: "Passport Seva Kendra",
    slug: "passport-seva-kendra-koramangala",
    description: "Official public passport service portal for new applications, renewals, and tatkaal appointments.",
    address: "80 Feet Road, 8th Block, Koramangala",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=Passport+Seva+Kendra+Koramangala+Bengaluru",
    phone: "+91 1800 258 1800",
    latitude: 12.9352,
    longitude: 77.6245,
    ownerName: "Govt Officer In-Charge",
    ownerEmail: "psk.bengaluru@gov.in",
    services: [
      { name: "Normal Passport Verification Token", durationMin: 15, price: 0, tokenFee: 50 },
      { name: "Tatkaal Fast-Track Passport Token", durationMin: 15, price: 0, tokenFee: 50 },
      { name: "Police Clearance Certificate (PCC)", durationMin: 15, price: 0, tokenFee: 50 },
    ],
    staffNames: ["Counter A (Document Officer)", "Counter B (Biometrics & Photo)"],
  },
  {
    categorySlug: "government-office",
    categoryName: "Government Office",
    categoryIcon: "🏛️",
    name: "Regional Transport Office (RTO)",
    slug: "rto-indiranagar-ka03",
    description: "Vehicle registration, driving license renewal, learner license tests, and international permits.",
    address: "BDA Complex, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=RTO+Indiranagar+Bengaluru",
    phone: "+91 80 2521 1100",
    latitude: 12.9719,
    longitude: 77.6412,
    ownerName: "RTO Administrative Officer",
    ownerEmail: "rto.indiranagar@gov.in",
    services: [
      { name: "Learner's License (LL) Online Test Token", durationMin: 20, price: 0, tokenFee: 50 },
      { name: "Driving License (DL) Skill Test Queue", durationMin: 30, price: 0, tokenFee: 50 },
      { name: "Vehicle Ownership Transfer Token", durationMin: 20, price: 0, tokenFee: 50 },
    ],
    staffNames: ["RTO Inspector Desk 1", "License Verification Desk 2"],
  },
  {
    categorySlug: "government-office",
    categoryName: "Government Office",
    categoryIcon: "🏛️",
    name: "Aadhaar Seva Kendra",
    slug: "aadhaar-seva-kendra-jayanagar",
    description: "UIDAI public center for new Aadhaar enrollment, biometric updates, address and mobile linkage.",
    address: "3rd Block, 11th Main, Jayanagar",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=Aadhaar+Seva+Kendra+Jayanagar+Bengaluru",
    phone: "+91 1947",
    latitude: 12.9254,
    longitude: 77.5937,
    ownerName: "UIDAI Center Head",
    ownerEmail: "aadhaar.jayanagar@gov.in",
    services: [
      { name: "Biometric Update (Photo/Fingerprints)", durationMin: 15, price: 0, tokenFee: 50 },
      { name: "Demographic Update (Address/Mobile/Name)", durationMin: 15, price: 0, tokenFee: 50 },
      { name: "New Aadhaar Enrolment (Free)", durationMin: 20, price: 0, tokenFee: 50 },
    ],
    staffNames: ["Operator Counter 1", "Operator Counter 2"],
  },
  {
    categorySlug: "government-office",
    categoryName: "Government Office",
    categoryIcon: "🏛️",
    name: "BBMP Citizen Service Center",
    slug: "bbmp-citizen-center-mg-road",
    description: "Municipal corporation office for property tax khata certificates, birth/death certificates, and trade licenses.",
    address: "Corporation Building, Hudson Circle, MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    mapUrl: "https://maps.google.com/?q=BBMP+Head+Office+Bengaluru",
    phone: "+91 80 2222 1188",
    latitude: 12.9716,
    longitude: 77.5946,
    ownerName: "BBMP Revenue Officer",
    ownerEmail: "bbmp.citizen@gov.in",
    services: [
      { name: "Khata Certificate & Extraction Token", durationMin: 20, price: 0, tokenFee: 50 },
      { name: "Property Tax Payment & Verification", durationMin: 15, price: 0, tokenFee: 50 },
      { name: "Birth / Death Certificate Verification", durationMin: 15, price: 0, tokenFee: 50 },
    ],
    staffNames: ["Citizen Desk 1", "Revenue Officer 2"],
  },
];

async function seed() {
  console.log("🚀 Starting Category and Business Seeding...");

  const passwordHash = await bcrypt.hash("password123", 10);
  const now = DateTime.now();

  for (const item of BUSINESSES_TO_SEED) {
    console.log(`Processing: ${item.name} (${item.categoryName})...`);

    // 1. Ensure Category exists
    const category = await prisma.category.upsert({
      where: { slug: item.categorySlug },
      update: { name: item.categoryName, icon: item.categoryIcon },
      create: { slug: item.categorySlug, name: item.categoryName, icon: item.categoryIcon },
    });

    // 2. Ensure Owner exists
    const owner = await prisma.user.upsert({
      where: { email: item.ownerEmail },
      update: { name: item.ownerName, role: "ADMIN" },
      create: {
        name: item.ownerName,
        email: item.ownerEmail,
        passwordHash,
        role: "ADMIN",
      },
    });

    // 3. Upsert Business
    const business = await prisma.business.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        description: item.description,
        address: item.address,
        city: item.city,
        state: item.state,
        mapUrl: item.mapUrl,
        phone: item.phone,
        latitude: item.latitude,
        longitude: item.longitude,
        categoryId: category.id,
        status: BusinessStatus.ACTIVE,
      },
      create: {
        name: item.name,
        slug: item.slug,
        description: item.description,
        address: item.address,
        city: item.city,
        state: item.state,
        country: "India",
        mapUrl: item.mapUrl,
        phone: item.phone,
        latitude: item.latitude,
        longitude: item.longitude,
        timezone: "Asia/Kolkata",
        ownerId: owner.id,
        categoryId: category.id,
        status: BusinessStatus.ACTIVE,
      },
    });

    // 4. Business Settings
    await prisma.businessSettings.upsert({
      where: { businessId: business.id },
      update: { checkInBeforeMinutes: 30, gracePeriodMinutes: 15, autoNoShow: true },
      create: { businessId: business.id, checkInBeforeMinutes: 30, gracePeriodMinutes: 15, autoNoShow: true },
    });

    // 5. Business Hours (Mon - Sat: 09:00 - 21:00)
    for (let day = 1; day <= 6; day++) {
      await prisma.businessHours.upsert({
        where: { businessId_dayOfWeek: { businessId: business.id, dayOfWeek: day } },
        update: { startTime: "09:00", endTime: "21:00" },
        create: { businessId: business.id, dayOfWeek: day, startTime: "09:00", endTime: "21:00" },
      });
    }

    // 6. Create Staff Profiles
    const staffProfiles = [];
    for (const sName of item.staffNames) {
      const staffEmail = `${sName.toLowerCase().replace(/[^a-z0-9]/g, "")}.${business.slug}@example.com`;
      const staffUser = await prisma.user.upsert({
        where: { email: staffEmail },
        update: { name: sName, role: "STAFF" },
        create: { name: sName, email: staffEmail, passwordHash, role: "STAFF" },
      });
      const staffProf = await prisma.staffProfile.upsert({
        where: { userId: staffUser.id },
        update: { businessId: business.id },
        create: { userId: staffUser.id, businessId: business.id },
      });
      staffProfiles.push(staffProf);
    }

    // 7. Create Services
    const createdServices = [];
    for (const s of item.services) {
      const service = await prisma.service.upsert({
        where: { id: (await prisma.service.findFirst({ where: { businessId: business.id, name: s.name } }))?.id || "00000000-0000-0000-0000-000000000000" },
        update: { durationMin: s.durationMin, price: s.price, tokenFee: s.tokenFee || 50, active: true },
        create: {
          businessId: business.id,
          name: s.name,
          durationMin: s.durationMin,
          price: s.price,
          tokenFee: s.tokenFee || 50,
          active: true,
        },
      });
      createdServices.push(service);
    }

    // 8. Generate 30 Days of Slots for each service and staff
    const businessNow = now.setZone(business.timezone);
    const slotsToCreate = [];

    for (const s of createdServices) {
      for (const st of staffProfiles) {
        for (let d = 0; d < 30; d++) {
          const day = businessNow.startOf("day").plus({ days: d });
          if (day.weekday === 7) continue; // Skip Sunday

          let cursor = day.set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
          const dayEnd = day.set({ hour: 21, minute: 0, second: 0, millisecond: 0 });

          while (cursor.plus({ minutes: s.durationMin }) <= dayEnd) {
            if (cursor > now) {
              const slotEnd = cursor.plus({ minutes: s.durationMin });
              slotsToCreate.push({
                staffId: st.id,
                serviceId: s.id,
                startTime: cursor.toJSDate(),
                endTime: slotEnd.toJSDate(),
              });
            }
            cursor = cursor.plus({ minutes: s.durationMin });
          }
        }
      }
    }

    if (slotsToCreate.length > 0) {
      const res = await prisma.slot.createMany({
        data: slotsToCreate,
        skipDuplicates: true,
      });
      console.log(`  ✓ Seeded ${res.count} slots for ${business.name}`);
    }
  }

  console.log("🎉 All categories and businesses seeded successfully!");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
