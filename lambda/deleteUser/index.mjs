// index.mjs - deleteUser con Node.js 22 y AWS SDK v3

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.TABLE_NAME || "Users";

export const handler = async (event) => {
  try {
    const id = event?.pathParameters?.id || event?.pathParameters?.userId;
    if (!id) {
      return { statusCode: 400, headers: cors(), body: "id required" };
    }

    await ddb.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `USER#${id}`, SK: `USER#${id}` }
      })
    );

    return ok({ deleted: id });
  } catch (e) {
    console.error("Error en deleteUser:", e);
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
