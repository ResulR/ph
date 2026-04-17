/* eslint-disable no-unsafe-finally */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Mail, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientLayout from '@/components/client/ClientLayout';
import { useCart } from '@/contexts/CartContext';
import { fetchPublicMenu } from '@/lib/menu-api';

const CHECKOUT_FORM_STORAGE_KEY = 'pasta-house-checkout-form';
const LAST_TRACKED_ORDER_STORAGE_KEY = 'pasta-house-last-tracked-order';

interface OrderConfirmationResponse {
  ok: boolean;
  data?: {
    orderNumber: string;
    status: string;
    fulfillmentMethod: 'delivery' | 'pickup';
    paidAt: string | null;
    stripePaymentIntentId: string | null;
    paymentConfirmed: boolean;
    createdAt: string;
    trackingToken: string;
  };
  message?: string;
  error?: string;
}

export default function OrderConfirmationPage() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id') || '';
  const orderNumber = params.get('orderNumber') || '';
  const { clearCart } = useCart();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState('');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'delivery' | 'pickup' | ''>('');
  const [trackingToken, setTrackingToken] = useState('');

  const [restaurantName, setRestaurantName] = useState('Pasta House');
  const [addressLine, setAddressLine] = useState('[Adresse à définir], Bruxelles');
  const [phone, setPhone] = useState('[À définir]');
  const [email, setEmail] = useState('[À définir]');

  useEffect(() => {
    let isMounted = true;

    async function loadPublicContactData() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await fetchPublicMenu() as any;
        if (!isMounted) return;

        if (data?.siteSettings?.restaurantName) {
          setRestaurantName(data.siteSettings.restaurantName);
        }

        const addressParts = [
          data?.siteSettings?.addressLine1,
          data?.siteSettings?.postalCode,
          data?.siteSettings?.city,
        ].filter(Boolean);

        if (addressParts.length > 0) {
          setAddressLine(addressParts.join(', '));
        }

        if (data?.siteSettings?.phone) {
          setPhone(data.siteSettings.phone);
        }

        if (data?.siteSettings?.email) {
          setEmail(data.siteSettings.email);
        }
      } catch (contactError) {
        console.error('Failed to load contact data for confirmation page:', contactError);
      }
    }

    void loadPublicContactData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      if (!sessionId || !orderNumber) {
        if (!isMounted) return;
        setError('Confirmation de paiement introuvable.');
        setLoading(false);
        return;
      }

      const maxAttempts = 10;
      const retryDelayMs = 2000;
      // eslint-disable-next-line prefer-const
      let lastErrorMessage =
        'Le paiement n’a pas encore pu être confirmé. Vérifiez dans quelques instants depuis l’admin ou réessayez plus tard.';

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const response = await fetch(
            `/api/public/orders/confirmation?session_id=${encodeURIComponent(sessionId)}&orderNumber=${encodeURIComponent(orderNumber)}`,
            {
              method: 'GET',
              headers: {
                Accept: 'application/json',
              },
            }
          );

          const json = (await response.json()) as OrderConfirmationResponse;

          if (!response.ok || !json.ok || !json.data) {
            throw new Error(json.message || 'Impossible de vérifier la commande.');
          }

          if (!json.data.paymentConfirmed) {
            throw new Error('Le paiement n’est pas encore confirmé.');
          }

          if (!isMounted) return;

          setError('');
          setConfirmedOrderNumber(json.data.orderNumber);
          setFulfillmentMethod(json.data.fulfillmentMethod);
          setTrackingToken(json.data.trackingToken);
          clearCart();

        try {
          localStorage.removeItem(CHECKOUT_FORM_STORAGE_KEY);
          localStorage.setItem(
            LAST_TRACKED_ORDER_STORAGE_KEY,
            JSON.stringify({
              orderNumber: json.data.orderNumber,
              trackingToken: json.data.trackingToken,
              savedAt: new Date().toISOString(),
            }),
          );
        } catch (storageError) {
          console.error('Failed to update order tracking data in localStorage:', storageError);
        }

          setLoading(false);
          return;
        } catch (err) {
          console.error(`Order confirmation fetch error (attempt ${attempt}/${maxAttempts}):`, err);

          if (attempt === maxAttempts) {
            break;
          }

          await new Promise((resolve) => {
            setTimeout(resolve, retryDelayMs);
          });
        }
      }

      if (!isMounted) return;
      setError(lastErrorMessage);
      setLoading(false);
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [sessionId, orderNumber, clearCart]);

  const phoneHref = useMemo(() => {
    if (!phone || phone === '[À définir]') return '';
    return `tel:${phone.replace(/\s+/g, '')}`;
  }, [phone]);

  const emailHref = useMemo(() => {
    if (!email || email === '[À définir]') return '';
    return `mailto:${email}`;
  }, [email]);

  if (loading) {
    return (
      <ClientLayout>
        <div className="container py-20 max-w-lg text-center">
          <h1 className="font-display text-2xl font-bold">Vérification du paiement</h1>
          <p className="text-muted-foreground mt-2">
            Nous vérifions la confirmation de votre commande...
          </p>
        </div>
      </ClientLayout>
    );
  }

  if (error) {
    return (
      <ClientLayout>
        <div className="container py-20 max-w-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <CheckCircle className="h-8 w-8 text-muted-foreground" />
          </div>

          <h1 className="font-display text-2xl font-bold mt-6">Confirmation en attente</h1>

          <p className="text-muted-foreground mt-2">{error}</p>

          {orderNumber && (
            <div className="card-premium p-5 mt-8 text-left space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">N° de commande</span>
                <span className="text-sm font-semibold text-primary">{orderNumber}</span>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <Button asChild>
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </div>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="container py-16 max-w-2xl">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>

          <h1 className="font-display text-3xl font-bold mt-6">Paiement confirmé</h1>

          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Merci pour votre commande chez {restaurantName}. Votre paiement a bien été pris en compte et votre commande est maintenant enregistrée.
          </p>
        </div>

        <div className="card-premium p-5 mt-8 text-left space-y-3">
          <div className="flex justify-between gap-4">
            <span className="text-sm text-muted-foreground">N° de commande</span>
            <span className="text-sm font-semibold text-primary text-right">{confirmedOrderNumber}</span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-sm text-muted-foreground">Statut</span>
            <span className="text-sm font-medium text-right">Paiement confirmé</span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-sm text-muted-foreground">Mode</span>
            <span className="text-sm font-medium text-right">
              {fulfillmentMethod === 'pickup' ? 'Retrait sur place' : 'Livraison'}
            </span>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-primary/20 bg-primary/10 p-5">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h2 className="font-medium text-foreground">Email de confirmation envoyé</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Un email de confirmation contenant votre numéro de commande a été envoyé à l’adresse utilisée lors du paiement.
                Pensez aussi à vérifier vos spams, courriers indésirables ou l’onglet promotions si vous ne le voyez pas tout de suite.
              </p>
            </div>
          </div>
        </div>

        {fulfillmentMethod === 'pickup' && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h2 className="font-medium text-foreground">Retrait sur place</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Vous avez choisi le retrait. Présentez-vous directement à cette adresse pour récupérer votre commande :
                </p>
                <p className="text-sm font-medium text-foreground mt-3">{addressLine}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium text-foreground">Besoin d’aide ?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Si vous avez la moindre question sur votre commande, votre retrait ou votre livraison, vous pouvez nous contacter.
          </p>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              {phoneHref ? (
                <a href={phoneHref} className="text-foreground hover:text-primary transition-colors">
                  {phone}
                </a>
              ) : (
                <span className="text-foreground">{phone}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              {emailHref ? (
                <a href={emailHref} className="text-foreground hover:text-primary transition-colors break-all">
                  {email}
                </a>
              ) : (
                <span className="text-foreground">{email}</span>
              )}
            </div>
          </div>

          <div className="mt-4">
            <Button asChild variant="outline">
              <Link to="/contact">Voir la page contact</Link>
            </Button>
          </div>
        </div>

        {trackingToken && (
          <div className="mt-6 flex justify-center">
            <Button asChild variant="outline">
              <Link to={`/suivi/${trackingToken}`}>Suivre ma commande</Link>
            </Button>
          </div>
        )}        

        <p className="text-sm text-muted-foreground mt-6 text-center">
          Conservez votre numéro de commande pour le suivi.
        </p>

        <div className="mt-8 flex justify-center">
          <Button asChild>
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </div>
      </div>
    </ClientLayout>
  );
}