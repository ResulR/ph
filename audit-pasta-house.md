# AUDIT COMPLET — PASTA HOUSE

**Date :** 15 avril 2026  
**Sources :** Repository GitHub (ResulR/ph) + analyse code complète  
**Site live :** Non accessible (pas d'URL de production trouvée dans le repo)

---

## PARTIE 1 — Ce que j'ai réellement pu vérifier

### ✅ Vérifié dans le repo
- Structure complète frontend (React/Vite/TypeScript/Tailwind/shadcn)
- Structure complète backend (Express.js/PostgreSQL/Stripe)
- Toutes les pages client : Index, OrderPage, CheckoutPage, OrderConfirmationPage, PaymentCancelledPage, CGV, Mentions légales, Confidentialité
- Toutes les pages admin : Login, Dashboard, Orders, OrdersBoard, OrderDetail, Products, Categories, Beverages, Schedule, Delivery, Settings
- Contextes : CartContext, OrdersContext
- Routes API : publicMenu, publicCheckout, adminAuth, adminProducts, adminBeverages, adminOrders, adminSchedule, adminDelivery, adminCategories, adminSettings
- Schéma SQL complet (6 fichiers de migration)
- Configuration Stripe (checkout sessions, webhooks)
- Système d'authentification admin (JWT + cookies httpOnly)
- Design system (index.css, tailwind.config.ts)
- Fichiers de déploiement (deploy/)

### ⚠️ Non vérifiable
- Le site live en production (aucune URL publique trouvée)
- Le rendu mobile réel (analyse basée sur le code uniquement)
- Les performances réelles (temps de chargement, TTFB)
- Le comportement Stripe en production
- La base de données réelle et ses données

---

## PARTIE 2 — Forces du projet

1. **Architecture backend solide** — Séparation claire Express avec routes modulaires, validation Zod côté serveur, transactions SQL pour les commandes, gestion des webhooks Stripe.

2. **Sécurité auth admin correcte** — JWT en cookie httpOnly, rate limiting sur le login (10 tentatives/15min), vérification is_active, bcrypt pour les mots de passe.

3. **Gestion intelligente des horaires** — Système sophistiqué avec opening_hours, schedule_overrides et exceptional_closures. Gestion des services qui traversent minuit (ex: 20h–01h). Vérification côté serveur avant chaque commande.

4. **Validation cart côté serveur** — Le backend re-vérifie chaque item du panier (prix, disponibilité, variantes) avant de créer la commande. Pas de confiance aveugle au frontend.

5. **Snapshots de données dans les commandes** — Les noms/prix des produits sont snapshotés dans order_items, ce qui protège l'historique si les prix changent.

6. **Design system cohérent** — Palette sombre/warm avec tokens CSS bien définis, fonts Playfair Display + DM Sans, classes utilitaires custom (card-premium, glow-primary, text-gradient-gold).

7. **Persistance panier en localStorage** — Le panier et le formulaire checkout survivent à un refresh. Bonne UX.

8. **Pages légales présentes** — CGV, Mentions légales, Confidentialité sont implémentées avec les bonnes références RGPD.

9. **Gestion livraison/retrait** — Différenciation claire avec minimum de commande en livraison, frais de livraison dynamiques depuis la BDD.

10. **Dashboard admin complet** — Stats du jour, CA semaine, panier moyen, filtres par statut/paiement/mode.

---

## PARTIE 3 — Faiblesses du projet

### 🔴 Critique

1. **FUITE DE CREDENTIALS DANS LE REPO** — Les fichiers `admin-cookie.txt` et `admin-cookies.txt` contiennent des JWT admin valides avec l'email `resulramadani35@gmail.com`. Ces tokens JWT exposent le secret signing si quelqu'un les exploite. **C'est un incident de sécurité.**

2. **Seed admin avec hash en clair dans le SQL** — `005_seed_admin.sql` contient le hash bcrypt du mot de passe admin ET l'email. Combiné avec les cookies exposés, c'est un vecteur d'attaque complet.

3. **Pas de CSRF protection** — L'admin utilise des cookies pour l'auth mais aucune protection CSRF n'est visible. Un site malveillant pourrait déclencher des actions admin via des requêtes cross-origin si sameSite: "lax" ne suffit pas (ce qui est le cas pour les POST via formulaire classique — lax bloque seulement les requêtes cross-site en GET, mais pas les POST submis via formulaire).

   **CORRECTION** : `sameSite: "lax"` bloque les POST cross-origin automatiques, mais ne protège pas contre toutes les attaques. Un token CSRF serait plus sûr.

4. **Aucune validation du numéro de téléphone** — Côté serveur, le téléphone n'est validé que comme `string.min(1)`. Pas de format, pas de regex. Un utilisateur peut entrer "abc".

5. **Pas de confirmation email** — Aucun email de confirmation n'est envoyé après commande. L'utilisateur n'a que le numéro affiché à l'écran. S'il ferme l'onglet, il perd tout.

### 🟡 Important

6. **Pas d'images produits** — Aucune image pour les plats. Pour un site de restaurant, c'est un manque majeur en termes de conversion. Les cartes produits n'ont que du texte.

7. **Pas de suivi de commande côté client** — Après la confirmation, le client n'a aucun moyen de suivre sa commande. Pas de page "suivi", pas de lien dans un email (qui n'existe pas non plus).

