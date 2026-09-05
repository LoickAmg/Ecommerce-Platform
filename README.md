# ecommerce-platform

Plateforme e-commerce : catalogue, panier lié à une session, comptes
utilisateurs, commandes avec gestion de stock anti-survente, et paiement
via **Stripe Checkout en mode test uniquement**. Node.js/TypeScript,
Express, `node:sqlite` (le module SQLite intégré à Node — aucune
dépendance externe, aucun binaire natif à télécharger).

## Pourquoi Node.js et pas Laravel/PHP (stack initialement prévue)

La roadmap prévoyait PHP/Laravel + Docker pour ce projet. Dans
l'environnement cloud où ce projet a été construit et testé, **Packagist
(le registre de paquets PHP) est bloqué au niveau réseau** — impossible
d'installer Laravel ni ses dépendances pour construire et faire tourner
les tests. npm, lui, est accessible. Le choix de Node/Express — même rôle
qu'un framework web "batteries-included" — a été fait explicitement avec
l'utilisateur pour rester dans la philosophie du projet : tout construire
**et tester réellement** avant de livrer, plutôt que d'écrire du code
Laravel invérifiable dans cet environnement.

## Pourquoi `node:sqlite` et pas Prisma/better-sqlite3

Même contrainte réseau : le moteur de requête de Prisma se télécharge
depuis `binaries.prisma.sh` (bloqué), et `better-sqlite3` télécharge un
binaire précompilé depuis GitHub Releases (également indisponible ici).
`node:sqlite`, intégré à Node.js depuis la version 22.5 (encore marqué
"expérimental" dans les avertissements runtime), ne dépend d'aucun
binaire externe. Contrepartie : pas d'ORM ni de migrations versionnées —
juste du SQL brut et de petites fonctions d'accès typées à la main (voir
`src/db/*.ts`).

## Cadrage : paiement en mode test uniquement

- **Aucune clé Stripe `sk_live_...` ne doit jamais être utilisée avec ce
  code.** `StripePaymentProvider` refuse explicitement de démarrer avec
  une clé commençant par `sk_live_`.
- Ce projet **n'a subi aucune revue de sécurité ni de conformité**
  (PCI-DSS, RGPD, etc.). Ce n'est pas un système prêt pour de vrais
  paiements ou de vraies données de carte bancaire.
- La suite de tests automatisés n'appelle **jamais** l'API Stripe réelle :
  elle utilise `FakePaymentProvider`, un double déterministe qui reproduit
  un vrai schéma de signature HMAC-SHA256 (dans l'esprit de ce que fait
  Stripe) pour vérifier une vraie propriété de sécurité — payload altéré
  ou signature incorrecte ⇒ rejeté — sans réseau ni compte Stripe.

## Fonctionnement

```bash
npm install
cp .env.example .env   # renseignez vos clés Stripe de TEST (sk_test_/whsec_)
npm run seed            # peuple un catalogue d'exemple
npm run dev              # http://localhost:3000
```

```bash
# Catalogue
curl http://localhost:3000/products
curl http://localhost:3000/products?category=informatique

# Panier (cookie de session posé automatiquement)
curl -c cookies.txt -b cookies.txt -X POST http://localhost:3000/cart/items \
  -H "Content-Type: application/json" -d '{"productId": 1, "quantity": 2}'

# Compte
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" -d '{"email":"a@example.com","password":"motdepasse123"}'

# Checkout -> renvoie une URL de paiement Stripe (mode test)
curl -c cookies.txt -b cookies.txt -X POST http://localhost:3000/checkout
```

Le webhook Stripe (`POST /webhooks/stripe`) reçoit les événements
`checkout.session.completed` (marque la commande `PAID`) et
`checkout.session.expired` (marque `EXPIRED` et **restocke** les
produits). Pointez le CLI Stripe dessus en local :
`stripe listen --forward-to localhost:3000/webhooks/stripe`.

## Architecture

- `src/db/` — schéma SQL brut (`schema.ts`) et fonctions d'accès typées
  par table (`products.ts`, `carts.ts`, `orders.ts`...), aucun ORM.
- `src/services/` — logique métier pure/testable : `catalog.ts`,
  `cart.ts` (panier lié à une session), `auth.ts` (bcrypt), `orders.ts`
  (création de commande, anti-survente — voir plus bas), `session.ts`.
