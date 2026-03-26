"""API для управления комнатами мультиплеера: создание, вход, обновление позиции, опрос состояния."""
import json
import os
import random
import string
import time
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


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    body = {}
    if event.get("body"):
        body = json.loads(event["body"])

    player_id = event.get("headers", {}).get("X-Player-Id") or body.get("player_id", "")

    # POST /rooms — создать комнату
    if method == "POST" and path.endswith("/rooms"):
        code = gen_code()
        char = body.get("character", {})
        conn = get_conn()
        cur = conn.cursor()
        # Expire rooms older than 2h
        cur.execute("INSERT INTO rooms (code) VALUES (%s)", (code,))
        cur.execute(
            "INSERT INTO room_players (room_code, player_id, char_id, char_name, char_color, px, py) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (code, player_id, char.get("id","?"), char.get("name","?"), char.get("color","#fff"), 80, 110)
        )
        conn.commit(); cur.close(); conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"code": code})}

    # POST /rooms/join — войти в комнату
    if method == "POST" and "/join" in path:
        code = body.get("code", "").upper()
        char = body.get("character", {})
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT code FROM rooms WHERE code=%s", (code,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Комната не найдена"})}
        cur.execute(
            """INSERT INTO room_players (room_code, player_id, char_id, char_name, char_color, px, py)
               VALUES (%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (room_code, player_id) DO UPDATE SET updated_at=NOW()""",
            (code, player_id, char.get("id","?"), char.get("name","?"), char.get("color","#fff"), 80, 110)
        )
        conn.commit(); cur.close(); conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "code": code})}

    # PUT /rooms/state — обновить позицию игрока
    if method == "PUT" and "/state" in path:
        code = body.get("code", "")
        px = float(body.get("px", 80))
        py = float(body.get("py", 110))
        dead = bool(body.get("dead", False))
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "UPDATE room_players SET px=%s, py=%s, dead=%s, updated_at=NOW() WHERE room_code=%s AND player_id=%s",
            (px, py, dead, code, player_id)
        )
        conn.commit(); cur.close(); conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    # GET /rooms/{code} — получить всех игроков комнаты
    if method == "GET" and len(path.split("/")) >= 2:
        parts = path.strip("/").split("/")
        code = parts[-1].upper() if parts else ""
        if not code or len(code) != 6:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "bad code"})}
        conn = get_conn()
        cur = conn.cursor()
        # Remove stale players (inactive >10s)
        cur.execute(
            "UPDATE room_players SET dead=TRUE WHERE room_code=%s AND updated_at < NOW() - INTERVAL '10 seconds'",
            (code,)
        )
        cur.execute(
            "SELECT player_id, char_id, char_name, char_color, px, py, dead FROM room_players WHERE room_code=%s",
            (code,)
        )
        rows = cur.fetchall()
        conn.commit(); cur.close(); conn.close()
        players = [
            {"player_id": r[0], "char_id": r[1], "char_name": r[2], "char_color": r[3],
             "px": r[4], "py": r[5], "dead": r[6]}
            for r in rows
        ]
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"players": players})}

    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "not found"})}
