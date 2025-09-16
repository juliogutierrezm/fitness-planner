// index.mjs - updateUser para Node.js 22

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.TABLE_NAME || "Users";

export const handler = async (event) => {
  try {
    console.log("Evento recibido:", JSON.stringify(event));

    const body = JSON.parse(event.body || "{}");
    const id = event?.pathParameters?.userId || body.id;

    if (!id) {
      return { statusCode: 400, headers: cors(), body: "id required" };
    }

    // Construimos expresiones dinámicas
    const expr = [];
    const names = {};
    const values = {};

    const set = (k, v) => {
      const nk = `#${k}`;
      const vk = `:${k}`;
      names[nk] = k;
      values[vk] = v;
      expr.push(`${nk} = ${vk}`);
    };

    ["email", "givenName", "familyName", "role", "companyId", "trainerId"].forEach((k) => {
      if (body[k] !== undefined) set(k, body[k]);
    });

    if (expr.length === 0) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: "No fields to update" }),
      };
    }

    const resp = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `USER#${id}`, SK: `USER#${id}` },
        UpdateExpression: `SET ${expr.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      })
    );

    return ok(resp.Attributes || {});
  } catch (e) {
    console.error("Error en updateUser:", e);
    return err(e);
  }
};

// Helpers
const ok = (data) => ({
  statusCode: 200,
  headers: cors(),
  body: JSON.stringify(data),
});

const err = (e) => ({
  statusCode: 500,
  headers: cors(),
  body: JSON.stringify({ error: e.message || "error" }),
});

const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
});
