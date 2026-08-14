import Image from "next/image";
import Link from "next/link";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getStoreProductsFresh, type StoreProduct } from "@/lib/products";
import { effectivePrice, isSoldOut } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { LoginForm } from "../login-form";
import { AdminShell } from "../_components/admin-shell";

export const dynamic = "force-dynamic";

function saleInfo(p: StoreProduct): { label: string; tone: "gold" | "muted" } | null {
  if (p.salePrice == null || p.salePrice >= p.price) return null;
  const now = new Date();
  const start = p.saleStartsAt ? new Date(p.saleStartsAt) : null;
  const end = p.saleEndsAt ? new Date(p.saleEndsAt) : null;
  const fmt = (d: Date) =>
    d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  if (start && now < start) {
    return { label: `${p.salePrice} JD · starts ${fmt(start)}`, tone: "muted" };
  }
  if (end && now > end) {
    return { label: `${p.salePrice} JD · ended ${fmt(end)}`, tone: "muted" };
  }
  return {
    label: end ? `${p.salePrice} JD · until ${fmt(end)}` : `${p.salePrice} JD · no end date`,
    tone: "gold",
  };
}

export default async function AdminProductsPage() {
  if (!(await isAdminAuthenticated())) {
    return <LoginForm />;
  }

  const products = await getStoreProductsFresh();

  return (
    <AdminShell title="Products" subtitle="Prices, sales, stock & images">
      <div className="overflow-x-auto border border-night/10 bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-night text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-start">Product</th>
              <th className="px-4 py-3 text-start">Audience</th>
              <th className="px-4 py-3 text-end">Price</th>
              <th className="px-4 py-3 text-start">Sale</th>
              <th className="px-4 py-3 text-end">Stock</th>
              <th className="px-4 py-3 text-end">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-night/10">
            {products.map((product) => {
              const { onSale } = effectivePrice(product);
              const sale = saleInfo(product);
              const soldOut = isSoldOut(product);
              return (
                <tr
                  key={product.slug}
                  className="transition-colors duration-200 hover:bg-night/[0.03]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-night/5">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          sizes="44px"
                          className={cn("object-cover", soldOut && "grayscale")}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-night">{product.name}</p>
                        <p className="text-xs text-muted-foreground">/{product.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 uppercase text-night/70">
                    {product.audience}
                  </td>
                  <td className="px-4 py-3 text-end font-medium tabular-nums text-night">
                    {product.price} JD
                  </td>
                  <td className="px-4 py-3">
                    {sale ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs",
                          sale.tone === "gold" && onSale
                            ? "bg-gold/20 text-night"
                            : "bg-night/5 text-muted-foreground",
                        )}
                      >
                        {sale.label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-end font-medium tabular-nums",
                      soldOut ? "text-wine" : "text-night",
                    )}
                  >
                    {soldOut ? "Sold out" : product.stock}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Link
                      href={`/admin/products/${product.slug}`}
                      className="border border-night/20 px-4 py-1.5 text-xs uppercase tracking-wider text-night transition-colors duration-200 hover:border-gold hover:bg-gold"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
