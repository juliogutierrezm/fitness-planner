import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.WORKOUT_PLANS_TABLE || 'WorkoutPlans';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' };
export const handler = async (event) => {
  try {
    const planId = event?.pathParameters?.planId;
    if (!planId) return { statusCode: 400, headers: cors, body: JSON.stringify({ message: 'planId requerido' }) };
    const res = await client.send(new ScanCommand({ TableName: TABLE, FilterExpression: '#sk = :sk', ExpressionAttributeNames: { '#sk': 'SK' }, ExpressionAttributeValues: { ':sk': `PLAN#${planId}` } }));
    const item = res.Items?.[0];
    if (!item) return { statusCode: 404, headers: cors, body: JSON.stringify({ message: 'Plan no encontrado' }) };
    return { statusCode: 200, headers: cors, body: JSON.stringify(item) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Error obteniendo plan', error: (e && (e.message || e.code)) }) };
  }
};
