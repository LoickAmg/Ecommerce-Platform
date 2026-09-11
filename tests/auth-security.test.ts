import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers.js";

describe("validation de l'email sur /auth", () => {
  it("400 à l'inscription si l'email n'a pas de forme valide", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "pas-un-email", password: "password123" });
    expect(res.status).toBe(400);
  });

  it("400 à la connexion si l'email n'a pas de forme valide", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "pas-un-email", password: "password123" });
    expect(res.status).toBe(400);
  });

  it("accepte toujours un email de forme valide", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "valide@example.com", password: "password123" });
    expect(res.status).toBe(201);
  });
});

describe("limite de débit sur /auth/login", () => {
  it("bloque avec 429 après trop de tentatives depuis la même IP", async () => {
    const { app, db } = createTestApp();
    // Compte existant pour isoler le test de la limite de débit (et non de
    // la logique d'échec d'authentification elle-même).
    await request(app)
      .post("/auth/register")
      .send({ email: "brute@example.com", password: "password123" });

    let lastStatus = 0;
    for (let i = 0; i < 11; i += 1) {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "brute@example.com", password: "mauvais-mot-de-passe" });
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
    void db;
  });

  it("n'affecte pas une connexion légitime tant que la limite n'est pas atteinte", async () => {
    const { app } = createTestApp();
    await request(app)
      .post("/auth/register")
      .send({ email: "ok@example.com", password: "password123" });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "ok@example.com", password: "password123" });

    expect(res.status).toBe(200);
  });
});

describe("limite de débit sur /auth/register", () => {
  it("bloque avec 429 après trop d'inscriptions depuis la même IP", async () => {
    const { app } = createTestApp();
    let lastStatus = 0;
    for (let i = 0; i < 11; i += 1) {
      const res = await request(app)
        .post("/auth/register")
        .send({ email: `spam-${i}@example.com`, password: "password123" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
