// index.mjs - getUserById con Node.js 22 y AWS SDK v3

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.TABLE_NAME || "Users";

const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
});

export const handler = async (event) => {
  try {
    console.log("Evento recibido:", JSON.stringify(event));

    const userId = event?.pathParameters?.userId || event?.pathParameters?.id;
    if (!userId) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ message: "userId requerido" })
      };
    }

    const Key = { PK: `USER#${userId}`, SK: `USER#${userId}` };

    const res = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key
      })
    );

    if (!res.Item) {
      return {
        statusCode: 404,
        headers: cors(),
        body: JSON.stringify({ message: "Usuario no encontrado" })
      };
    }

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify(res.Item)
    };
  } catch (e) {
    console.error("Error en getUserById:", e);
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ message: "Error obteniendo usuario" })
    };
  }
};
