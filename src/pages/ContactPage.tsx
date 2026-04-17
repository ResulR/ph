import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ClientLayout from '@/components/client/ClientLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchPublicMenu } from '@/lib/menu-api';

export default function ContactPage() {
  const [restaurantName, setRestaurantName] = useState('Pasta House');
  const [addressLine, setAddressLine] = useState('[Adresse à définir], Bruxelles');
  const [phone, setPhone] = useState('[À définir]');
  const [email, setEmail] = useState('[À définir]');
  const [loading, setLoading] = useState(true);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadContactData() {
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
      } catch (error) {
        console.error('Failed to load contact data:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadContactData();

    return () => {
      isMounted = false;
    };
  }, []);

  const phoneHref = useMemo(() => {
    if (!phone || phone === '[À définir]') return '';
    return `tel:${phone.replace(/\s+/g, '')}`;
  }, [phone]);

  const emailHref = useMemo(() => {
    if (!email || email === '[À définir]') return '';
    return `mailto:${email}`;
  }, [email]);

  async function handleRecoverTracking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = recoveryEmail.trim();

    if (!normalizedEmail) {
      setRecoveryError('Veuillez entrer votre adresse email.');
      setRecoveryMessage('');
      return;
    }

    try {
      setRecoveryLoading(true);
      setRecoveryError('');
      setRecoveryMessage('');

      const response = await fetch('/api/public/orders/recover-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        if (response.status === 429) {
          throw new Error(
            json?.message ||
              'Trop de tentatives ont déjà été effectuées pour retrouver une commande. Merci de nous contacter directement.',
          );
        }

        if (json?.errors?.fieldErrors?.email?.[0]) {
          throw new Error(json.errors.fieldErrors.email[0]);
        }

        throw new Error(json?.message || 'Impossible d’envoyer le lien de suivi.');
      }

      setRecoveryMessage(
        json.message ||
          'Si une commande récente correspond à cette adresse, un email de suivi vient d’être envoyé. Pensez à vérifier aussi vos spams, promotions et courriers indésirables.',
      );
      setRecoveryEmail('');
    } catch (error) {
      console.error('Recover tracking request failed:', error);
      setRecoveryError(
        error instanceof Error
          ? error.message
          : 'Impossible d’envoyer le lien de suivi.',
      );
    } finally {
      setRecoveryLoading(false);
    }
  }

  return (
    <ClientLayout>
      <div className="container py-10 max-w-3xl">
        <h1 className="font-display text-3xl font-bold">Contact</h1>
        <p className="mt-3 text-muted-foreground">
          Une question sur votre commande, un horaire ou un retrait sur place ? Retrouvez ici les coordonnées de {restaurantName}.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="card-premium p-5">
            <h2 className="font-display text-lg font-semibold text-primary">Téléphone</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Contactez-nous rapidement si vous avez une question sur votre commande.
            </p>
            <div className="mt-4">
              {phoneHref ? (
                <a href={phoneHref} className="text-base font-medium text-foreground hover:text-primary transition-colors">
                  {phone}
                </a>
              ) : (
                <p className="text-base font-medium text-foreground">{phone}</p>
              )}
            </div>
          </div>

          <div className="card-premium p-5">
            <h2 className="font-display text-lg font-semibold text-primary">Email</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Vous pouvez aussi nous écrire si ce n’est pas urgent.
            </p>
            <div className="mt-4">
              {emailHref ? (
                <a href={emailHref} className="text-base font-medium text-foreground hover:text-primary transition-colors break-all">
                  {email}
                </a>
              ) : (
                <p className="text-base font-medium text-foreground">{email}</p>
              )}
            </div>
          </div>
        </div>

        <div className="card-premium p-5 mt-4">
          <h2 className="font-display text-lg font-semibold text-primary">Adresse</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Utile notamment si vous avez choisi le retrait sur place.
          </p>
          <p className="mt-4 text-base font-medium text-foreground">{addressLine}</p>
        </div>

        <div className="card-premium p-5 mt-4">
          <h2 className="font-display text-lg font-semibold text-primary">Retrouver ma commande</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vous n’avez plus votre lien de suivi ? Entrez votre adresse email ci-dessous.
            Si une commande correspond à cette adresse, nous vous renverrons un email avec votre lien de suivi.
          </p>

          <form onSubmit={handleRecoverTracking} className="mt-4 space-y-3">
            <Input
              type="email"
              value={recoveryEmail}
              onChange={(event) => setRecoveryEmail(event.target.value)}
              placeholder="Votre adresse email"
              autoComplete="email"
              disabled={recoveryLoading}
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={recoveryLoading}>
                {recoveryLoading ? 'Envoi en cours...' : 'Recevoir mon lien de suivi'}
              </Button>

              <Button asChild type="button" variant="outline">
                <Link to="/commander">Commander maintenant</Link>
              </Button>
            </div>
          </form>

          {recoveryMessage && (
            <p className="mt-4 text-sm text-muted-foreground">
              {recoveryMessage}
            </p>
          )}

          {recoveryError && (
            <p className="mt-4 text-sm text-destructive">
              {recoveryError}
            </p>
          )}

          <p className="mt-4 text-sm text-muted-foreground">
            Si vous ne recevez rien, si votre commande date de plus de quelques heures, ou si trop de tentatives ont déjà été effectuées, contactez-nous directement par téléphone ou par email.
          </p>
        </div>

        {loading && (
          <p className="mt-6 text-sm text-muted-foreground">
            Chargement des coordonnées...
          </p>
        )}
      </div>
    </ClientLayout>
  );
}