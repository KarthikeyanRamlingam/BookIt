import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../config/db";
import { signToken } from "../utils/jwt";
import { ApiError } from "../middleware/errorHandler";

type Tx = Prisma.TransactionClient;

const googleOAuthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7).optional(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleAuthSchema = z.object({
  credential: z.string().min(10), // Google ID token (JWT)
});

const registerBusinessSchema = z.object({
  ownerName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7).optional(),
  password: z.string().min(6),
  businessName: z.string().min(2),
  categorySlug: z.string().min(2),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  mapUrl: z.string().optional(),
  businessPhone: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  workingDays: z.array(z.number().min(0).max(6)).optional(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  checkInBeforeMinutes: z.number().min(0).max(120).optional(),
  gracePeriodMinutes: z.number().min(0).max(60).optional(),
  autoNoShow: z.boolean().optional(),
});

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const existing = await prisma.business.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    suffix++;
  }
}

export async function register(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ApiError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, phone: data.phone, passwordHash, role: "CUSTOMER" },
  });

  const token = signToken({ userId: user.id, role: user.role });
  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user && data.email === process.env.ADMIN_EMAIL && data.password === process.env.ADMIN_PASSWORD) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const admin = await prisma.user.create({
      data: { name: "Platform Administrator", email: data.email, passwordHash, role: "PLATFORM_ADMIN" },
    });
    const token = signToken({ userId: admin.id, role: admin.role });
    return res.json({ token, user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  }
  if (!user) throw new ApiError(401, "Invalid email or password");

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid email or password");

  const token = signToken({ userId: user.id, role: user.role });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}

/**
 * Real Google Sign-In:
 * Receives the Google credential (ID token) from Google Identity Services,
 * verifies it using google-auth-library, extracts the verified Gmail address,
 * then creates or signs in the user.
 */
export async function googleLogin(req: Request, res: Response) {
  const { credential } = googleAuthSchema.parse(req.body);

  // Verify the ID token with Google's public keys
  let payload: any;
  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(401, "Invalid Google credential. Please try signing in again.");
  }

  if (!payload?.email || !payload?.email_verified) {
    throw new ApiError(401, "Google account email is not verified.");
  }

  const { email, name, picture, sub: googleId } = payload;

  // Find or create user account
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const randomPassword = Math.random().toString(36).slice(-16) + "Gx!#";
    const passwordHash = await bcrypt.hash(randomPassword, 10);
    user = await prisma.user.create({
      data: {
        email,
        name: name || email.split("@")[0],
        passwordHash,
        role: "CUSTOMER",
      },
    });
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    isNewUser: false,
  });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      loyaltyPoints: true,
      ownedBusiness: { include: { settings: true, category: true } },
      staffProfile: true,
    },
  });
  if (!user) throw new ApiError(404, "User not found");
  res.json(user);
}

export async function registerBusiness(req: Request, res: Response) {
  const data = registerBusinessSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ApiError(409, "An account with this email already exists");

  const category = await prisma.category.findUnique({ where: { slug: data.categorySlug } });
  if (!category) throw new ApiError(400, `Category '${data.categorySlug}' not found`);

  const passwordHash = await bcrypt.hash(data.password, 10);
  const slug = await uniqueSlug(data.businessName);

  const result = await prisma.$transaction(async (tx: Tx) => {
    const owner = await tx.user.create({
      data: { name: data.ownerName, email: data.email, phone: data.phone, passwordHash, role: "ADMIN" },
    });
    const business = await tx.business.create({
      data: {
        name: data.businessName,
        slug,
        ownerId: owner.id,
        categoryId: category.id,
        description: data.description,
        address: data.address,
        phone: data.businessPhone,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
        mapUrl: data.mapUrl,
        latitude: data.latitude,
        longitude: data.longitude,
        status: "PENDING_VERIFICATION",
      },
    });
    await tx.businessSettings.create({
      data: {
        businessId: business.id,
        checkInBeforeMinutes: data.checkInBeforeMinutes ?? 30,
        gracePeriodMinutes: data.gracePeriodMinutes ?? 15,
        autoNoShow: data.autoNoShow ?? true,
      },
    });
    if (data.workingDays && data.workingDays.length > 0 && data.openTime && data.closeTime) {
      await tx.businessHours.createMany({
        data: data.workingDays.map((day) => ({
          businessId: business.id,
          dayOfWeek: day,
          startTime: data.openTime!,
          endTime: data.closeTime!,
        })),
      });
    }
    return { owner, business };
  });

  const token = signToken({ userId: result.owner.id, role: result.owner.role });
  res.status(201).json({
    token,
    user: { id: result.owner.id, name: result.owner.name, email: result.owner.email, role: result.owner.role },
    business: { id: result.business.id, name: result.business.name, slug: result.business.slug, status: result.business.status },
    message: "Business registered successfully. Pending verification by admin.",
  });
}