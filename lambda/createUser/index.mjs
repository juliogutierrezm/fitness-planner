// index.mjs  (compatible con Node.js 22)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

// Inicializamos cliente DynamoDB
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

// Nombre de la tabla desde variable de entorno
const TABLE = process.env.TABLE_NAME || "Users";

export const handler = async (event) => {
  try {
    console.log("Evento recibido:", JSON.stringify(event));

    // Parsear body
    const body = JSON.parse(event.body || "{}");
    if (!body.email) {
      throw new Error("El campo 'email' es obligatorio");
    }

    const now = new Date().toISOString();
    const id = body.id || `usr-${Date.now()}`;

    // Item que se guardará en DynamoDB
    const item = {
      PK: `USER#${id}`,
      SK: `USER#${id}`,
      id,
      email: body.email,
      givenName: body.givenName || "",
      familyName: body.familyName || "",
      role: body.role || "client",
      companyId: body.companyId || null,
      trainerId: body.trainerId || null,
      createdAt: now
    };

    // Insertar en DynamoDB
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: item
    }));

    return ok(item);
  } catch (e) {
    console.error("Error en Lambda:", e);
    return err(e);
  }
};

// Helpers para respuestas HTTP
const ok = (data) => ({
  statusCode: 200,
  headers: cors(),
  body: JSON.stringify(data)
});

const err = (e) => ({
  statusCode: 500,
  headers: cors(),
  body: JSON.stringify({ error: e.message || "error" })
});

const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
});
