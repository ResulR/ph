import ClientLayout from '@/components/client/ClientLayout';
import { SITE_CONFIG } from '@/config/menu';

export default function CGVPage() {
  return (
    <ClientLayout>
      <div className="container py-10 max-w-2xl">
        <h1 className="font-display text-2xl font-bold">Conditions Générales de Vente</h1>
        <div className="mt-6 space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Objet</h2>
            <p>Les présentes conditions régissent les ventes de produits alimentaires par {SITE_CONFIG.restaurantName} via son site de commande en ligne.</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Commandes</h2>
            <p>Toute commande implique l'acceptation des présentes CGV. Le client s'engage à fournir des informations exactes. La commande est confirmée après paiement réussi.</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Prix</h2>
            <p>Les prix sont indiqués en euros TTC. {SITE_CONFIG.restaurantName} se réserve le droit de modifier ses prix à tout moment. Les prix applicables sont ceux en vigueur au moment de la commande.</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Livraison</h2>
            <p>La livraison est disponible dans la zone définie (Bruxelles). Des frais de livraison de 5,00€ s'appliquent. Un minimum de commande de 15,00€ est requis pour la livraison.</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Paiement</h2>
            <p>Le paiement s'effectue en ligne par carte bancaire via la plateforme sécurisée Stripe.</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Annulation</h2>
            <p>En raison de la nature périssable des produits, aucune annulation n'est possible une fois la commande confirmée et le paiement effectué, sauf accord du restaurant.</p>
          </section>
          <section>
            <h2 className="font-display text-base font-semibold text-foreground">Contact</h2>
            <p>Pour toute question : {SITE_CONFIG.email} / {SITE_CONFIG.phone}</p>
          </section>
        </div>
      </div>
    </ClientLayout>
  );
}
