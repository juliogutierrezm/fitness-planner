import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.WORKOUT_PLANS_TABLE || 'WorkoutPlans';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' };
export const handler = async (event) => {
  try {
    const planId = event?.pathParameters?.planId;
    if (!planId) return { statusCode: 400, headers: cors, body: JSON.stringify({ message: 'planId requerido' }) };
    const res = await client.send(new GetCommand({ TableName: TABLE, Key: { planId } }));
    if (!res.Item) return { statusCode: 404, headers: cors, body: JSON.stringify({ message: 'Plan no encontrado' }) };
    return { statusCode: 200, headers: cors, body: JSON.stringify(res.Item) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Error obteniendo plan' }) };
  }
};
