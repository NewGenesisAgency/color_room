import Database from 'better-sqlite3';
const db = new Database('data/ColorRoomDB.db');
const row = db.prepare("SELECT id, config_json FROM crg_games WHERE name = 'ChromaDetect – Load Test'").get();
const c = JSON.parse(row.config_json);
c.description = 'Mesure avec le CS-160\nRetrouve la couleur\nsur le diagramme CIE';
db.prepare('UPDATE crg_games SET config_json = ?, updated_at = datetime(\'now\') WHERE id = ?').run(JSON.stringify(c), row.id);
console.log('OK –', row.id);
db.close();
