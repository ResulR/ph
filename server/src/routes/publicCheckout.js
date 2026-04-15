const express = require("express");
const { z } = require("zod");
const { pool } = require("../db/pool");
const { env } = require("../config/env");
const { getStripe } = require("../lib/stripe");

const publicCheckoutRouter = express.Router();

const cartItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("pates"),
    productId: z.union([z.string().min(1), z.number().int().positive()]),
    size: z.enum(["ravier", "assiette"]),
    quantity: z.number().int().positive("La quantité doit être supérieure à 0."),
  }),
  z.object({
    type: z.literal("paninis"),
    productId: z.union([z.string().min(1), z.number().int().positive()]),
    formula: z.enum(["seul", "menu"]),
    quantity: z.number().int().positive("La quantité doit être supérieure à 0."),
    beverageId: z.union([z.string().min(1), z.number().int().positive()]).optional(),
  }),
]);

const validateCheckoutSchema = z.object({
  mode: z.enum(["livraison", "retrait"]),
  items: z.array(cartItemSchema).min(1, "Le panier ne peut pas être vide."),
});

const customerSchema = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire."),
  telephone: z
    .string()
    .trim()
    .min(1, "Le téléphone est obligatoire.")
    .refine(isValidPhoneNumber, "Numéro de téléphone invalide."),
  email: z.string().trim().email("Email invalide."),
  adresse: z.string().trim().optional().default(""),
  commune: z.string().trim().optional().default(""),
  codePostal: z.string().trim().optional().default(""),
  instructions: z.string().trim().optional().default(""),
  note: z.string().trim().optional().default(""),
});

const createOrderSchema = z.object({
  mode: z.enum(["livraison", "retrait"]),
  items: z.array(cartItemSchema).min(1, "Le panier ne peut pas être vide."),
  customer: customerSchema,
});

function normalizePhoneNumber(value) {
  return String(value)
    .trim()
    .replace(/[()./\-\s]+/g, "");
}

function isValidPhoneNumber(value) {
  const normalized = normalizePhoneNumber(value);

  if (!normalized) {
    return false;
  }

  return /^\+?\d{8,15}$/.test(normalized);
}

function toPositiveInteger(value) {
  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    return null;
  }

  return normalized;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = pad2(now.getMonth() + 1);
  const day = pad2(now.getDate());
  const hours = pad2(now.getHours());
  const minutes = pad2(now.getMinutes());
  const seconds = pad2(now.getSeconds());
  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return `PH-${year}${month}${day}-${hours}${minutes}${seconds}-${randomPart}`;
}

const BRUSSELS_TIME_ZONE = "Europe/Brussels";

const dayKeys = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function getBrusselsDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRUSSELS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    dayKey: byType.weekday.toLowerCase(),
    time: `${byType.hour}:${byType.minute}:${byType.second}`,
  };
}

