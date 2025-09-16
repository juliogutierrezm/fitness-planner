import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.WORKOUT_PLANS_TABLE || "WorkoutPlans";

const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
});

export const handler = async (event) => {
  try {
    const userId = event?.pathParameters?.userId || event?.queryStringParameters?.userId;
    if (!userId) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ message: "userId requerido" }) };
    }

    // Query directo por PK
    const resp = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": `USER#${userId}` }
      })
    );

    let items = resp.Items || [];

    // Ordenar por fecha descendente si existe
    items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return { statusCode: 200, headers: cors(), body: JSON.stringify(items) };
  } catch (e) {
    console.error("Error en getWorkoutPlans:", e);
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ message: "Error obteniendo planes del usuario" }) };
  }
};
