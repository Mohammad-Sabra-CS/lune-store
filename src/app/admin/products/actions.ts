"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { put } from "@vercel/blob";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getProduct as getStaticProduct } from "@/data/products";
import {
  getStoreProductsFresh,
  updateProductDetails,
  updateProductImages,
  updateProductPricing,
  updateProductStock,
} from "@/lib/products";

export interface AdminActionState {
  ok?: boolean;
  error?: string;
}

const UNAUTHORIZED: AdminActionState = { error: "Not signed in. Reload and log in again." };

function revalidateProducts(slug: string) {
  revalidateTag("products", "max"); // storefront pages
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${slug}`);
}

/** Parse a datetime-local value as Amman time (Jordan is fixed at UTC+3). */
function parseAmman(value: FormDataEntryValue | null): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const date = new Date(`${s}:00+03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const localized = z.object({
  en: z.string().trim().min(1).max(600),
  ar: z.string().trim().min(1).max(600),
});

const detailsSchema = z.object({
  name: z.string().trim().min(1).max(60),
  poetry: localized,
  character: localized,
  description: localized,
});

export async function saveProductDetails(
  slug: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  if (!(await isAdminAuthenticated())) return UNAUTHORIZED;
  if (!getStaticProduct(slug)) return { error: "Unknown product." };

  const parsed = detailsSchema.safeParse({
    name: formData.get("name"),
    poetry: { en: formData.get("poetryEn"), ar: formData.get("poetryAr") },
    character: { en: formData.get("characterEn"), ar: formData.get("characterAr") },
    description: {
      en: formData.get("descriptionEn"),
      ar: formData.get("descriptionAr"),
    },
  });
  if (!parsed.success) {
    return { error: "All fields are required (max 600 characters)." };
  }

  await updateProductDetails(slug, parsed.data);
  revalidateProducts(slug);
  return { ok: true };
}

const pricingSchema = z.object({
  basePrice: z.coerce.number().int().min(1).max(999),
  salePrice: z.coerce.number().int().min(1).max(999).nullable(),
});

export async function saveProductPricing(
  slug: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  if (!(await isAdminAuthenticated())) return UNAUTHORIZED;
  if (!getStaticProduct(slug)) return { error: "Unknown product." };

  const clearSale = formData.get("clear") === "1";
  const rawSale = String(formData.get("salePrice") ?? "").trim();
  const parsed = pricingSchema.safeParse({
    basePrice: formData.get("basePrice"),
    salePrice: clearSale || rawSale === "" ? null : rawSale,
  });
  if (!parsed.success) {
    return { error: "Prices must be whole numbers between 1 and 999 JD." };
  }

  const { basePrice, salePrice } = parsed.data;
  const saleStartsAt = clearSale ? null : parseAmman(formData.get("saleStartsAt"));
  const saleEndsAt = clearSale ? null : parseAmman(formData.get("saleEndsAt"));

  if (salePrice != null && salePrice >= basePrice) {
    return { error: "Sale price must be lower than the base price." };
  }
  if (saleStartsAt && saleEndsAt && saleEndsAt <= saleStartsAt) {
    return { error: "Sale end must be after the start." };
  }

  await updateProductPricing(slug, {
    basePrice,
    salePrice,
    saleStartsAt: salePrice == null ? null : saleStartsAt,
    saleEndsAt: salePrice == null ? null : saleEndsAt,
  });
  revalidateProducts(slug);
  return { ok: true };
}

const stockSchema = z.coerce.number().int().min(0).max(9999);

export async function saveProductStock(
  slug: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  if (!(await isAdminAuthenticated())) return UNAUTHORIZED;
  if (!getStaticProduct(slug)) return { error: "Unknown product." };

  const parsed = stockSchema.safeParse(formData.get("stock"));
  if (!parsed.success) {
    return { error: "Stock must be a whole number between 0 and 9999." };
  }

  await updateProductStock(slug, parsed.data);
  revalidateProducts(slug);
  return { ok: true };
}

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** slot: "main" replaces the card image + first gallery slot; "1"/"2" replace
 *  the remaining gallery slots. */
export async function replaceProductImage(
  slug: string,
  slot: "main" | "1" | "2",
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  if (!(await isAdminAuthenticated())) return UNAUTHORIZED;
  if (!getStaticProduct(slug)) return { error: "Unknown product." };
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      error:
        "Image storage is not configured (missing BLOB_READ_WRITE_TOKEN). Uploads work once the Vercel Blob store is set up.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file first." };
  }
  const ext = IMAGE_TYPES[file.type];
  if (!ext) {
    return { error: "Only JPEG, PNG or WebP images are allowed." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Image is too large — 4 MB maximum." };
  }

  const product = (await getStoreProductsFresh()).find((p) => p.slug === slug);
  if (!product) return { error: "Unknown product." };

  let url: string;
  try {
    const blob = await put(`products/${slug}-${slot}-${Date.now()}.${ext}`, file, {
      access: "public",
    });
    url = blob.url;
  } catch (err) {
    console.error("[admin] blob upload failed:", err);
    return { error: "Upload failed. Please try again." };
  }

  const gallery = [...product.gallery];
  while (gallery.length < 3) gallery.push(product.image);
  if (slot === "main") {
    gallery[0] = url;
    await updateProductImages(slug, { image: url, gallery });
  } else {
    gallery[Number(slot)] = url;
    await updateProductImages(slug, { gallery });
  }
  revalidateProducts(slug);
  return { ok: true };
}
