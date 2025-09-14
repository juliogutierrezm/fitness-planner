import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.WORKOUT_PLANS_TABLE || 'WorkoutPlans';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' };
export const handler = async (event) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
    if (!body || !body.planId) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ message: 'planId requerido' }) };
    }
    const { planId, ...attrs } = body;
    const exprNames = Object.fromEntries(Object.keys(attrs).map(k => ['#'+k, k]));
    const exprValues = Object.fromEntries(Object.keys(attrs).map(k => [':'+k, attrs[k]]));
    const updateExpr = 'SET ' + Object.keys(attrs).map(k => `#${k} = :${k}`).join(', ');
    await client.send(new UpdateCommand({ TableName: TABLE, Key: { planId }, UpdateExpression: updateExpr, ExpressionAttributeNames: exprNames, ExpressionAttributeValues: exprValues }));
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Error actualizando plan' }) };
  }
};