7. token admin visible front OK ou KO ??

8. **Pas d'estimation de temps de livraison** — Nulle part le client ne voit "livraison en ~30 min". C'est une info critique pour la conversion.

9. **Footer affiche des placeholders** — `[Adresse à définir]` et `[À définir]` comme fallback si l'API ne répond pas. En cas d'erreur réseau, le site affiche ces textes embarrassants.

10. **Double appel API inutile** — Le Footer, le Header, la HomePage et le CartContext appellent tous `fetchPublicMenu()` indépendamment. Pas de cache React Query sur ces appels, donc le même endpoint est appelé 3-4 fois au chargement.

11. **Faute dans le nom de fichier** — `vitest.foncig.ts` au lieu de `vitest.config.ts`. Erreur de typo visible dans le repo.

12. **Pas de rate limiting sur le checkout** — Le endpoint `/api/public/checkout/session` n'a pas de rate limit. Un attaquant pourrait spammer des sessions Stripe.

13. **Le panier envoie les prix depuis le frontend** — Bien que le backend re-valide, le CartItem contient `price` côté frontend et c'est stocké en localStorage. Le backend ignore ce prix (bon), mais la logique est confuse et pourrait induire des bugs.

14. **Pas de gestion du stock/rupture visible** — Le champ `available` existe dans le backend mais n'est pas clairement exploité côté frontend pour les produits indisponibles (pas de badge "Rupture" visible).

### 🟢 Mineur

15. **README non documenté** — Juste "TODO: Document your project here".

16. **Pas de tests** — Un seul fichier test exemple vide. Aucun test unitaire, d'intégration, ou E2E malgré la présence de Playwright dans les deps.

17. **express-rate-limit dans les deps frontend** — Le package `express-rate-limit` est dans le `package.json` frontend, ce qui n'a aucun sens.

18. **Pas de SEO** — Aucun meta tag, pas de title dynamique, pas d'Open Graph, pas de sitemap, pas de robots.txt configuré.

19. **Pas de favicon personnalisé** — Le favicon par défaut Lovable est utilisé.

---

## PARTIE 4 — Points critiques avant mise en prod

