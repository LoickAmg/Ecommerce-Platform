/**
 * Peuple la base configurée par DATABASE_URL avec un catalogue d'exemple.
 * Usage : `npm run seed` (respecte .env / DATABASE_URL comme le serveur).
 */
import { insertCategory } from "../src/db/categories.js";
import { createDatabase } from "../src/db/index.js";
import { insertProduct } from "../src/db/products.js";

const dbPath = process.env.DATABASE_URL ?? "./dev.db";
const db = createDatabase(dbPath);

const categories = [
  { slug: "livres", name: "Livres" },
  { slug: "informatique", name: "Informatique" },
  { slug: "maison", name: "Maison" },
];

const categoryIdBySlug = new Map<string, number>();
for (const category of categories) {
  const created = insertCategory(db, category.slug, category.name);
  categoryIdBySlug.set(category.slug, created.id);
}

const products = [
  {
    slug: "clavier-mecanique",
    name: "Clavier mécanique 75%",
    description: "Switches hot-swap, rétroéclairage RGB.",
    priceCents: 8900,
    stock: 12,
    categorySlug: "informatique",
  },
  {
    slug: "souris-ergonomique",
    name: "Souris ergonomique verticale",
    description: "Réduit la tension au poignet en usage prolongé.",
    priceCents: 4500,
    stock: 20,
    categorySlug: "informatique",
  },
  {
    slug: "clean-code",
    name: "Clean Code",
    description: "Robert C. Martin — bonnes pratiques d'écriture de code.",
    priceCents: 3200,
    stock: 8,
    categorySlug: "livres",
  },
  {
    slug: "lampe-de-bureau",
    name: "Lampe de bureau LED",
    description: "3 températures de couleur, port USB-C intégré.",
    priceCents: 2900,
    stock: 15,
    categorySlug: "maison",
  },
];

for (const product of products) {
  const categoryId = categoryIdBySlug.get(product.categorySlug);
  if (!categoryId) throw new Error(`catégorie inconnue: ${product.categorySlug}`);
  insertProduct(db, {
    slug: product.slug,
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    stock: product.stock,
    categoryId,
  });
}

console.log(`Base peuplée : ${categories.length} catégories, ${products.length} produits.`);
