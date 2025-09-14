import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.WORKOUT_PLANS_TABLE || 'WorkoutPlans';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' };

async function ensureUserId(planId, userId) {
  if (userId) return userId;
  const sk = `PLAN#${planId}`;
  const res = await client.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: '#sk = :sk',
    ExpressionAttributeNames: { '#sk': 'SK' },
    ExpressionAttributeValues: { ':sk': sk }
  }));
  const item = res.Items?.[0];
  if (!item) return null;
  const pk = item.PK || '';
  return pk.startsWith('USER#') ? pk.substring(5) : pk;
}

export const handler = async (event) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
    let { planId, userId, sessions, ...attrs } = body || {};
    if (!planId) {
      console.error('Missing planId');
      return { statusCode: 400, headers: cors, body: JSON.stringify({ message: 'planId requerido' }) };
    }

    // Fallback: derive userId from existing item by SK
    userId = await ensureUserId(planId, userId);
    if (!userId) {
      console.error('Missing userId and unable to derive from SK');
      return { statusCode: 400, headers: cors, body: JSON.stringify({ message: 'userId requerido o plan inexistente' }) };
    }

    // Normalize sessions to a JSON string to match current table shape
    if (Array.isArray(sessions)) {
      attrs.sessions = JSON.stringify(sessions);
    } else if (typeof sessions === 'string') {
      attrs.sessions = sessions;
    }

    const Key = { PK: `USER#${userId}`, SK: `PLAN#${planId}` };

    // Build UpdateExpression
    const names = {}; const values = {}; const sets = [];
    const now = new Date().toISOString();
    names['#createdAt'] = 'createdAt'; values[':ts'] = now; sets.push('#createdAt = if_not_exists(createdAt, :ts)');
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v === undefined) continue;
      names['#'+k] = k; values[':'+k] = v; sets.push(`#${k} = :${k}`);
    }
    // Ensure we set at least updatedAt
    names['#updatedAt'] = 'updatedAt'; values[':upd'] = now; sets.push('#updatedAt = :upd');

    const UpdateExpression = 'SET ' + sets.join(', ');

    await client.send(new UpdateCommand({
      TableName: TABLE,
      Key,
      UpdateExpression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values
    }));

    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error('updateWorkoutPlan error', e);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Error actualizando plan', error: (e && (e.message || e.code)) }) };
  }
};
