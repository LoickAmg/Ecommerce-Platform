import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp, seedProduct } from "./helpers.js";

/**
 * Régression pour l'IDOR sur `GET /checkout/orders/:id` : avant correctif,
 * n'importe quelle session pouvait lire n'importe quelle commande en
 * devinant/incrémentant son id numérique. Le correctif exige que la
 * commande appartienne au compte connecté (si elle est liée à un compte)
 * ou à la session invité qui l'a créée (sinon).
 */
describe("IDOR sur GET /checkout/orders/:id", () => {
  it("une session invité ne peut pas lire la commande d'une autre session invité", async () => {
    const { app, db } = createTestApp();
    const product = seedProduct(db, { priceCents: 1000, stock: 5 });

    const victim = request.agent(app);
    await victim.post("/cart/items").send({ productId: product.id, quantity: 1 });
    const victimOrder = await victim.post("/checkout").send();
    const { orderId } = victimOrder.body as { orderId: number };

    const attacker = request.agent(app);
    const res = await attacker.get(`/checkout/orders/${orderId}`);

    expect(res.status).toBe(404);
  });

  it("un compte connecté ne peut pas lire la commande d'un autre compte", async () => {
    const { app, db } = createTestApp();
    const product = seedProduct(db, { priceCents: 1000, stock: 5 });

    const victim = request.agent(app);
    await victim.post("/auth/register").send({ email: "victime@example.com", password: "password123" });
    await victim.post("/cart/items").send({ productId: product.id, quantity: 1 });
    const victimOrder = await victim.post("/checkout").send();
    const { orderId } = victimOrder.body as { orderId: number };

    const attacker = request.agent(app);
    await attacker.post("/auth/register").send({ email: "attaquant@example.com", password: "password123" });
    const res = await attacker.get(`/checkout/orders/${orderId}`);

    expect(res.status).toBe(404);
  });

  it("le propriétaire (session invité) peut toujours lire sa propre commande", async () => {
    const { app, db } = createTestApp();
    const product = seedProduct(db, { priceCents: 1000, stock: 5 });
    const agent = request.agent(app);
    await agent.post("/cart/items").send({ productId: product.id, quantity: 1 });
    const created = await agent.post("/checkout").send();
    const { orderId } = created.body as { orderId: number };

    const res = await agent.get(`/checkout/orders/${orderId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(orderId);
  });

  it("un id de commande inexistant ou non numérique renvoie 404", async () => {
    const { app } = createTestApp();
    const agent = request.agent(app);
    await agent.get("/products");

    const resMissing = await agent.get("/checkout/orders/999999");
    expect(resMissing.status).toBe(404);

    const resNaN = await agent.get("/checkout/orders/pas-un-nombre");
    expect(resNaN.status).toBe(404);
  });
});
