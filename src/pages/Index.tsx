import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, MapPin, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientLayout from '@/components/client/ClientLayout';
import { fetchPublicMenu, formatPriceFromCents } from '@/lib/menu-api';

interface FeaturedProductCard {
  id: string;
  name: string;
  description: string;
  minPriceCents: number;
}

function formatHourLabel(time: string | null | undefined): string | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':');
  if (minutes === '00') return `${hours}h`;
  return `${hours}h${minutes}`;
}

export default function HomePage() {
  const [featuredPastas, setFeaturedPastas] = useState<FeaturedProductCard[]>([]);
  const [restaurantName, setRestaurantName] = useState('Pasta House');
  const [deliveryZoneLabel, setDeliveryZoneLabel] = useState('Bruxelles');
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(500);
  const [openingLabel, setOpeningLabel] = useState('20h – 01h');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadHomeMenu() {
      try {
        setLoading(true);

        const data = await fetchPublicMenu();
        if (!isMounted) return;

        const pastaCategory = data.categories.find((category) => category.slug === 'pates');

        const nextFeaturedPastas =
          (pastaCategory?.products || [])
            .filter((product) => product.isFeatured)
            .slice(0, 4)
            .map((product) => ({
              id: product.id,
              name: product.name,
              description: product.description,
              minPriceCents: Math.min(...product.variants.map((variant) => variant.priceCents)),
            }));

        const firstOpenDay = data.openingHours.find((day) => day.isOpen);
        const openLabel = formatHourLabel(firstOpenDay?.openTime);
        const closeLabel = formatHourLabel(firstOpenDay?.closeTime);

        setFeaturedPastas(nextFeaturedPastas);

        if (data.siteSettings?.restaurantName) {
          setRestaurantName(data.siteSettings.restaurantName);
        }

        if (data.deliverySettings?.deliveryZoneLabel) {
          setDeliveryZoneLabel(data.deliverySettings.deliveryZoneLabel);
        }

        if (typeof data.deliverySettings?.deliveryFeeCents === 'number') {
          setDeliveryFeeCents(data.deliverySettings.deliveryFeeCents);
        }

        if (openLabel && closeLabel) {
          setOpeningLabel(`${openLabel} – ${closeLabel}`);
        }
      } catch (error) {
        console.error('Failed to load home menu:', error);
        if (!isMounted) return;
        setFeaturedPastas([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadHomeMenu();

    return () => {
      isMounted = false;
    };
  }, []);

  const deliveryFeeLabel = useMemo(
    () => formatPriceFromCents(deliveryFeeCents),
    [deliveryFeeCents],
  );

  return (
    <ClientLayout>
      <section className="relative overflow-hidden py-24 md:py-36 hero-gradient">
        <div className="absolute top-10 left-[10%] h-64 w-64 rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute bottom-0 right-[15%] h-48 w-48 rounded-full bg-caramel/[0.06] blur-3xl" />

        <div className="container relative text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Flame className="h-3.5 w-3.5" />
            Pâtes fraîches & Paninis généreux
          </div>

          <h1 className="font-display text-5xl font-bold leading-tight md:text-7xl lg:text-8xl">
            <span className="text-gradient-terracotta">{restaurantName}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-lg text-muted-foreground md:text-xl leading-relaxed">
            Des pâtes fraîches et des paninis généreux, livrés chez vous à {deliveryZoneLabel}.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="glow-primary text-base px-8 h-12">
              <Link to="/commander">
                Commander maintenant <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" /> {openingLabel}</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> {deliveryZoneLabel}</span>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 section-warm">
        <div className="container">
          <div className="text-center">
            <h2 className="font-display text-2xl font-semibold md:text-3xl">Nos populaires</h2>
            <p className="text-muted-foreground mt-2">Découvrez les favoris de nos clients.</p>
          </div>

          {loading ? (
            <div className="mt-10 rounded-xl border border-border/40 bg-card p-4 text-sm text-muted-foreground">
              Chargement des populaires...
            </div>
          ) : (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featuredPastas.map((product) => (
                <div key={product.id} className="card-premium p-5 flex flex-col group">
                  <div className="h-1 w-12 rounded-full bg-primary/20 mb-4 group-hover:w-16 group-hover:bg-primary/40 transition-all duration-300" />
                  <h3 className="font-display text-lg font-semibold">{product.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 flex-1 leading-relaxed">{product.description}</p>
                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/40">
                    <span className="text-sm text-primary font-bold">
                      dès {formatPriceFromCents(product.minPriceCents)}
                    </span>
                    <Button asChild variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50">
                      <Link to="/commander">Choisir</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-y border-border/40 bg-card py-14">
        <div className="container grid gap-8 md:grid-cols-3 text-center">
          <div>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <span className="text-lg">🛵</span>
            </div>
            <p className="font-display text-lg font-semibold text-foreground">Livraison</p>
            <p className="text-sm text-muted-foreground mt-1">
              Partout à {deliveryZoneLabel} · Frais {deliveryFeeLabel}
            </p>
          </div>
          <div>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-olive/10">
              <span className="text-lg">🏠</span>
            </div>
            <p className="font-display text-lg font-semibold text-foreground">Retrait</p>
            <p className="text-sm text-muted-foreground mt-1">Venez chercher votre commande · Gratuit</p>
          </div>
          <div>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-caramel/10">
              <span className="text-lg">🔒</span>
            </div>
            <p className="font-display text-lg font-semibold text-foreground">Paiement sécurisé</p>
            <p className="text-sm text-muted-foreground mt-1">Par carte bancaire via Stripe</p>
          </div>
        </div>
      </section>
    </ClientLayout>
  );
}