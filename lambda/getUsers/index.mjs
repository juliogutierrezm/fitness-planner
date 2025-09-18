// index.mjs - getUsers en Node.js 22 con AWS SDK v3

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.TABLE_NAME || "Users";

export const handler = async (event) => {
  try {
    console.log("Evento recibido:", JSON.stringify(event));

    const qs = event.queryStringParameters || {};
    const trainerId = qs.trainerId;
    const companyId = qs.companyId;

    if (trainerId) {
      const resp = await ddb.send(
        new QueryCommand({
          TableName: TABLE,
          IndexName: "GSI1",
          KeyConditionExpression: "trainerId = :t",
          ExpressionAttributeValues: { ":t": trainerId }
        })
      );
      return ok(resp.Items || []);
    }

    if (companyId) {
      const resp = await ddb.send(
        new QueryCommand({
          TableName: TABLE,
          IndexName: "GSI2",
          KeyConditionExpression: "companyId = :c",
          ExpressionAttributeValues: { ":c": companyId }
        })
      );
      return ok(resp.Items || []);
    }

    return ok([]);
  } catch (e) {
    console.error("Error en getUsers:", e);
    return err(e);
  }
};

// Helpers
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