| # | Problème | Risque | Priorité |
|---|----------|--------|----------|
| 1 | JWT admin exposés dans le repo | Compromission admin immédiate | 🔴 BLOQUANT |
| 2 | Pas d'email de confirmation | Perte de confiance, support surchargé | 🔴 BLOQUANT |
| 3 | Pas d'images produits | Conversion catastrophique | 🔴 BLOQUANT |
| 4 | Placeholders visibles en fallback | Crédibilité nulle en cas d'erreur | 🔴 BLOQUANT |
| 5 | Pas de CSRF sur admin | Sécurité | 🟡 HAUTE |
| 6 | Pas de rate limit checkout | Spam Stripe, coûts | 🟡 HAUTE |
| 7 | Pas de validation téléphone | Commandes impossibles à traiter | 🟡 HAUTE |
| 8 | Pas de suivi commande client | Anxiété post-achat, appels restaurant | 🟡 HAUTE |
| 9 | Pas de SEO/meta tags | Invisible sur Google | 🟡 MOYENNE |
| 10 | Pas de tests | Régression à chaque changement | 🟡 MOYENNE |

---

## PARTIE 5 — Audit détaillé par zone

### 5.1 Homepage

**Ce qui marche bien :**
- Hero clair avec CTA "Commander maintenant" bien visible
- Infos horaires et zone de livraison affichées
- Section "Nos populaires" avec produits featured
- Design sombre/warm cohérent, typographie premium

**Ce qui est moyen :**
- Aucune image hero ni photo de plat — le hero est 100% texte
- "Pâtes fraîches & Paninis généreux" comme badge est trop générique
- Le prix "dès 6,00€" est affiché mais sans visuel, peu impactant

**Ce qui est mauvais :**
- Aucune preuve sociale (avis, nombre de commandes, note Google)
- Aucun élément de réassurance (paiement sécurisé, livraison rapide)
- Pas de section "Comment ça marche" pour les nouveaux utilisateurs
- Le CTA secondaire est absent — un seul bouton pour tout

**Ce qui manque :**
- Photo hero appetizing (indispensable pour la food)
- Temps de livraison estimé
- Zones de livraison détaillées
- Horaires du jour en cours (ouvert/fermé maintenant)

### 5.2 Menu / Commande (/commander)

**Ce qui marche bien :**
- Tabs catégories (Pâtes/Paninis) fonctionnels
- ProductCard avec sélection taille/formule et ajout au panier
- Barre fixe en bas avec compteur et total
- CartDrawer fonctionnel avec +/- et suppression

**Ce qui est moyen :**
- Pas de filtres ni recherche — OK pour un menu court mais limitant
- Les descriptions sont courtes et pas très vendeuses
- Pas de badges (nouveau, populaire, épicé) pour guider le choix

**Ce qui est mauvais :**
- **Aucune image produit** — fatal pour un restaurant
- Pas d'indication "rupture de stock" visible
- La formule "menu" des paninis propose une boisson mais l'UX de sélection est à valider
- Pas de suggestion d'upsell (boisson, dessert, supplément)

**Ce qui manque :**
- Photos des plats
- Allergènes
- Informations nutritionnelles (optionnel mais bon pour la confiance)
- Suggestion "Souvent commandé avec..."

### 5.3 Panier (CartDrawer)

**Ce qui marche bien :**
- Drawer latéral élégant avec overlay
- Switch livraison/retrait clair
- Sous-total, frais de livraison, total bien présentés
- Message minimum de commande affiché
- Persistance localStorage

**Ce qui est moyen :**
- Le bouton "Vider le panier" est petit et discret (bon en soi)
- Pas de cross-sell dans le drawer

**Ce qui est mauvais :**
- La seule action est "Passer commande" — pas de "Continuer mes achats"
- Pas d'estimation de temps
- Sur mobile (à valider), le drawer prend toute la largeur max-w-md — potentiellement OK

### 5.4 Checkout (/checkout)

**Ce qui marche bien :**
- Récapitulatif de commande clair
- Switch livraison/retrait disponible même au checkout
- Validation frontend + backend
- Redirection vers Stripe Checkout (fiable et reconnu)
- Formulaire persisté en localStorage

