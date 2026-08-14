import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getProduct as getStaticProduct } from "@/data/products";
import { getStoreProductsFresh } from "@/lib/products";
import { LoginForm } from "../../login-form";
import { AdminShell } from "../../_components/admin-shell";
import { DetailsForm } from "../_components/details-form";
import { PricingForm } from "../_components/pricing-form";
import { StockForm } from "../_components/stock-form";
import { ImageUploader } from "../_components/image-uploader";

export const dynamic = "force-dynamic";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await isAdminAuthenticated())) {
    return <LoginForm />;
  }

  const { slug } = await params;
  if (!getStaticProduct(slug)) notFound();
  const product = (await getStoreProductsFresh()).find((p) => p.slug === slug);
  if (!product) notFound();

  return (
    <AdminShell
      title={product.name}
      subtitle={`${product.audience} package · /product/${product.slug}`}
      actions={
        <Link
          href="/admin/products"
          className="border border-night/20 px-4 py-2 text-xs uppercase tracking-wider text-night transition-colors duration-200 hover:border-night hover:bg-night hover:text-moon"
        >
          All products
        </Link>
      }
    >
      <div className="space-y-6">
        <DetailsForm product={product} />
        <div className="grid gap-6 lg:grid-cols-2">
          <PricingForm product={product} />
          <StockForm product={product} />
        </div>
        <ImageUploader product={product} />
      </div>
    </AdminShell>
  );
}
