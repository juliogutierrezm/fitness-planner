import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.WORKOUT_PLANS_TABLE || 'WorkoutPlans';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' };
export const handler = async (event) => {
  try {
    const planId = event?.pathParameters?.planId;
    if (!planId) return { statusCode: 400, headers: cors, body: JSON.stringify({ message: 'planId requerido' }) };
    await client.send(new DeleteCommand({ TableName: TABLE, Key: { planId } }));
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Error eliminando plan' }) };
  }
};
