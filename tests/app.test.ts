import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp, seedCategory, seedProduct } from "./helpers.js";

describe("GET /products", () => {
  it("liste le catalogue et pose un cookie de session", async () => {
    const { app, db } = createTestApp();
    seedProduct(db, { slug: "p1", stock: 5 });

    const res = await request(app).get("/products");

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^sid=/);
  });

  it("filtre par catégorie", async () => {
    const { app, db } = createTestApp();
    const catA = seedCategory(db, "livres");
    const catB = seedCategory(db, "jouets");
    seedProduct(db, { slug: "livre-1", categoryId: catA.id });
    seedProduct(db, { slug: "jouet-1", categoryId: catB.id });

    const res = await request(app).get("/products").query({ category: "livres" });

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].slug).toBe("livre-1");
  });

  it("404 sur un produit inconnu", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/products/inconnu");
    expect(res.status).toBe(404);
  });
});

describe("réutilisation de la session", () => {
  it("garde le même cookie de session entre deux requêtes de l'agent", async () => {
    const { app, db } = createTestApp();
    seedProduct(db, { slug: "p1", stock: 5 });
    const agent = request.agent(app);

    const first = await agent.get("/products");
    const sidCookie = first.headers["set-cookie"]?.[0];
    expect(sidCookie).toBeDefined();

    const second = await agent.get("/products");
    // L'agent renvoie le cookie reçu ; le serveur ne doit pas en émettre un
    // nouveau puisque la session existante est encore valide.
    expect(second.headers["set-cookie"]).toBeUndefined();
  });
});

describe("panier via HTTP", () => {
  it("ajoute, met à jour, puis retire une ligne", async () => {
    const { app, db } = createTestApp();
    const product = seedProduct(db, { priceCents: 500, stock: 10 });
    const agent = request.agent(app);

    const addRes = await agent.post("/cart/items").send({ productId: product.id, quantity: 2 });
    expect(addRes.status).toBe(201);
    expect(addRes.body.totalCents).toBe(1000);

    const updateRes = await agent.put(`/cart/items/${product.id}`).send({ quantity: 1 });
    expect(updateRes.body.totalCents).toBe(500);

    const removeRes = await agent.delete(`/cart/items/${product.id}`);
    expect(removeRes.body.lines).toHaveLength(0);
  });

  it("409 si la quantité demandée dépasse le stock", async () => {
    const { app, db } = createTestApp();
    const product = seedProduct(db, { stock: 1 });
    const res = await request(app).post("/cart/items").send({ productId: product.id, quantity: 5 });
    expect(res.status).toBe(409);
  });
});

describe("auth via HTTP", () => {
  it("inscription puis connexion", async () => {
    const { app } = createTestApp();
    const agent = request.agent(app);

    const registerRes = await agent
      .post("/auth/register")
      .send({ email: "alice@example.com", password: "password123" });
    expect(registerRes.status).toBe(201);

    const loginRes = await agent
      .post("/auth/login")
      .send({ email: "alice@example.com", password: "password123" });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.email).toBe("alice@example.com");
  });

  it("409 sur un email déjà utilisé, 401 sur un mauvais mot de passe", async () => {
    const { app } = createTestApp();
    await request(app).post("/auth/register").send({ email: "a@example.com", password: "password123" });

    const dup = await request(app)
      .post("/auth/register")
      .send({ email: "a@example.com", password: "autrepassword" });
    expect(dup.status).toBe(409);

    const badLogin = await request(app)
      .post("/auth/login")
      .send({ email: "a@example.com", password: "mauvais" });
    expect(badLogin.status).toBe(401);
  });
});

describe("parcours complet panier -> checkout -> paiement", () => {
  it("crée une commande, un lien de paiement factice, et le webhook la marque payée", async () => {
    const { app, db, paymentProvider } = createTestApp();
    const product = seedProduct(db, { priceCents: 1500, stock: 3 });
    const agent = request.agent(app);

    await agent.post("/cart/items").send({ productId: product.id, quantity: 2 });

    const checkoutRes = await agent.post("/checkout").send();
    expect(checkoutRes.status).toBe(201);
    const { orderId, checkoutUrl } = checkoutRes.body as { orderId: number; checkoutUrl: string };
    expect(checkoutUrl).toContain("fake_cs_");

    // Le stock est décrémenté dès la création de la commande (PENDING),
    // pas seulement après paiement confirmé.
    const productRes = await agent.get(`/products/${product.slug}`);
    expect(productRes.body.stock).toBe(1);

    const payload = JSON.stringify({ type: "checkout.session.completed", orderId });
    const signature = paymentProvider.signPayload(payload);
    const webhookRes = await request(app)
      .post("/webhooks/stripe")
      .set("stripe-signature", signature)
      .set("Content-Type", "application/json")
      .send(payload);
    expect(webhookRes.status).toBe(200);

    const orderRes = await agent.get(`/checkout/orders/${orderId}`);
    expect(orderRes.body.status).toBe("PAID");
  });

  it("restocke si le paiement expire", async () => {
    const { app, db, paymentProvider } = createTestApp();
    const product = seedProduct(db, { stock: 3 });
    const agent = request.agent(app);
    await agent.post("/cart/items").send({ productId: product.id, quantity: 1 });
    const checkoutRes = await agent.post("/checkout").send();
    const { orderId } = checkoutRes.body as { orderId: number };

    const payload = JSON.stringify({ type: "checkout.session.expired", orderId });
    const signature = paymentProvider.signPayload(payload);
    await request(app)
      .post("/webhooks/stripe")
      .set("stripe-signature", signature)
      .set("Content-Type", "application/json")
      .send(payload);

    const productRes = await agent.get(`/products/${product.slug}`);
    expect(productRes.body.stock).toBe(3);
    const orderRes = await agent.get(`/checkout/orders/${orderId}`);
    expect(orderRes.body.status).toBe("EXPIRED");
  });

  it("rejette un webhook mal signé", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post("/webhooks/stripe")
      .set("stripe-signature", "invalide")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type: "checkout.session.completed", orderId: 1 }));
    expect(res.status).toBe(400);
  });

  it("400 si le panier est vide au moment du checkout", async () => {
    const { app } = createTestApp();
    const res = await request(app).post("/checkout").send();
    expect(res.status).toBe(400);
  });
});