function shiftIsoDate(isoDateString, deltaDays) {
  const baseDate = new Date(`${isoDateString}T00:00:00Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() + deltaDays);
  return baseDate.toISOString().slice(0, 10);
}

function normalizeServiceDate(value) {
  return String(value).slice(0, 10);
}

function buildServiceWindow({ serviceDate, openTime, closeTime }) {
  if (!openTime || !closeTime) {
    return null;
  }

  const startsAt = `${serviceDate}T${openTime}`;
  const endsAt = closeTime > openTime
    ? `${serviceDate}T${closeTime}`
    : `${shiftIsoDate(serviceDate, 1)}T${closeTime}`;

  return {
    startsAt,
    endsAt,
  };
}

function isLocalDateTimeInWindow(localDateTime, window) {
  return localDateTime >= window.startsAt && localDateTime < window.endsAt;
}

async function getStoreAvailability() {
  const now = new Date();
  const currentParts = getBrusselsDateParts(now);
  const yesterdayDate = shiftIsoDate(currentParts.date, -1);
  const serviceDatesToCheck = [yesterdayDate, currentParts.date];

  const [openingHoursResult, overridesResult, closuresResult] = await Promise.all([
    pool.query(
      `
        SELECT
          day_key,
          is_open,
          open_time,
          close_time
        FROM opening_hours
      `
    ),
    pool.query(
      `
        SELECT
          service_date::text AS service_date,
          is_closed,
          open_time,
          close_time,
          note
        FROM schedule_overrides
        WHERE service_date = ANY($1::date[])
      `,
      [serviceDatesToCheck]
    ),
    pool.query(
      `
        SELECT
          id,
          starts_at,
          ends_at,
          reason
        FROM exceptional_closures
        WHERE starts_at <= NOW()
          AND ends_at > NOW()
        ORDER BY starts_at ASC, id ASC
      `
    ),
  ]);

  const openingHoursByDayKey = new Map(
    openingHoursResult.rows.map((row) => [row.day_key, row])
  );

  const overridesByServiceDate = new Map(
    overridesResult.rows.map((row) => [
      normalizeServiceDate(row.service_date),
      row,
    ])
  );

  const activeClosure = closuresResult.rows[0] || null;
  const localDateTime = `${currentParts.date}T${currentParts.time}`;

  const candidates = serviceDatesToCheck.map((serviceDate) => {
    const override = overridesByServiceDate.get(serviceDate);

    if (override) {
      if (override.is_closed) {
        return {
          source: "override",
          serviceDate,
          isClosed: true,
          note: override.note || null,
          window: null,
        };
      }

      return {
        source: "override",
        serviceDate,
        isClosed: false,
        note: override.note || null,
        window: buildServiceWindow({
          serviceDate,
          openTime: override.open_time,
          closeTime: override.close_time,
        }),
      };
    }

    const serviceDayKey = dayKeys[new Date(`${serviceDate}T00:00:00Z`).getUTCDay()];
    const openingHours = openingHoursByDayKey.get(serviceDayKey);

    if (!openingHours || !openingHours.is_open) {
      return {
        source: "opening_hours",
        serviceDate,
        isClosed: true,
        note: null,
        window: null,
      };
    }

    return {
      source: "opening_hours",
      serviceDate,
      isClosed: false,
      note: null,
      window: buildServiceWindow({
        serviceDate,
        openTime: openingHours.open_time,
        closeTime: openingHours.close_time,
      }),
    };
  });

  const matchingClosedOverride = candidates.find(
    (candidate) =>
      candidate.source === "override" &&
      candidate.isClosed &&
      candidate.serviceDate === currentParts.date
  );

  if (matchingClosedOverride) {
    return {
      isOpen: false,
      reason: "SCHEDULE_OVERRIDE_CLOSED",
      message: matchingClosedOverride.note
        ? `Le restaurant est fermé aujourd'hui : ${matchingClosedOverride.note}`
        : "Le restaurant est fermé aujourd'hui.",
    };
  }

  const candidateWindows = candidates.filter((candidate) => candidate.window);

  const activeWindow = candidateWindows.find((candidate) =>
    isLocalDateTimeInWindow(localDateTime, candidate.window)
  );

  if (activeClosure) {
    return {
      isOpen: false,
      reason: "EXCEPTIONAL_CLOSURE_ACTIVE",
      message: activeClosure.reason
        ? `Le restaurant est actuellement fermé : ${activeClosure.reason}`
        : "Le restaurant est actuellement fermé exceptionnellement.",
    };
  }

  if (!activeWindow) {
    return {
      isOpen: false,
      reason: "OUTSIDE_OPENING_HOURS",
      message: "Le restaurant est actuellement fermé.",
    };
  }

  if (activeWindow.source === "override") {
    return {
      isOpen: true,
      reason: null,
      message: null,
    };
  }

  return {
    isOpen: true,
    reason: null,
    message: null,
  };
}

function validateCustomerPayload(mode, customer) {
  if (mode !== "livraison") {
    return null;
  }

  const deliveryFieldErrors = {};

  if (!customer.adresse.trim()) {
    deliveryFieldErrors.adresse = ["L'adresse est obligatoire."];
  }

  if (!customer.commune.trim()) {
    deliveryFieldErrors.commune = ["La commune est obligatoire."];
  }

  if (!customer.codePostal.trim()) {
    deliveryFieldErrors.codePostal = ["Le code postal est obligatoire."];
  }

  if (Object.keys(deliveryFieldErrors).length === 0) {
    return null;
  }

  return {
    ok: false,
    error: "INVALID_REQUEST_BODY",
    message: "Corps de requête invalide.",
    errors: {
      formErrors: [],
      fieldErrors: deliveryFieldErrors,
    },
  };
}