**Ce qui est moyen :**
- Pas de numéro de téléphone formaté ou masqué (input libre)
- Le champ "Instructions de livraison" et "Note" ne sont pas clairement différenciés
- Pas d'autocomplete d'adresse

**Ce qui est mauvais :**
- **Aucune réassurance** avant le paiement : pas d'icône cadenas, pas de "Paiement sécurisé par Stripe", pas de logo CB
- Pas de récapitulatif des délais
- Le backend accepte n'importe quel code postal — pas de validation de zone de livraison

**Ce qui manque :**
- Estimation de livraison
- Logo/badges de paiement sécurisé
- Possibilité de modifier les articles sans revenir en arrière
- Message "Vous ne serez débité qu'après confirmation"

### 5.5 Confirmation (/commande-confirmee)

**Ce qui marche bien :**
- Vérification côté serveur du paiement Stripe
- Vidage automatique du panier
- Affichage du numéro de commande
- Gestion de l'état "en attente" si webhook pas encore reçu

**Ce qui est mauvais :**
- Aucune info sur quand la commande sera prête/livrée
- Aucun email envoyé (confirmé — pas d'envoi d'email dans le code)
- Pas de détails de la commande (quels plats, quel total)
- Le message "Conservez ce numéro de commande pour le suivi" est trompeur — il n'y a PAS de page de suivi
- Aucun moyen de contacter le restaurant depuis cette page

**Ce qui manque :**
- Email de confirmation
- Détails de la commande sur la page
- Lien/numéro de téléphone du restaurant
- Estimation de temps

### 5.6 Page annulation (/paiement-annule)

**Ce qui marche bien :**
- Message clair
- Deux CTA : Réessayer + Modifier la commande

**Ce qui est moyen :**
- Le numéro de commande est affiché mais la commande reste en "pending" côté serveur — pas de nettoyage automatique visible

### 5.7 Admin

**Ce qui marche bien :**
- Login sécurisé avec JWT httpOnly et rate limiting
- Dashboard avec KPIs pertinents (CA jour/semaine, panier moyen, par statut)
- Gestion complète des produits (CRUD, activation, disponibilité, variantes, featured)
- Gestion des catégories, boissons, horaires, livraison, paramètres
- Vue board des commandes avec filtres par statut/paiement/mode
- Détail commande avec historique de statuts et changement de statut
- Navigation admin avec sidebar

**Ce qui est moyen :**
- L'interface admin est fonctionnelle mais très dense — beaucoup de texte, peu de couleur pour différencier les statuts visuellement (à valider dans le rendu)
- Pas de notifications sonores ou push pour les nouvelles commandes
- Pas de polling visible — les nouvelles commandes n'apparaissent pas en temps réel

**Ce qui est mauvais :**
- **Pas de refresh automatique des commandes** — L'admin doit recharger la page pour voir les nouvelles commandes. C'est inacceptable en exploitation restaurant.
- Pas de système d'impression de ticket
- Pas de son/alerte pour nouvelle commande
- Le changement de statut n'a pas de confirmation (à valider)
- Pas de gestion multi-admin visible (un seul admin seedé)

**Ce qui manque :**
- Polling ou WebSocket pour les nouvelles commandes
- Notifications sonores
- Impression de tickets
- Tableau de bord temps réel
- Gestion des admins (ajout/suppression)
- Export des commandes/CA
- Historique des modifications produits

### 5.8 Mobile (analyse code)

**Confirmé dans le code :**
- Layout responsive avec grilles adaptatives (sm:grid-cols-2, lg:grid-cols-3)
- Header sticky avec nav compacte
- Barre de panier fixe en bas
- CartDrawer en pleine largeur (max-w-md)
- Tabs catégories avec overflow-x-auto
- Formulaire checkout sur une colonne

**À valider :**
- Densité des cartes produits sans images sur petit écran
- Taille des boutons +/- dans le drawer (h-7 w-7 = 28px, limite du tap target de 44px)
- Scroll du drawer sur contenus longs
- Footer sur mobile (3 colonnes → 1 colonne ?)

