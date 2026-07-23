import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
let clientPromise;

function getClientPromise() {
  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect().then(() => client);
  }
  return clientPromise;
}

const DEFAULTS = [
  { name: 'Lola',   emoji: '⚡' },
  { name: 'Nate',   emoji: '🔥' },
  { name: 'Carly',  emoji: '🌸' },
  { name: 'Alex',   emoji: '💫' },
  { name: 'Jake',   emoji: '🎮' },
  { name: 'Stylar', emoji: '🌟' },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let client;
  try {
    client = await getClientPromise();
  } catch (err) {
    clientPromise = null;
    return res.status(500).json({ error: 'DB connection failed: ' + err.message });
  }

  try {
    const col = client.db('sprite-tracker').collection('players');

    if (req.method === 'GET') {
      let players = await col.find({}).sort({ order: 1, _id: 1 }).toArray();
      if (players.length === 0) {
        const seeded = DEFAULTS.map((p, i) => ({ ...p, order: i }));
        await col.insertMany(seeded);
        players = seeded;
      }
      return res.status(200).json(players.map(p => ({ name: p.name, emoji: p.emoji })));
    }

    if (req.method === 'POST') {
      const { name, emoji } = req.body;
      if (!name) return res.status(400).json({ error: 'Missing name' });
      const count = await col.countDocuments();
      await col.updateOne(
        { name },
        { $set: { name, emoji: emoji || '👤' }, $setOnInsert: { order: count, createdAt: new Date() } },
        { upsert: true }
      );
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    clientPromise = null;
    res.status(500).json({ error: err.message });
  }
}
