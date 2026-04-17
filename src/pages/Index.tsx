import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Clock, Flame, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientLayout from '@/components/client/ClientLayout';
import { fetchPublicMenu, formatPriceFromCents } from '@/lib/menu-api';
import paniniImage from '@/assets/home/panini.png';
import ravierBoloImage from '@/assets/home/ravier_bolo.png';
import ravierCremeImage from '@/assets/home/ravier_creme.png';
import ravierOrangeImage from '@/assets/home/ravier_orange.png';

interface FeaturedProductCard {
  id: string;
  name: string;
  description: string;
  minPriceCents: number;
}

interface SavedTrackedOrder {
  orderNumber: string;
  trackingToken: string;
  savedAt: string;
}

const LAST_TRACKED_ORDER_STORAGE_KEY = 'pasta-house-last-tracked-order';

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
  const [lastTrackedOrder, setLastTrackedOrder] = useState<SavedTrackedOrder | null>(null);
  const heroSlides = useMemo(
    () => [
      { id: 'bolo', src: ravierBoloImage, alt: 'Pâtes bolognaise en ravier' },
      { id: 'creme', src: ravierCremeImage, alt: 'Pâtes sauce crémeuse en ravier' },
      { id: 'orange', src: ravierOrangeImage, alt: 'Pâtes gratinées en ravier' },
      { id: 'panini', src: paniniImage, alt: 'Panini grillé' },
    ],
    [],
  );

  const [activeSlide, setActiveSlide] = useState(0);

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

    useEffect(() => {
    try {
      const rawValue = localStorage.getItem(LAST_TRACKED_ORDER_STORAGE_KEY);

      if (!rawValue) {
        setLastTrackedOrder(null);
        return;
      }

      const parsed = JSON.parse(rawValue);

      if (
        parsed &&
        typeof parsed.orderNumber === 'string' &&
        typeof parsed.trackingToken === 'string' &&
        typeof parsed.savedAt === 'string'
      ) {
        setLastTrackedOrder({
          orderNumber: parsed.orderNumber,
          trackingToken: parsed.trackingToken,
          savedAt: parsed.savedAt,
        });
        return;
      }

      localStorage.removeItem(LAST_TRACKED_ORDER_STORAGE_KEY);
      setLastTrackedOrder(null);
    } catch (error) {
      console.error('Failed to read last tracked order from localStorage:', error);
      setLastTrackedOrder(null);
    }
  }, []);

    useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 4200);

    return () => {
      window.clearInterval(interval);
    };
  }, [heroSlides.length]);

  const deliveryFeeLabel = useMemo(
    () => formatPriceFromCents(deliveryFeeCents),
    [deliveryFeeCents],
  );

    function goToPreviousSlide() {
    setActiveSlide((current) => (current === 0 ? heroSlides.length - 1 : current - 1));
  }

  function goToNextSlide() {
    setActiveSlide((current) => (current + 1) % heroSlides.length);
  }

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

            {lastTrackedOrder && (
              <Button asChild size="lg" variant="outline" className="text-base px-8 h-12">
                <Link to={`/suivi/${lastTrackedOrder.trackingToken}`}>
                  Suivre ma commande
                </Link>
              </Button>
            )}
          </div>
                    {lastTrackedOrder && (
            <p className="mt-3 text-sm text-muted-foreground">
              Dernière commande enregistrée : {lastTrackedOrder.orderNumber}
            </p>
          )}
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" /> {openingLabel}</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> {deliveryZoneLabel}</span>
          </div>
        </div>
      </section>

      <section className="pb-4 md:pb-8 section-warm">
        <div className="container">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 text-center">
              <p className="text-xs sm:text-sm uppercase tracking-[0.22em] text-primary/70">
                Un aperçu de nos incontournables
              </p>
            </div>

            <div className="relative mx-auto overflow-hidden rounded-[24px] border border-border/40 bg-card/50 shadow-[0_16px_48px_rgba(0,0,0,0.28)]">
              <div className="relative aspect-[16/10] sm:aspect-[16/9] md:aspect-[16/8]">
                {heroSlides.map((slide, index) => (
                  <div
                    key={slide.id}
                    className={`absolute inset-0 transition-opacity duration-700 ${
                      index === activeSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <img
                      src={slide.src}
                      alt={slide.alt}
                      className={`h-full w-full object-cover object-center transition-transform duration-[4500ms] ${
                        index === activeSlide ? 'scale-[1.02]' : 'scale-100'
                      }`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/20 via-transparent to-transparent" />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={goToPreviousSlide}
                  className="absolute left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/50 md:flex"
                  aria-label="Image précédente"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={goToNextSlide}
                  className="absolute right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/50 md:flex"
                  aria-label="Image suivante"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
                  {heroSlides.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setActiveSlide(index)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        index === activeSlide ? 'w-7 bg-primary' : 'w-2 bg-white/45 hover:bg-white/70'
                      }`}
                      aria-label={`Afficher l’image ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
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