async function createOrderRecord({ client, mode, customer, validatedCart }) {
  const fulfillmentMethod = mode === "livraison" ? "delivery" : "pickup";
  const customerNote = mode === "livraison"
    ? (customer.instructions.trim() || null)
    : (customer.note.trim() || null);

  let orderNumber = generateOrderNumber();

  while (true) {
    const existingOrderNumberResult = await client.query(
      `
        SELECT id
        FROM orders
        WHERE order_number = $1
        LIMIT 1
      `,
      [orderNumber]
    );

    if (existingOrderNumberResult.rowCount === 0) {
      break;
    }

    orderNumber = generateOrderNumber();
  }

  const createdOrderResult = await client.query(
    `
      INSERT INTO orders (
        order_number,
        status,
        fulfillment_method,
        customer_name,
        customer_phone,
        customer_email,
        delivery_address_line1,
        delivery_postal_code,
        delivery_city,
        customer_note,
        subtotal_cents,
        delivery_fee_cents,
        total_cents,
        currency
      )
      VALUES (
        $1,
        'awaiting_payment',
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13
      )
      RETURNING
        id,
        order_number,
        status,
        fulfillment_method,
        customer_name,
        customer_phone,
        customer_email,
        delivery_address_line1,
        delivery_postal_code,
        delivery_city,
        customer_note,
        subtotal_cents,
        delivery_fee_cents,
        total_cents,
        currency,
        created_at
    `,
    [
      orderNumber,
      fulfillmentMethod,
      customer.nom.trim(),
      normalizePhoneNumber(customer.telephone),
      customer.email.trim(),
      mode === "livraison" ? customer.adresse.trim() : null,
      mode === "livraison" ? customer.codePostal.trim() : null,
      mode === "livraison" ? customer.commune.trim() : null,
      customerNote,
      validatedCart.subtotalCents,
      validatedCart.deliveryFeeCents,
      validatedCart.totalCents,
      validatedCart.currency,
    ]
  );

  const createdOrder = createdOrderResult.rows[0];

  for (let index = 0; index < validatedCart.items.length; index += 1) {
    const item = validatedCart.items[index];
    const lineNumber = index + 1;

    if (item.itemType === "product") {
      await client.query(
        `
          INSERT INTO order_items (
            order_id,
            line_number,
            item_type,
            product_id,
            product_variant_id,
            product_name_snapshot,
            variant_code_snapshot,
            variant_name_snapshot,
            unit_price_cents,
            quantity,
            line_total_cents
          )
          VALUES ($1, $2, 'product', $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          createdOrder.id,
          lineNumber,
          Number(item.productId),
          Number(item.variantId),
          item.productName,
          item.variantCode,
          item.variantName,
          item.unitPriceCents,
          item.quantity,
          item.lineTotalCents,
        ]
      );

      continue;
    }

    await client.query(
      `
        INSERT INTO order_items (
          order_id,
          line_number,
          item_type,
          beverage_id,
          beverage_name_snapshot,
          unit_price_cents,
          quantity,
          line_total_cents
        )
        VALUES ($1, $2, 'beverage', $3, $4, $5, $6, $7)
      `,
      [
        createdOrder.id,
        lineNumber,
        Number(item.beverageId),
        item.beverageName,
        item.unitPriceCents,
        item.quantity,
        item.lineTotalCents,
      ]
    );
  }

  await client.query(
    `
      INSERT INTO order_status_history (
        order_id,
        status,
        note,
        changed_by_admin_id
      )
      VALUES ($1, 'awaiting_payment', $2, NULL)
    `,
    [createdOrder.id, "Commande créée en attente de paiement."]
  );

  return createdOrder;
}

function buildStripeLineItems(validatedCart) {
  const lineItems = [];
  const itemsByKey = new Map();

  for (const item of validatedCart.items) {
    let key = "";

    if (item.itemType === "product") {
      key = `product::${item.productId}::${item.variantId}`;
    } else {
      key = `beverage::${item.beverageId}::${item.unitPriceCents}`;
    }

    const existing = itemsByKey.get(key);

    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }

    if (item.itemType === "product") {
      itemsByKey.set(key, {
        price_data: {
          currency: validatedCart.currency.toLowerCase(),
          product_data: {
            name: item.productName,
            description: item.variantName,
          },
          unit_amount: item.unitPriceCents,
        },
        quantity: item.quantity,
      });
      continue;
    }

    itemsByKey.set(key, {
      price_data: {
        currency: validatedCart.currency.toLowerCase(),
        product_data: {
          name: item.beverageName,
        },
        unit_amount: item.unitPriceCents,
      },
      quantity: item.quantity,
    });
  }

  for (const lineItem of itemsByKey.values()) {
    lineItems.push(lineItem);
  }

  if (validatedCart.deliveryFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: validatedCart.currency.toLowerCase(),
        product_data: {
          name: "Frais de livraison",
        },
        unit_amount: validatedCart.deliveryFeeCents,
      },
      quantity: 1,
    });
  }

  return lineItems;
}

function getOrderIdFromStripeSession(session) {
  const metadataOrderId = session?.metadata?.order_id;
  const clientReferenceId = session?.client_reference_id;

  const orderId = metadataOrderId || clientReferenceId;
  const normalizedOrderId = toPositiveInteger(orderId);

  return normalizedOrderId;
}

async function markOrderPaid({ client, orderId, paymentIntentId, note }) {
  const existingOrderResult = await client.query(
    `
      SELECT id, status, stripe_payment_intent_id, paid_at
      FROM orders
      WHERE id = $1
      LIMIT 1
    `,
    [orderId]
  );

  if (existingOrderResult.rowCount === 0) {
    throw new Error(`Order ${orderId} not found.`);
  }

  const existingOrder = existingOrderResult.rows[0];

  if (existingOrder.status === "paid") {
    await client.query(
      `
        UPDATE orders
        SET stripe_payment_intent_id = COALESCE($1, stripe_payment_intent_id),
            paid_at = COALESCE(paid_at, NOW()),
            updated_at = NOW()
        WHERE id = $2
      `,
      [paymentIntentId || null, orderId]
    );

    return;
  }

  await client.query(
    `
      UPDATE orders
      SET status = 'paid',
          stripe_payment_intent_id = $1,
          paid_at = COALESCE(paid_at, NOW()),
          updated_at = NOW()
      WHERE id = $2
    `,
    [paymentIntentId || null, orderId]
  );

  await client.query(
    `
      INSERT INTO order_status_history (
        order_id,
        status,
        note,
        changed_by_admin_id
      )
      VALUES ($1, 'paid', $2, NULL)
    `,
    [orderId, note]
  );
}

async function markOrderPaymentFailed({ client, orderId, paymentIntentId, note }) {
  const existingOrderResult = await client.query(
    `
      SELECT id, status, stripe_payment_intent_id
      FROM orders
      WHERE id = $1
      LIMIT 1
    `,
    [orderId]
  );

  if (existingOrderResult.rowCount === 0) {
    throw new Error(`Order ${orderId} not found.`);
  }

  const existingOrder = existingOrderResult.rows[0];

  if (existingOrder.status === "payment_failed") {
    await client.query(
      `
        UPDATE orders
        SET stripe_payment_intent_id = COALESCE($1, stripe_payment_intent_id),
            updated_at = NOW()
        WHERE id = $2
      `,
      [paymentIntentId || null, orderId]
    );

    return;
  }

  await client.query(
    `
      UPDATE orders
      SET status = 'payment_failed',
          stripe_payment_intent_id = COALESCE($1, stripe_payment_intent_id),
          updated_at = NOW()
      WHERE id = $2
    `,
    [paymentIntentId || null, orderId]
  );

  await client.query(
    `
      INSERT INTO order_status_history (
        order_id,
        status,
        note,
        changed_by_admin_id
      )
      VALUES ($1, 'payment_failed', $2, NULL)
    `,
    [orderId, note]
  );
}

async function processStripeWebhookEvent({ client, event }) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orderId = getOrderIdFromStripeSession(session);

      if (!orderId) {
        throw new Error("Missing order_id in checkout.session.completed.");
      }

      if (session.payment_status !== "paid") {
        return;
      }

      await markOrderPaid({
        client,
        orderId,
        paymentIntentId: session.payment_intent || null,
        note: "Paiement Stripe confirmé via webhook checkout.session.completed.",
      });

      return;
    }

    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const orderId = getOrderIdFromStripeSession(session);

      if (!orderId) {
        throw new Error("Missing order_id in checkout.session.async_payment_succeeded.");
      }

      await markOrderPaid({
        client,
        orderId,
        paymentIntentId: session.payment_intent || null,
        note: "Paiement Stripe asynchrone confirmé via webhook.",
      });

      return;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      const orderId = getOrderIdFromStripeSession(session);

      if (!orderId) {
        throw new Error("Missing order_id in checkout.session.async_payment_failed.");
      }

      await markOrderPaymentFailed({
        client,
        orderId,
        paymentIntentId: session.payment_intent || null,
        note: "Le paiement Stripe asynchrone a échoué.",
      });

      return;
    }

    default:
      return;
  }
}

async function validateCartPayload({ mode, items }) {
  const normalizedItems = [];
  const validationErrors = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const normalizedProductId = toPositiveInteger(item.productId);

    if (!normalizedProductId) {
      validationErrors.push({
        code: "INVALID_PRODUCT_ID",
        message: "Identifiant produit invalide.",
        itemIndex: index,
      });
      continue;
    }

    if (item.type === "pates") {
      normalizedItems.push({
        itemIndex: index,
        type: item.type,
        productId: normalizedProductId,
        variantCode: item.size,
        quantity: item.quantity,
      });
      continue;
    }

    const normalizedBeverageId = item.beverageId === undefined
      ? null
      : toPositiveInteger(item.beverageId);

    if (item.formula === "menu" && !normalizedBeverageId) {
      validationErrors.push({
        code: "MISSING_MENU_BEVERAGE",
        message: "Une boisson est obligatoire pour un panini menu.",
        itemIndex: index,
      });
      continue;
    }

    if (item.beverageId !== undefined && !normalizedBeverageId) {
      validationErrors.push({
        code: "INVALID_BEVERAGE_ID",
        message: "Identifiant boisson invalide.",
        itemIndex: index,
      });
      continue;
    }

    normalizedItems.push({
      itemIndex: index,
      type: item.type,
      productId: normalizedProductId,
      variantCode: item.formula,
      quantity: item.quantity,
      beverageId: normalizedBeverageId,
    });
  }

  if (validationErrors.length > 0) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        ok: false,
        error: "CART_VALIDATION_FAILED",
        details: validationErrors,
      },
    };
  }

  const productIds = [...new Set(normalizedItems.map((item) => item.productId))];
  const beverageIds = [
    ...new Set(
      normalizedItems
        .filter((item) => item.type === "paninis" && item.beverageId)
        .map((item) => item.beverageId)
    ),
  ];

  const [productsResult, variantsResult, beveragesResult, deliverySettingsResult] = await Promise.all([
    pool.query(
      `
        SELECT
          id,
          category_id,
          name,
          is_active,
          is_available
        FROM products
        WHERE id = ANY($1::bigint[])
      `,
      [productIds]
    ),
    pool.query(
      `
        SELECT
          id,
          product_id,
          code,
          name,
          price_cents,
          is_active
        FROM product_variants
        WHERE product_id = ANY($1::bigint[])
      `,
      [productIds]
    ),
    beverageIds.length > 0
      ? pool.query(
          `
            SELECT
              id,
              name,
              price_cents,
              is_active,
              is_menu_eligible
            FROM beverages
            WHERE id = ANY($1::bigint[])
          `,
          [beverageIds]
        )
      : Promise.resolve({ rows: [] }),
    pool.query(
      `
        SELECT
          delivery_enabled,
          pickup_enabled,
          delivery_fee_cents,
          minimum_order_cents
        FROM delivery_settings
        LIMIT 1
      `
    ),
  ]);

  const deliverySettings = deliverySettingsResult.rows[0] || null;

  if (!deliverySettings) {
    return {
      ok: false,
      statusCode: 500,
      body: {
        ok: false,
        error: "DELIVERY_SETTINGS_NOT_FOUND",
      },
    };
  }

  if (mode === "livraison" && !deliverySettings.delivery_enabled) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        ok: false,
        error: "DELIVERY_DISABLED",
        message: "La livraison est actuellement indisponible.",
      },
    };
  }

  if (mode === "retrait" && !deliverySettings.pickup_enabled) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        ok: false,
        error: "PICKUP_DISABLED",
        message: "Le retrait est actuellement indisponible.",
      },
    };
  }

  const productsById = new Map(
    productsResult.rows.map((product) => [String(product.id), product])
  );

  const variantsByProductAndCode = new Map();

  for (const variant of variantsResult.rows) {
    variantsByProductAndCode.set(
      `${String(variant.product_id)}::${variant.code}`,
      variant
    );
  }

  const beveragesById = new Map(
    beveragesResult.rows.map((beverage) => [String(beverage.id), beverage])
  );

  const validatedItems = [];
  let subtotalCents = 0;

  for (const item of normalizedItems) {
    const product = productsById.get(String(item.productId));

    if (!product) {
      validationErrors.push({
        code: "PRODUCT_NOT_FOUND",
        message: "Produit introuvable.",
        itemIndex: item.itemIndex,
      });
      continue;
    }

    if (!product.is_active) {
      validationErrors.push({
        code: "PRODUCT_INACTIVE",
        message: `Le produit "${product.name}" n'est pas actif.`,
        itemIndex: item.itemIndex,
      });
      continue;
    }

    if (!product.is_available) {
      validationErrors.push({
        code: "PRODUCT_UNAVAILABLE",
        message: `Le produit "${product.name}" n'est plus disponible.`,
        itemIndex: item.itemIndex,
      });
      continue;
    }

    const variant = variantsByProductAndCode.get(
      `${String(item.productId)}::${item.variantCode}`
    );

    if (!variant) {
      validationErrors.push({
        code: "VARIANT_NOT_FOUND",
        message: `La variante demandée est introuvable pour "${product.name}".`,
        itemIndex: item.itemIndex,
      });
      continue;
    }

    if (!variant.is_active) {
      validationErrors.push({
        code: "VARIANT_INACTIVE",
        message: `La variante "${variant.name}" n'est pas active pour "${product.name}".`,
        itemIndex: item.itemIndex,
      });
      continue;
    }

    const lineTotalCents = Number(variant.price_cents) * item.quantity;

    validatedItems.push({
      itemType: "product",
      productId: String(product.id),
      productName: product.name,
      variantId: String(variant.id),
      variantCode: variant.code,
      variantName: variant.name,
      unitPriceCents: Number(variant.price_cents),
      quantity: item.quantity,
      lineTotalCents,
    });

    subtotalCents += lineTotalCents;

    if (item.type === "paninis" && item.beverageId) {
      const beverage = beveragesById.get(String(item.beverageId));

      if (!beverage) {
        validationErrors.push({
          code: "BEVERAGE_NOT_FOUND",
          message: "Boisson introuvable pour le panini.",
          itemIndex: item.itemIndex,
        });
        continue;
      }

      if (!beverage.is_active) {
        validationErrors.push({
          code: "BEVERAGE_INACTIVE",
          message: `La boisson "${beverage.name}" n'est pas active.`,
          itemIndex: item.itemIndex,
        });
        continue;
      }

      if (item.variantCode === "menu") {
        if (!beverage.is_menu_eligible) {
          validationErrors.push({
            code: "BEVERAGE_NOT_MENU_ELIGIBLE",
            message: `La boisson "${beverage.name}" n'est pas autorisée dans un menu.`,
            itemIndex: item.itemIndex,
          });
          continue;
        }

        validatedItems.push({
          itemType: "beverage",
          beverageId: String(beverage.id),
          beverageName: beverage.name,
          unitPriceCents: 0,
          quantity: item.quantity,
          lineTotalCents: 0,
        });

        continue;
      }

      const beverageUnitPriceCents = Number(beverage.price_cents);

      if (!Number.isInteger(beverageUnitPriceCents) || beverageUnitPriceCents < 0) {
        validationErrors.push({
          code: "BEVERAGE_PRICE_INVALID",
          message: `Le prix de la boisson "${beverage.name}" est invalide.`,
          itemIndex: item.itemIndex,
        });
        continue;
      }

      const beverageLineTotalCents = beverageUnitPriceCents * item.quantity;

      validatedItems.push({
        itemType: "beverage",
        beverageId: String(beverage.id),
        beverageName: beverage.name,
        unitPriceCents: beverageUnitPriceCents,
        quantity: item.quantity,
        lineTotalCents: beverageLineTotalCents,
      });

      subtotalCents += beverageLineTotalCents;
    }
  }

  if (validationErrors.length > 0) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        ok: false,
        error: "CART_VALIDATION_FAILED",
        details: validationErrors,
      },
    };
  }

  const minimumOrderCents = Number(deliverySettings.minimum_order_cents);
  const deliveryFeeCents = mode === "livraison"
    ? Number(deliverySettings.delivery_fee_cents)
    : 0;

  const meetsMinimum = mode === "livraison"
    ? subtotalCents >= minimumOrderCents
    : true;

  if (!meetsMinimum) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        ok: false,
        error: "CART_VALIDATION_FAILED",
        details: [
          {
            code: "MINIMUM_NOT_REACHED",
            message: "Le minimum de commande pour la livraison n'est pas atteint.",
          },
        ],
      },
    };
  }

  const totalCents = subtotalCents + deliveryFeeCents;

  return {
    ok: true,
    data: {
      mode,
      currency: "EUR",
      items: validatedItems,
      subtotalCents,
      deliveryFeeCents,
      minimumOrderCents,
      meetsMinimum,
      totalCents,
    },
  };
}