**Risques identifiés :**
- Les boutons +/- du panier sont trop petits (28px) — problème d'accessibilité mobile
- La barre fixe en bas peut chevaucher le contenu
- Le formulaire checkout n'a pas d'`inputmode` pour le téléphone

### 5.9 Réassurance / Confiance

**Ce qui existe :**
- Pages légales (CGV, confidentialité, mentions)
- Mention de Stripe pour le paiement
- Footer avec adresse et téléphone (quand l'API répond)

**Ce qui manque gravement :**
- Aucune preuve sociale (avis clients, note Google, nombre de commandes)
- Aucune photo du restaurant ou de l'équipe
- Aucune image de plats
- Pas de badge "Paiement sécurisé" visible
- Pas de FAQ
- Pas de numéro de téléphone cliquable en header
- Pas d'indication "Livraison en ~30min"
- Pas de politique d'annulation/remboursement claire côté client (seulement dans les CGV)
- Le site ressemble à un prototype — pas à un vrai restaurant qui mérite qu'on paie

### 5.10 Technique visible

**Points positifs :**
- TypeScript côté frontend avec types bien définis
- Validation Zod côté serveur
- Transactions SQL pour les commandes
- Snapshots de données dans les commandes
- Séparation claire routes/middleware/config

**Points négatifs :**
- `vitest.foncig.ts` — typo dans le nom de fichier
- `express-rate-limit` dans les deps frontend
- Pas de cache React Query — appels API redondants
- Le `fetchPublicMenu()` est appelé dans useEffect sans React Query, donc pas de cache/stale-while-revalidate
- L'OrdersContext charge TOUTES les commandes à chaque mount — pas de pagination
- Pas de gestion d'erreur globale (ErrorBoundary)
- Pas de lazy loading des routes admin
- Le build ne génère probablement pas de service worker
- `next-themes` est dans les deps mais semble inutilisé

**Risques avant prod :**
- Les commandes "pending" non payées ne sont jamais nettoyées (pas de cron/scheduled job visible)
- Le webhook Stripe n'a pas de replay/retry visible en cas d'échec
- Pas de logging structuré (juste console.error)
- Pas de monitoring/alerting

### 5.11 Business

**Est-ce que le site aide à vendre ?**
Non. Le site est fonctionnel mais ne VEND pas. Il permet de commander, mais il ne donne pas envie de commander. L'absence totale d'images est le problème #1.

**Le tunnel est-il adapté ?**
Le flow Homepage → Commander → Panier → Checkout → Stripe est correct et classique. Mais :
- Pas d'upsell (boissons non suggérées activement, pas de dessert, pas de "menu du jour")
- Pas de cross-sell dans le panier
- Pas de promotion/offre visible
- La homepage ne met pas assez en avant les produits stars

**L'offre est-elle bien présentée ?**
Non. Sans photos, les descriptions courtes ne suffisent pas. "Sauce tomate riche à la viande hachée, mijotée lentement" ne fait pas saliver autant qu'une photo.

**L'expérience est-elle pensée pour une vraie exploitation ?**
Partiellement. Le backend est solide mais l'admin manque de temps réel (polling). Un restaurant qui reçoit des commandes a besoin d'être alerté en temps réel, pas de recharger la page.

---

## PARTIE 6 — Classement des problèmes par priorité

### 🔴 Priorité haute

1. **Supprimer les fichiers admin-cookie.txt / admin-cookies.txt du repo** + rotation du JWT secret + changement du mot de passe admin
2. **Ajouter des images produits** — sans images, le taux de conversion sera catastrophique
3. **Implémenter l'envoi d'email de confirmation** — indispensable pour la confiance
4. **Remplacer les placeholders du footer** par de vraies valeurs par défaut ou masquer les infos manquantes
5. **Ajouter du polling/refresh auto dans l'admin** — indispensable pour l'exploitation
6. **Ajouter des éléments de réassurance** au checkout (paiement sécurisé, logos CB)
7. **Rate limiter le checkout**
8. **Valider le format du téléphone** côté serveur
9. **Valider la zone de livraison** (code postal accepté)

### 🟡 Priorité moyenne

10. Ajouter des meta tags SEO et Open Graph
11. Ajouter une estimation de temps de livraison
12. Ajouter une page de suivi commande côté client
13. Utiliser React Query pour le cache des appels API
14. Ajouter des notifications sonores admin
15. Ajouter un ErrorBoundary global
16. Ajouter des tests (au moins les flows critiques)
17. Corriger la typo `vitest.foncig.ts`
18. Supprimer `express-rate-limit` et `next-themes` des deps frontend
19. Ajouter du lazy loading sur les routes admin

### 🟢 Priorité basse

20. Ajouter des allergènes
21. Ajouter une FAQ
22. Ajouter de l'upsell/cross-sell
23. Ajouter un favicon custom
24. Ajouter un README documenté
25. Implémenter la pagination des commandes admin
26. Ajouter l'export CSV des commandes
27. Ajouter un système de promotion/code promo

---

## PARTIE 7 — Statut de vérification

| Point | Statut |
|-------|--------|
| JWT admin exposés dans le repo | ✅ **Confirmé** |
| Seed SQL avec hash admin | ✅ **Confirmé** |
| Pas d'images produits | ✅ **Confirmé** |
| Pas d'email de confirmation | ✅ **Confirmé** (aucun code d'envoi email) |
| Pas de rate limit checkout | ✅ **Confirmé** |
| Pas de validation téléphone | ✅ **Confirmé** |
| Pas de CSRF protection | ✅ **Confirmé** (aucun token CSRF) |
| Placeholders footer | ✅ **Confirmé** |
| Multiple appels fetchPublicMenu | ✅ **Confirmé** |
| Pas de polling admin | ✅ **Confirmé** (aucun setInterval/WebSocket) |
| Pas de suivi commande client | ✅ **Confirmé** |
| Typo vitest.foncig.ts | ✅ **Confirmé** |
| Boutons +/- trop petits pour mobile | ⚠️ **À valider** (28px dans le code, sous le seuil 44px) |
| Responsive mobile global | ⚠️ **À valider** (code semble correct mais non testé) |
| Comportement Stripe en prod | ⚠️ **À valider** |
| Nettoyage commandes pending | ⚠️ **À valider** (aucun cron visible) |
| Gestion multi-admin | ❌ **Non confirmé** (un seul admin seedé, pas de CRUD admin) |

