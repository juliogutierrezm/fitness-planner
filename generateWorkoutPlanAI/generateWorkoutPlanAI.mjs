import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { TextDecoder } from "util";
import { jsonrepair } from "jsonrepair";

const REGION = process.env.AWS_REGION || "us-east-1";
const EXERCISES_TABLE = process.env.EXERCISES_TABLE || "Exercises";
// Usa tu modelo con acceso concedido (o sobreescribe con env var MODEL_ID)
const MODEL_ID = process.env.MODEL_ID || "anthropic.claude-3-sonnet-20240229-v1:0";
const ANTHROPIC_VERSION = "bedrock-2023-05-31";

const dynamo = new DynamoDBClient({ region: REGION });
const bedrock = new BedrockRuntimeClient({ region: REGION });

const nextId = (() => {
  let counter = 0;
  return (prefix = "item") => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
})();

const ensureNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const handler = async (event) => {
  try {
    // Responder preflight (si tienes Lambda Proxy Integration)
    if (event?.httpMethod === "OPTIONS") {
      return corsResponse(200, { ok: true }, event);
    }

    const body = event?.body
      ? (typeof event.body === "string" ? JSON.parse(event.body) : event.body)
      : event || {};
    const userPrompt = body?.prompt?.trim();
    const generalNotes = body?.generalNotes?.trim() ?? null;

    if (!userPrompt) {
      return corsResponse(400, { message: "Falta el campo 'prompt'" }, event);
    }

    // 1) DynamoDB: ejercicios
    const { Items = [] } = await dynamo.send(
      new ScanCommand({
        TableName: EXERCISES_TABLE,
        ProjectionExpression: "#n, equipment, muscle, category",
        ExpressionAttributeNames: { "#n": "name" }
      })
    );

    const exercises = Items.map((i) => ({
      name: i.name?.S ?? "",
      equipment: i.equipment?.S ?? "Sin equipo",
      muscle: i.muscle?.S ?? "Desconocido",
      category: i.category?.S ?? "General"
    })).filter((e) => e.name);

    const nameToMeta = Object.fromEntries(exercises.map((e) => [e.name.toLowerCase(), e]));

    // 2) Prompt
    const fullPrompt = `
Eres un entrenador personal senior.
Lista de ejercicios permitidos:
${JSON.stringify(exercises, null, 2)}

Objetivo del usuario: ${userPrompt}

REGLAS DE FORMATO
- Devuelve SOLO el JSON: array de sesiones.
- Cada sesión debe tener "day" o "name", y "items".
- "sets" y "rest" número. "reps" número o string (8-12, 60 s, AMRAP 5').
- Para superseries:
{ "name":"Superserie","isGroup":true,"children":[{ej1},{ej2}] }
- Copia exactamente el "name" de la lista. No inventes ejercicios.
`.trim();

    // 3) Bedrock (Claude 3.x)
    const requestBody = {
      anthropic_version: ANTHROPIC_VERSION,
      max_tokens: 900,
      temperature: 0.5,
      top_p: 0.9,
      messages: [
        { role: "user", content: [{ type: "text", text: fullPrompt }] }
      ]
    };

    const aiRes = await bedrock.send(
      new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(requestBody)
      })
    );

    // 4) Parse
    const raw = new TextDecoder().decode(aiRes.body);
    const parsed = JSON.parse(raw);
    const completion = (parsed?.content?.[0]?.text ?? "").trim();

    if (!completion) {
      return corsResponse(500, { message: "Modelo no devolvió texto", raw: parsed }, event);
    }

    const s = completion.indexOf("[");
    const e = completion.lastIndexOf("]");
    if (s === -1 || e === -1) {
      return corsResponse(500, { message: "Modelo no devolvió JSON", raw: completion }, event);
    }

    let planJson = completion
      .slice(s, e + 1)
      .replace(/"notes":\s*null/gi, '"notes": ""');

    let plan;
    try {
      plan = JSON.parse(planJson);
    } catch {
      plan = JSON.parse(jsonrepair(planJson));
    }

    // 5) Normalización + enriquecimiento
    const normalise = (str) =>
      String(str || "")
        .toLowerCase()
        .replace(/\s*\([^)]*\)/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const findMeta = (nameRaw) => {
      if (!nameRaw) return null;
      const exact = nameToMeta[nameRaw.toLowerCase()];
      if (exact) return exact;
      const alt = normalise(nameRaw);
      return exercises.find((e) => normalise(e.name) === alt) ?? null;
    };

    const missingExercises = new Set();

    const enrich = (it) => {
      if (!it?.name) {
        return null;
      }
      const meta = findMeta(it.name);
      if (!meta) {
        missingExercises.add(String(it.name).trim());
        return null;
      }

      const id = typeof it.id === "string" && it.id.trim().length ? it.id : nextId("item");
      return {
        ...it,
        id,
        name: meta.name,
        equipment: meta.equipment,
        muscle: meta.muscle,
        category: meta.category,
        sets: ensureNumber(it.sets, 3),
        reps: typeof it.reps === "number" || typeof it.reps === "string" ? it.reps : 10,
        rest: ensureNumber(it.rest, 60),
        notes: typeof it.notes === "string" ? it.notes : "",
        selected: false
      };
    };

    const buildGroup = (candidate) => {
      const kids = Array.isArray(candidate?.children)
        ? candidate.children.map((child) => enrich(child)).filter(Boolean)
        : [];

      if (!kids.length) {
        return null;
      }

      const groupId =
        typeof candidate.id === "string" && candidate.id.trim().length
          ? candidate.id
          : nextId("superset");
      const displayName = `Superserie: ${kids.map((k) => k.name).join(" + ")}`;
      const setsValue = ensureNumber(candidate.sets, kids[0]?.sets ?? 3);
      const restValue = ensureNumber(candidate.rest, kids[0]?.rest ?? 60);
      const repsValue =
        typeof candidate.reps === "number" || typeof candidate.reps === "string"
          ? candidate.reps
          : kids[0]?.reps ?? 10;
      const groupNotes = typeof candidate.notes === "string" ? candidate.notes : "";

      const childrenWithMeta = kids.map((child, idx) => ({
        ...child,
        parentGroupId: groupId,
        supersetOrder: idx + 1,
        supersetSize: kids.length
      }));

      return {
        id: groupId,
        name: "Superserie",
        displayName,
        isGroup: true,
        groupSize: kids.length,
        sets: setsValue,
        reps: repsValue,
        rest: restValue,
        notes: groupNotes,
        children: childrenWithMeta
      };
    };

    plan = (Array.isArray(plan) ? plan : []).map((sess, idx) => {
      const items = Array.isArray(sess?.items)
        ? sess.items
        : Array.isArray(sess?.children)
        ? sess.children
        : [];
      return {
        id: idx + 1,
        name: sess?.day ?? sess?.name ?? `Día ${idx + 1}`,
        items
      };
    });

    for (const session of plan) {
      session.items = (session.items || [])
        .map((item) => {
          if (item?.isGroup || Array.isArray(item?.children)) {
            return buildGroup(item);
          }
          return enrich(item);
        })
        .filter(Boolean);
    }

    if (missingExercises.size) {
      return corsResponse(422, {
        message: "Algunos ejercicios solicitados no están en el catálogo",
        missingExercises: Array.from(missingExercises)
      }, event);
    }

    const planLegacy = plan.map((session) => ({
      id: session.id,
      name: session.name,
      items: (session.items || []).flatMap((item) => {
        if (!item?.isGroup) {
          const { children, ...rest } = item;
          return [{ ...rest, isGroup: false }];
        }

        const supersetId = item.id ?? nextId("superset");
        return item.children.map((child) => {
          const { children: childChildren, ...restChild } = child;
          return {
            ...restChild,
            isGroup: false,
            supersetId,
            supersetLabel: item.displayName || "Superserie",
            supersetOrder: child.supersetOrder,
            supersetSize: child.supersetSize ?? item.groupSize ?? item.children.length
          };
        });
      })
    }));

    return corsResponse(200, { plan, planLegacy, generalNotes }, event);
  } catch (err) {
    console.error("❌ Error Lambda:", err);
    return corsResponse(500, { message: "Error interno", error: err?.message || String(err) }, event);
  }
};

// CORS helpers
const getOrigin = (event) => {
  const o = event?.headers?.origin || event?.headers?.Origin || "";
  return typeof o === "string" && o.length ? o : "";
};

const corsHeaders = (event) => ({
  "Access-Control-Allow-Origin": getOrigin(event),
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
});

const corsResponse = (status, body, event) => ({
  statusCode: status,
  headers: corsHeaders(event),
  body: JSON.stringify(body)
});
