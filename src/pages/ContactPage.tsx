import { useEffect, useMemo, useState } from 'react';
import ClientLayout from '@/components/client/ClientLayout';
import { fetchPublicMenu } from '@/lib/menu-api';

export default function ContactPage() {
  const [restaurantName, setRestaurantName] = useState('Pasta House');
  const [addressLine, setAddressLine] = useState('[Adresse à définir], Bruxelles');
  const [phone, setPhone] = useState('[À définir]');
  const [email, setEmail] = useState('[À définir]');
  const [loading, setLoading] = useState(true);

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

        {loading && (
          <p className="mt-6 text-sm text-muted-foreground">
            Chargement des coordonnées...
          </p>
        )}
      </div>
    </ClientLayout>
  );
}