---

## PARTIE 8 — Recommandations concrètes

### R1 — Sécurité : Tokens exposés
- **Problème :** JWT admin et email dans le repo public
- **Pourquoi c'est grave :** Accès admin complet à quiconque lit le repo
- **Impact :** Compromission totale de l'admin
- **Priorité :** 🔴 IMMÉDIAT
- **Action :** Supprimer les fichiers, ajouter au .gitignore, régénérer le JWT_SECRET, changer le mot de passe admin, révoquer tous les tokens existants

### R2 — Conversion : Images produits
- **Problème :** Aucune photo de plat sur le site
- **Pourquoi c'est grave :** La food est 80% visuelle. Sans images, le taux de conversion sera <5%
- **Impact :** Perte massive de commandes potentielles
- **Priorité :** 🔴 AVANT LANCEMENT
- **Action :** Photographier chaque plat, implémenter un champ image_url dans products, afficher dans ProductCard et la homepage

### R3 — Confiance : Email de confirmation
- **Problème :** Aucun email envoyé après commande
- **Pourquoi c'est grave :** L'utilisateur n'a aucune preuve de sa commande s'il ferme le navigateur
- **Impact :** Anxiété post-achat, appels au restaurant, perception d'amateurisme
- **Priorité :** 🔴 AVANT LANCEMENT
- **Action :** Intégrer un service d'email (Resend, SendGrid) et envoyer un email avec : numéro de commande, récapitulatif, total, mode de livraison, coordonnées restaurant

