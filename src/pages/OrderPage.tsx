import { useEffect, useMemo, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import ClientLayout from '@/components/client/ClientLayout';
import ProductCard from '@/components/client/ProductCard';
import CartDrawer from '@/components/client/CartDrawer';
import { useCart } from '@/contexts/CartContext';
import { formatPrice } from '@/config/menu';
import { fetchPublicMenu } from '@/lib/menu-api';
import type { Beverage, Category, CategorySlug, Product, PastaVariant, PaniniVariant } from '@/types';

function isCategorySlug(value: string): value is CategorySlug {
  return value === 'pates' || value === 'paninis';
}

export default function OrderPage() {
  const [activeCategory, setActiveCategory] = useState<CategorySlug>('pates');
  const [cartOpen, setCartOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [beverages, setBeverages] = useState<Beverage[]>([]);
  const [productsByCategory, setProductsByCategory] = useState<Record<CategorySlug, Product[]>>({
    pates: [],
    paninis: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { itemCount, total } = useCart();

  useEffect(() => {
    let isMounted = true;

    async function loadMenu() {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchPublicMenu();

        if (!isMounted) return;

        const nextCategories: Category[] = [];
        const nextBeverages: Beverage[] = data.beverages.map((beverage) => ({
          id: beverage.id,
          name: beverage.name,
          active: beverage.isActive,
          order: beverage.sortOrder,
        }));
        const nextProductsByCategory: Record<CategorySlug, Product[]> = {
          pates: [],
          paninis: [],
        };

        for (const category of data.categories) {
          if (!isCategorySlug(category.slug)) {
            continue;
          }

          nextCategories.push({
            id: category.id,
            slug: category.slug,
            name: category.name,
            order: category.sortOrder,
            active: category.isActive,
          });

          nextProductsByCategory[category.slug] = category.products.map((product) => {
            const variants =
              category.slug === 'pates'
                ? product.variants.map<PastaVariant>((variant) => ({
                    size: variant.code as PastaVariant['size'],
                    price: variant.priceCents / 100,
                    active: true,
                  }))
                : product.variants.map<PaniniVariant>((variant) => ({
                    formula: variant.code as PaniniVariant['formula'],
                    price: variant.priceCents / 100,
                    active: true,
                  }));

            return {
              id: product.id,
              categoryId: category.id,
              name: product.name,
              description: product.description,
              active: product.isActive,
              order: product.sortOrder,
              featured: false,
              variants,
            };
          });
        }

        nextCategories.sort((a, b) => a.order - b.order);
        nextProductsByCategory.pates.sort((a, b) => a.order - b.order);
        nextProductsByCategory.paninis.sort((a, b) => a.order - b.order);

        setCategories(nextCategories);
        setBeverages(nextBeverages);        
        setProductsByCategory(nextProductsByCategory);

        if (!nextCategories.some((category) => category.slug === activeCategory)) {
          const firstCategory = nextCategories[0];
          if (firstCategory && isCategorySlug(firstCategory.slug)) {
            setActiveCategory(firstCategory.slug);
          }
        }
      } catch (err) {
        console.error('Failed to load public menu:', err);
        if (!isMounted) return;
        setError('Impossible de charger la carte pour le moment.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadMenu();

    return () => {
      isMounted = false;
    };
  }, [activeCategory]);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.active).sort((a, b) => a.order - b.order),
    [categories],
  );

  const products = useMemo(
    () => productsByCategory[activeCategory] ?? [],
    [productsByCategory, activeCategory],
  );

  return (
    <ClientLayout>
      <div className="container py-6 pb-24">
        <h1 className="font-display text-2xl font-bold md:text-3xl">Notre carte</h1>
        <p className="text-muted-foreground text-sm mt-1">Choisissez vos plats et composez votre commande.</p>

        {loading ? (
          <div className="mt-6 rounded-xl border border-border/50 bg-card p-4 text-sm text-muted-foreground">
            Chargement de la carte...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <>
            <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {activeCategories.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => setActiveCategory(cat.slug)}
                  className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    activeCategory === cat.slug
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-card text-muted-foreground border border-border/50 hover:border-primary/30 hover:text-foreground'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  categorySlug={activeCategory}
                  beverages={beverages}
                />
              ))}
            </div>

            {!products.length && (
              <div className="mt-6 rounded-xl border border-border/50 bg-card p-4 text-sm text-muted-foreground">
                Aucun produit disponible dans cette catégorie.
              </div>
            )}
          </>
        )}
      </div>

      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/40 bg-card/95 backdrop-blur-lg p-4 animate-slide-up shadow-[0_-4px_20px_hsl(20_30%_20%/0.08)]">
          <div className="container">
            <button
              onClick={() => setCartOpen(true)}
              className="flex w-full items-center justify-between rounded-xl bg-primary px-5 py-3.5 text-primary-foreground glow-primary transition-all duration-200 active:scale-[0.98] hover:bg-terracotta-dark"
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <ShoppingBag className="h-4 w-4" />
                {itemCount} article{itemCount > 1 ? 's' : ''}
              </span>
              <span className="text-sm font-bold">{formatPrice(total)}</span>
            </button>
          </div>
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </ClientLayout>
  );
}