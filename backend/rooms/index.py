"""API для управления комнатами мультиплеера: создание, вход, обновление позиции, опрос состояния."""
import json
import os
import random
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Player-Id",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def gen_code():
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choices(chars, k=6))


def esc(val: str) -> str:
    return "'" + str(val).replace("'", "''") + "'"


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    body = {}
    if event.get("body"):
        body = json.loads(event["body"])

    # Поддержка action через тело запроса (когда путь не пробрасывается прокси)
    action = body.get("action", "")

    player_id = (event.get("headers", {}).get("X-Player-Id") or body.get("player_id", "anonymous"))[:64]

    # POST / — создать или присоединиться к комнате (action в теле)
    if method == "POST" and action == "join":
        code = str(body.get("code", "")).upper()[:6]
        char = body.get("character", {})
        char_id = str(char.get("id", "?"))[:32]
        char_name = str(char.get("name", "?"))[:32]
        char_color = str(char.get("color", "#fff"))[:16]
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT code FROM rooms WHERE code = {esc(code)}")
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Комната не найдена"})}
        cur.execute(
            f"INSERT INTO room_players (room_code, player_id, char_id, char_name, char_color, px, py) "
            f"VALUES ({esc(code)}, {esc(player_id)}, {esc(char_id)}, {esc(char_name)}, {esc(char_color)}, 80, 110) "
            f"ON CONFLICT (room_code, player_id) DO UPDATE SET updated_at = NOW(), char_name = {esc(char_name)}, char_color = {esc(char_color)}"
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "code": code})}

    if method == "PUT" and action == "state":
        code = str(body.get("code", ""))[:6]
        px = float(body.get("px", 80))
        py = float(body.get("py", 110))
        dead = 'TRUE' if body.get("dead") else 'FALSE'
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"UPDATE room_players SET px = {px}, py = {py}, dead = {dead}, updated_at = NOW() "
            f"WHERE room_code = {esc(code)} AND player_id = {esc(player_id)}"
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    if action == "poll":
        code = str(body.get("code", "")).upper()[:6]
        if not code or len(code) != 6:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "bad code"})}
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"SELECT player_id, char_id, char_name, char_color, px, py, dead "
            f"FROM room_players WHERE room_code = {esc(code)}"
        )
        rows = cur.fetchall()
        conn.commit()
        cur.close()
        conn.close()
        players = [
            {"player_id": r[0], "char_id": r[1], "char_name": r[2], "char_color": r[3],
             "px": float(r[4]), "py": float(r[5]), "dead": bool(r[6])}
            for r in rows
        ]
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"players": players})}

    # POST /rooms — создать комнату
    if method == "POST" and (path.endswith("/rooms") or path == "/" or path == ""):
        code = gen_code()
        char = body.get("character", {})
        char_id = str(char.get("id", "?"))[:32]
        char_name = str(char.get("name", "?"))[:32]
        char_color = str(char.get("color", "#fff"))[:16]
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"INSERT INTO rooms (code) VALUES ({esc(code)})")
        cur.execute(
            f"INSERT INTO room_players (room_code, player_id, char_id, char_name, char_color, px, py) "
            f"VALUES ({esc(code)}, {esc(player_id)}, {esc(char_id)}, {esc(char_name)}, {esc(char_color)}, 80, 110)"
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"code": code})}

    # POST /rooms/join — войти в комнату
    if method == "POST" and "join" in path:
        code = str(body.get("code", "")).upper()[:6]
        char = body.get("character", {})
        char_id = str(char.get("id", "?"))[:32]
        char_name = str(char.get("name", "?"))[:32]
        char_color = str(char.get("color", "#fff"))[:16]
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT code FROM rooms WHERE code = {esc(code)}")
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Комната не найдена"})}
        cur.execute(
            f"INSERT INTO room_players (room_code, player_id, char_id, char_name, char_color, px, py) "
            f"VALUES ({esc(code)}, {esc(player_id)}, {esc(char_id)}, {esc(char_name)}, {esc(char_color)}, 80, 110) "
            f"ON CONFLICT (room_code, player_id) DO UPDATE SET updated_at = NOW(), char_name = {esc(char_name)}, char_color = {esc(char_color)}"
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "code": code})}

    # PUT /rooms/state — обновить позицию игрока
    if method == "PUT" and "state" in path:
        code = str(body.get("code", ""))[:6]
        px = float(body.get("px", 80))
        py = float(body.get("py", 110))
        dead = 'TRUE' if body.get("dead") else 'FALSE'
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"UPDATE room_players SET px = {px}, py = {py}, dead = {dead}, updated_at = NOW() "
            f"WHERE room_code = {esc(code)} AND player_id = {esc(player_id)}"
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    # GET /rooms/{code} — получить всех игроков комнаты
    if method == "GET":
        parts = path.strip("/").split("/")
        code = parts[-1].upper() if parts else ""
        if not code or len(code) != 6:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "bad code"})}
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"UPDATE room_players SET dead = TRUE "
            f"WHERE room_code = {esc(code)} AND updated_at < NOW() - INTERVAL '10 seconds'"
        )
        cur.execute(
            f"SELECT player_id, char_id, char_name, char_color, px, py, dead "
            f"FROM room_players WHERE room_code = {esc(code)}"
        )
        rows = cur.fetchall()
        conn.commit()
        cur.close()
        conn.close()
        players = [
            {"player_id": r[0], "char_id": r[1], "char_name": r[2], "char_color": r[3],
             "px": float(r[4]), "py": float(r[5]), "dead": bool(r[6])}
            for r in rows
        ]
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"players": players})}

    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "not found"})}