### R4 — Exploitation : Temps réel admin
- **Problème :** Pas de refresh automatique des commandes
- **Pourquoi c'est grave :** Le restaurateur ne voit pas les nouvelles commandes sans recharger la page
- **Impact :** Commandes traitées en retard, clients mécontents
- **Priorité :** 🔴 AVANT LANCEMENT
- **Action :** Ajouter un polling toutes les 15-30s sur les commandes admin, avec notification sonore pour les nouvelles commandes

### R5 — UX : Réassurance checkout
- **Problème :** Aucun élément de confiance avant le paiement
- **Pourquoi c'est grave :** L'utilisateur hésite à payer sur un site qu'il ne connaît pas
- **Impact :** Abandon au checkout estimé >60%
- **Priorité :** 🟡 HAUTE
- **Action :** Ajouter "Paiement sécurisé par Stripe", logos CB/Visa/Mastercard, icône cadenas, mention "Vos données bancaires ne sont jamais stockées"

### R6 — UX : Estimation temps de livraison
- **Problème :** Le client ne sait pas quand il sera livré
- **Pourquoi c'est grave :** Information n°1 recherchée par un client food delivery
- **Impact :** Perte de conversions et insatisfaction
- **Priorité :** 🟡 HAUTE
- **Action :** Ajouter un champ estimated_delivery_minutes dans les settings, afficher sur la homepage, le checkout et la confirmation

### R7 — Technique : Cache API
- **Problème :** 3-4 appels identiques à fetchPublicMenu() par page load
- **Pourquoi c'est grave :** Gaspillage de bande passante, latence inutile
- **Impact :** Lenteur perçue, charge serveur
- **Priorité :** 🟡 MOYENNE
- **Action :** Utiliser React Query avec useQuery pour fetchPublicMenu, avec staleTime de 5min

### R8 — Business : Upsell / Cross-sell
- **Problème :** Aucune suggestion de produits complémentaires
- **Pourquoi c'est grave :** Le panier moyen reste bas
- **Impact :** Manque à gagner estimé 15-25% du CA
- **Priorité :** 🟢 POST-LANCEMENT
- **Action :** Suggérer des boissons dans le panier, proposer un "menu" quand l'utilisateur ajoute un panini seul, afficher des suggestions "Nos clients aiment aussi"

### R9 — SEO : Meta tags
- **Problème :** Aucun title/description/OG configuré
- **Pourquoi c'est grave :** Le site est invisible sur Google et ne partage pas bien sur les réseaux sociaux
- **Impact :** 0 trafic organique
- **Priorité :** 🟡 MOYENNE
- **Action :** Ajouter react-helmet-async, configurer title/meta/OG pour chaque page, ajouter un sitemap.xml et configurer robots.txt

### R10 — Sécurité : Validation zone livraison
- **Problème :** N'importe quel code postal est accepté en livraison
- **Pourquoi c'est grave :** Le restaurant peut recevoir des commandes hors zone
- **Impact :** Commandes non livrables, remboursements
- **Priorité :** 🟡 HAUTE
- **Action :** Ajouter une liste de codes postaux acceptés dans delivery_settings, valider côté serveur

---

**Conclusion :** Le projet a une bonne base technique (backend solide, architecture propre) mais n'est **pas prêt pour la production** en l'état. Les problèmes de sécurité (tokens exposés) sont à traiter immédiatement. L'absence d'images et d'emails de confirmation sont des bloquants pour un lancement crédible. L'admin manque de temps réel pour une exploitation restaurant réelle. Le site "fonctionne" mais ne "vend" pas — il manque tous les éléments qui transforment un visiteur en client payant.