publicCheckoutRouter.post("/stripe/webhook", async (req, res) => {
  const signature = req.headers["stripe-signature"];

  if (!env.stripeSecretKey || !env.stripeWebhookSecret) {
    return res.status(500).json({
      ok: false,
      error: "STRIPE_WEBHOOK_NOT_CONFIGURED",
    });
  }

  if (!signature) {
    return res.status(400).json({
      ok: false,
      error: "MISSING_STRIPE_SIGNATURE",
    });
  }

  let event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      env.stripeWebhookSecret
    );
  } catch (error) {
    console.error("Stripe webhook signature error:", error);
    return res.status(400).json({
      ok: false,
      error: "INVALID_STRIPE_SIGNATURE",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingEventResult = await client.query(
      `
        SELECT id, processed_at
        FROM webhook_events
        WHERE provider = $1
          AND event_id = $2
        LIMIT 1
      `,
      ["stripe", event.id]
    );

    if (existingEventResult.rowCount > 0) {
      await client.query("COMMIT");
      return res.status(200).json({ received: true, duplicate: true });
    }

    const insertedEventResult = await client.query(
      `
        INSERT INTO webhook_events (
          provider,
          event_id,
          event_type,
          payload
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      ["stripe", event.id, event.type, JSON.stringify(event)]
    );

    const webhookEventId = insertedEventResult.rows[0].id;

    await client.query("SAVEPOINT stripe_webhook_processing");

    try {
      await processStripeWebhookEvent({ client, event });

      await client.query(
        `
          UPDATE webhook_events
          SET processed_at = NOW(),
              processing_error = NULL
          WHERE id = $1
        `,
        [webhookEventId]
      );

      await client.query("COMMIT");

      return res.status(200).json({ received: true });
    } catch (processingError) {
      await client.query("ROLLBACK TO SAVEPOINT stripe_webhook_processing");

      await client.query(
        `
          UPDATE webhook_events
          SET processing_error = $2
          WHERE id = $1
        `,
        [webhookEventId, processingError.message]
      );

      await client.query("COMMIT");

      console.error("Stripe webhook processing error:", processingError);

      return res.status(500).json({
        ok: false,
        error: "STRIPE_WEBHOOK_PROCESSING_FAILED",
      });
    }
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // no-op
    }

    console.error("POST /api/public/stripe/webhook error:", error);

    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  } finally {
    client.release();
  }
});

publicCheckoutRouter.post("/checkout/validate", async (req, res) => {
  try {
    const parsed = validateCheckoutSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST_BODY",
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const validationResult = await validateCartPayload(parsed.data);

    if (!validationResult.ok) {
      return res.status(validationResult.statusCode).json(validationResult.body);
    }

    const storeAvailability = await getStoreAvailability();

    if (!storeAvailability.isOpen) {
      return res.status(400).json({
        ok: false,
        error: "STORE_CLOSED",
        message: storeAvailability.message,
        details: [
          {
            code: storeAvailability.reason,
            message: storeAvailability.message,
          },
        ],
      });
    }

    return res.status(200).json({
      ok: true,
      data: validationResult.data,
    });
  } catch (error) {
    console.error("POST /api/public/checkout/validate error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

publicCheckoutRouter.post("/checkout/session", async (req, res) => {
  const client = await pool.connect();

  try {
    if (!env.stripeSecretKey) {
      return res.status(500).json({
        ok: false,
        error: "STRIPE_NOT_CONFIGURED",
        message: "Le paiement Stripe n'est pas encore configuré sur le serveur.",
      });
    }

    const parsed = createOrderSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST_BODY",
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const { mode, items, customer } = parsed.data;
    const customerValidationError = validateCustomerPayload(mode, customer);

    if (customerValidationError) {
      return res.status(400).json(customerValidationError);
    }

    const validationResult = await validateCartPayload({ mode, items });

    if (!validationResult.ok) {
      return res.status(validationResult.statusCode).json(validationResult.body);
    }

    const storeAvailability = await getStoreAvailability();

    if (!storeAvailability.isOpen) {
      return res.status(400).json({
        ok: false,
        error: "STORE_CLOSED",
        message: storeAvailability.message,
      });
    }

    const validatedCart = validationResult.data;
    const stripe = getStripe();
    const stripeLineItems = buildStripeLineItems(validatedCart);

    await client.query("BEGIN");

    const createdOrder = await createOrderRecord({
      client,
      mode,
      customer,
      validatedCart,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${env.appBaseUrl}/commande-confirmee?orderNumber=${encodeURIComponent(createdOrder.order_number)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.appBaseUrl}/paiement-annule?orderNumber=${encodeURIComponent(createdOrder.order_number)}`,
      client_reference_id: String(createdOrder.id),
      customer_email: customer.email.trim(),
      metadata: {
        order_id: String(createdOrder.id),
        order_number: createdOrder.order_number,
      },
      line_items: stripeLineItems,
    });

    await client.query(
      `
        UPDATE orders
        SET stripe_checkout_session_id = $1,
            updated_at = NOW()
        WHERE id = $2
      `,
      [session.id, createdOrder.id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      data: {
        orderId: String(createdOrder.id),
        orderNumber: createdOrder.order_number,
        status: createdOrder.status,
        checkoutSessionId: session.id,
        checkoutUrl: session.url,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // no-op
    }

    console.error("POST /api/public/checkout/session error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  } finally {
    client.release();
  }
});

publicCheckoutRouter.post("/orders", async (req, res) => {
  const client = await pool.connect();

  try {
    const parsed = createOrderSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST_BODY",
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const { mode, items, customer } = parsed.data;
    const customerValidationError = validateCustomerPayload(mode, customer);

    if (customerValidationError) {
      return res.status(400).json(customerValidationError);
    }

    const validationResult = await validateCartPayload({ mode, items });

    if (!validationResult.ok) {
      return res.status(validationResult.statusCode).json(validationResult.body);
    }

    const storeAvailability = await getStoreAvailability();

    if (!storeAvailability.isOpen) {
      return res.status(400).json({
        ok: false,
        error: "STORE_CLOSED",
        message: storeAvailability.message,
      });
    }

    const validatedCart = validationResult.data;

    await client.query("BEGIN");

    const createdOrder = await createOrderRecord({
      client,
      mode,
      customer,
      validatedCart,
    });

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      data: {
        id: String(createdOrder.id),
        orderNumber: createdOrder.order_number,
        status: createdOrder.status,
        fulfillmentMethod: createdOrder.fulfillment_method,
        customerName: createdOrder.customer_name,
        customerPhone: createdOrder.customer_phone,
        customerEmail: createdOrder.customer_email,
        deliveryAddressLine1: createdOrder.delivery_address_line1,
        deliveryPostalCode: createdOrder.delivery_postal_code,
        deliveryCity: createdOrder.delivery_city,
        customerNote: createdOrder.customer_note,
        subtotalCents: Number(createdOrder.subtotal_cents),
        deliveryFeeCents: Number(createdOrder.delivery_fee_cents),
        totalCents: Number(createdOrder.total_cents),
        currency: createdOrder.currency,
        createdAt: createdOrder.created_at,
        items: validatedCart.items,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // no-op
    }

    console.error("POST /api/public/orders error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  } finally {
    client.release();
  }
});

publicCheckoutRouter.get("/orders/confirmation", async (req, res) => {
  try {
    const sessionId = typeof req.query.session_id === "string"
      ? req.query.session_id.trim()
      : "";

    const orderNumber = typeof req.query.orderNumber === "string"
      ? req.query.orderNumber.trim()
      : "";

    if (!sessionId || !orderNumber) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST",
        message: "session_id et orderNumber sont obligatoires.",
      });
    }

    const result = await pool.query(
      `
        SELECT
          id,
          order_number,
          status,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          paid_at,
          created_at
        FROM orders
        WHERE stripe_checkout_session_id = $1
          AND order_number = $2
        LIMIT 1
      `,
      [sessionId, orderNumber]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        error: "ORDER_NOT_FOUND",
        message: "Commande introuvable.",
      });
    }

    const order = result.rows[0];
    const paymentConfirmed = order.status === "paid" || order.paid_at !== null;

    return res.status(200).json({
      ok: true,
      data: {
        orderNumber: order.order_number,
        status: order.status,
        paidAt: order.paid_at,
        stripePaymentIntentId: order.stripe_payment_intent_id,
        paymentConfirmed,
        createdAt: order.created_at,
      },
    });
  } catch (error) {
    console.error("GET /api/public/orders/confirmation error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

module.exports = { publicCheckoutRouter };