- `src/services/payment/` — `PaymentProvider` (interface),
  `StripePaymentProvider` (réel, mode test, jamais appelé par les tests,
  isolé comme `landmarks.py` dans hand-gesture-recognition ou
  `StooqProvider` dans trading-dashboard), `FakePaymentProvider` (HMAC
  déterministe, utilisé par toute la suite de tests).
- `src/routes/` + `src/app.ts` — Express, `createApp(deps)` factory
  injectable (base de données + fournisseur de paiement), middleware de
  session (cookie httpOnly signé côté client, ligne `sessions` en base
  côté serveur).
- `scripts/seed.ts` — peuple un catalogue d'exemple.

## Anti-survente : comment le stock ne part jamais en négatif

Le cœur du problème e-commerce à ne pas rater. Deux mécanismes combinés :

1. **Décrément atomique en une seule requête SQL** :
   `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`
   (voir `decrementStockIfAvailable` dans `src/db/products.ts`). Le
   nombre de lignes affectées (`changes`) vaut 1 si et seulement si le
   stock a pu être décrémenté sans passer en négatif — pas de fenêtre
   "lire puis écrire" où une autre requête pourrait s'intercaler.
2. **`node:sqlite` est synchrone.** `createOrderFromCart`
   (`src/services/orders.ts`) décrémente le stock de chaque ligne dans
   une transaction SQL (`BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`), et
   toute la fonction s'exécute sans jamais rendre la main à la boucle
   d'événements Node. Dans un même processus, deux appels "concurrents"
   (deux requêtes HTTP simultanées) ne peuvent donc **jamais** s'entrelacer.

`tests/orders.test.ts` vérifie cette propriété avec un vrai test de
concurrence (`Promise.allSettled` sur deux commandes simultanées pour un
produit à stock = 1 : exactement une réussit, l'autre échoue proprement),
et un test de rollback multi-lignes (si la 2ᵉ ligne d'une commande à 2
lignes manque de stock, la 1ʳᵉ n'est pas non plus décrémentée).

## Tests

```bash
npm test            # 43 tests (Vitest + Supertest)
npm run lint         # ESLint
npm run build        # vérification des types (tsc)
```

La suite couvre : géométrie du panier (cumul, refus de survente, retrait),
auth (hash bcrypt, email dupliqué, mauvais mot de passe — même message
que "email inconnu", pour ne pas permettre l'énumération de comptes),
création de commande (total, décrément, rollback, **concurrence**),
webhooks (signature valide/invalide/altérée/mauvais secret), et un
parcours HTTP complet bout en bout (panier → checkout → webhook → commande
`PAID`, et le cas `EXPIRED` avec restock) via Supertest sur l'app réelle.

## Docker

`Dockerfile` et `docker-compose.yml` sont fournis mais **non testés dans
le bac à sable de développement** : Docker Hub y est bloqué au niveau
réseau (impossible d'y tirer une image de base ni de lancer un build).
Vérifiez avec `docker compose up --build` sur votre machine avant tout
déploiement — copiez `.env.example` en `.env` avec vos clés Stripe de
test au préalable.

## Limites connues

- **Jouet pédagogique, pas un produit** : aucune revue de sécurité ni de
  conformité (PCI-DSS, RGPD...). Mode paiement TEST uniquement.
- **`node:sqlite` est expérimental** côté Node.js — l'API peut changer
  dans une future version de Node.
- **L'anti-survente ne tient qu'à l'intérieur d'un seul processus Node.**
  Avec plusieurs workers/instances partageant le même fichier SQLite, le
  verrouillage fichier de SQLite (`SQLITE_BUSY`) protégerait toujours
  contre la survente, mais avec des erreurs à gérer plutôt que la
  sérialisation automatique en mémoire décrite plus haut — une vraie
  montée en charge migrerait vers Postgres avec des transactions
  `SERIALIZABLE` ou du verrouillage de lignes explicite (`SELECT ... FOR
  UPDATE`).
- **Pas de gestion des remboursements, taxes, ni d'expédition** — hors
  périmètre de ce projet pédagogique.
- **Sessions sans rotation ni révocation** : un cookie de session vole =
  panier + identité volés jusqu'à expiration (30 jours). Un vrai
  déploiement ajouterait rotation d'id à la connexion, révocation
  côté serveur, et probablement une durée de vie plus courte.

## Licence

MIT — voir [LICENSE](./LICENSE).
