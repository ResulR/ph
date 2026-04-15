import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicMenu } from '@/lib/menu-api';

export default function Footer() {
  const [restaurantName, setRestaurantName] = useState('Pasta House');
  const [addressLine, setAddressLine] = useState('[Adresse à définir], Bruxelles');
  const [phone, setPhone] = useState('[À définir]');

  useEffect(() => {
    let isMounted = true;

    async function loadFooterData() {
      try {
        const data = await fetchPublicMenu();
        if (!isMounted) return;

        if (data.siteSettings?.restaurantName) {
          setRestaurantName(data.siteSettings.restaurantName);
        }

        const addressParts = [
          data.siteSettings?.addressLine1,
          data.siteSettings?.postalCode,
          data.siteSettings?.city,
        ].filter(Boolean);

        if (addressParts.length > 0) {
          setAddressLine(addressParts.join(', '));
        }

        if (data.siteSettings?.phone) {
          setPhone(data.siteSettings.phone);
        }
      } catch (error) {
        console.error('Failed to load footer data:', error);
      }
    }

    void loadFooterData();

    return () => {
      isMounted = false;
    };
  }, []);

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <footer className="border-t border-border/40 bg-card py-12">
      <div className="container">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-primary">{restaurantName}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{addressLine}</p>
            <p className="text-sm text-muted-foreground">{phone}</p>
          </div>
          <div>
            <h4 className="font-body text-sm font-bold text-foreground uppercase tracking-wide">Navigation</h4>
            <ul className="mt-3 space-y-2">
              <li><Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">Accueil</Link></li>
              <li><Link to="/commander" className="text-sm text-muted-foreground hover:text-primary transition-colors">Commander</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-body text-sm font-bold text-foreground uppercase tracking-wide">Légal</h4>
            <ul className="mt-3 space-y-2">
              <li><Link to="/mentions-legales" className="text-sm text-muted-foreground hover:text-primary transition-colors">Mentions légales</Link></li>
              <li><Link to="/confidentialite" className="text-sm text-muted-foreground hover:text-primary transition-colors">Confidentialité</Link></li>
              <li><Link to="/cgv" className="text-sm text-muted-foreground hover:text-primary transition-colors">CGV</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
          © {currentYear} {restaurantName}. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}