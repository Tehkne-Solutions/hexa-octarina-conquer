extends Node2D

const PROTOCOL_VERSION := "1.0"
const SESSION_PATH := "user://hexa_session.cfg"
const PLAYER_COLORS := [
	Color("4cc9f0"),
	Color("f72585"),
	Color("f9c74f"),
	Color("90be6d")
]

@export var server_url := "ws://127.0.0.1:8080/ws"
@export var room_to_join := ""
@export var player_name := ""

var socket := WebSocketPeer.new()
var socket_open := false
var request_sequence := 0
var reconnect_delay := 0.0

var room_id := ""
var player_id := ""
var session_token := ""
var revision := 0
var room_state: Dictionary = {}
var status_text := "Conectando..."
var selected_point: Variant = null

func _ready() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--room="):
			room_to_join = argument.trim_prefix("--room=").to_upper()
		elif argument.begins_with("--name="):
			player_name = argument.trim_prefix("--name=")
	if player_name.is_empty():
		player_name = "Jogador-%04d" % randi_range(1, 9999)
	_load_session()
	_connect_socket()
	queue_redraw()

func _connect_socket() -> void:
	socket = WebSocketPeer.new()
	var error := socket.connect_to_url(server_url)
	if error != OK:
		status_text = "Falha ao conectar: %s" % error
		reconnect_delay = 2.0
	else:
		status_text = "Abrindo conexão WebSocket..."

func _process(delta: float) -> void:
	socket.poll()
	var ready_state := socket.get_ready_state()

	if ready_state == WebSocketPeer.STATE_OPEN:
		if not socket_open:
			socket_open = true
			status_text = "Conectado. Estabelecendo sessão..."
			_establish_session()
		while socket.get_available_packet_count() > 0:
			_handle_packet(socket.get_packet().get_string_from_utf8())
	elif ready_state == WebSocketPeer.STATE_CLOSED:
		if socket_open:
			socket_open = false
			status_text = "Conexão encerrada. Reconectando..."
			reconnect_delay = 2.0
		if reconnect_delay > 0.0:
			reconnect_delay -= delta
			if reconnect_delay <= 0.0:
				_connect_socket()

func _establish_session() -> void:
	if not room_id.is_empty() and not player_id.is_empty() and not session_token.is_empty():
		_send("room.reconnect", {
			"roomId": room_id,
			"playerId": player_id,
			"sessionToken": session_token,
			"lastRevision": revision
		})
	elif not room_to_join.is_empty():
		_send("room.join", {
			"roomId": room_to_join,
			"playerName": player_name
		})
	else:
		_send("room.create", {
			"playerName": player_name,
			"boardSize": 5
		})

func _send(message_type: String, payload: Dictionary) -> void:
	if socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return
	request_sequence += 1
	var message := {
		"protocolVersion": PROTOCOL_VERSION,
		"type": message_type,
		"requestId": "%s-%d" % [player_name, request_sequence],
		"payload": payload
	}
	socket.send_text(JSON.stringify(message))

func _handle_packet(raw: String) -> void:
	var message = JSON.parse_string(raw)
	if typeof(message) != TYPE_DICTIONARY:
		status_text = "Mensagem inválida recebida."
		return

	var message_type: String = message.get("type", "")
	var payload: Dictionary = message.get("payload", {})

	match message_type:
		"server.hello":
			status_text = "Servidor compatível com protocolo %s" % PROTOCOL_VERSION
		"session.established":
			room_id = payload.get("roomId", "")
			player_id = payload.get("playerId", "")
			session_token = payload.get("sessionToken", "")
			_apply_snapshot(payload.get("snapshot", {}))
			_save_session()
			status_text = "Sala %s criada/conectada." % room_id
		"session.reconnected":
			room_id = payload.get("roomId", room_id)
			player_id = payload.get("playerId", player_id)
			session_token = payload.get("sessionToken", session_token)
			if payload.get("mode", "snapshot") == "patches":
				for patch in payload.get("patches", []):
					_apply_patch(patch)
			else:
				_apply_snapshot(payload.get("snapshot", {}))
			_save_session()
			status_text = "Sessão restaurada na sala %s." % room_id
		"room.patch":
			_apply_patch(payload)
		"command.accepted":
			status_text = "Comando confirmado na revisão %d." % payload.get("revision", revision)
		"error":
			var code: String = payload.get("code", "UNKNOWN")
			status_text = "%s: %s" % [code, payload.get("message", "Erro do servidor")]
			if code in ["INVALID_SESSION", "ROOM_NOT_FOUND"]:
				_clear_session()
				_establish_session()
		"pong":
			pass

	queue_redraw()

func _apply_snapshot(snapshot: Dictionary) -> void:
	if snapshot.is_empty():
		return
	revision = snapshot.get("revision", revision)
	room_state = snapshot

func _apply_patch(patch: Dictionary) -> void:
	if patch.is_empty():
		return
	revision = patch.get("revision", revision)
	var state: Dictionary = patch.get("state", {})
	if not state.is_empty():
		room_state = {
			"roomId": room_id,
			"revision": revision,
			"status": state.get("status", "waiting"),
			"board": state.get("board", {}),
			"players": state.get("players", []),
			"duels": state.get("duels", [])
		}
	var event: Dictionary = patch.get("event", {})
	if not event.is_empty():
		status_text = "Evento: %s" % event.get("type", "atualização")

func _draw() -> void:
	var board: Dictionary = room_state.get("board", {})
	var board_size: int = board.get("boardSize", 5)
	var origin := Vector2(160, 105)
	var gap := minf(900.0 / maxf(1.0, board_size - 1), 500.0 / maxf(1.0, board_size - 1))

	for cell in board.get("cells", []):
		var cell_position := origin + Vector2(cell.get("x", 0), cell.get("y", 0)) * gap
		var owner_color := _player_color(cell.get("ownerId", ""))
		draw_rect(Rect2(cell_position + Vector2(5, 5), Vector2(gap - 10, gap - 10)), owner_color.darkened(0.55), true)

	for edge in board.get("edges", []):
		var start: Array = edge.get("start", [0, 0])
		var end: Array = edge.get("end", [0, 0])
		var from := origin + Vector2(start[0], start[1]) * gap
		var to := origin + Vector2(end[0], end[1]) * gap
		draw_line(from, to, _player_color(edge.get("ownerId", "")), 8.0, true)

	for y in range(board_size):
		for x in range(board_size):
			var point := origin + Vector2(x, y) * gap
			var radius := 10.0
			if selected_point != null and selected_point == Vector2i(x, y):
				radius = 16.0
			draw_circle(point, radius, Color("e8f1ff"))

	var font := ThemeDB.fallback_font
	draw_string(font, Vector2(36, 38), "Hexa Octarina Conquer", HORIZONTAL_ALIGNMENT_LEFT, -1, 28, Color("f8f9ff"))
	draw_string(font, Vector2(36, 70), "Sala: %s  |  Revisão: %d" % [room_id if not room_id.is_empty() else "—", revision], HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color("b7c5e5"))
	draw_string(font, Vector2(36, 690), status_text, HORIZONTAL_ALIGNMENT_LEFT, 1180, 17, Color("b7c5e5"))

	var current_player: String = board.get("currentPlayerId", "")
	var turn_label := "Seu turno" if current_player == player_id else "Turno do oponente"
	draw_string(font, Vector2(1010, 110), turn_label, HORIZONTAL_ALIGNMENT_LEFT, 220, 20, _player_color(current_player))
	draw_string(font, Vector2(1010, 142), "Ações: %d" % board.get("actionsRemaining", 0), HORIZONTAL_ALIGNMENT_LEFT, 220, 18, Color("d5ddf3"))
	draw_string(font, Vector2(1010, 174), "Clique em dois pontos adjacentes." , HORIZONTAL_ALIGNMENT_LEFT, 230, 15, Color("8fa3c9"))

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed):
		return
	var point := _nearest_board_point(event.position)
	if point == null:
		selected_point = null
		queue_redraw()
		return
	if selected_point == null:
		selected_point = point
		status_text = "Selecione um ponto adjacente."
	elif abs(selected_point.x - point.x) + abs(selected_point.y - point.y) == 1:
		_send("action.play_edge", {
			"roomId": room_id,
			"playerId": player_id,
			"sessionToken": session_token,
			"expectedRevision": revision,
			"start": [selected_point.x, selected_point.y],
			"end": [point.x, point.y]
		})
		selected_point = null
	else:
		selected_point = point
		status_text = "Os pontos precisam ser ortogonalmente adjacentes."
	queue_redraw()

func _nearest_board_point(mouse_position: Vector2) -> Variant:
	var board: Dictionary = room_state.get("board", {})
	var board_size: int = board.get("boardSize", 5)
	var origin := Vector2(160, 105)
	var gap := minf(900.0 / maxf(1.0, board_size - 1), 500.0 / maxf(1.0, board_size - 1))
	var nearest: Variant = null
	var nearest_distance := 30.0
	for y in range(board_size):
		for x in range(board_size):
			var distance := mouse_position.distance_to(origin + Vector2(x, y) * gap)
			if distance < nearest_distance:
				nearest_distance = distance
				nearest = Vector2i(x, y)
	return nearest

func _player_color(target_player_id: String) -> Color:
	var players: Array = room_state.get("players", [])
	for index in range(players.size()):
		if players[index].get("id", "") == target_player_id:
			return PLAYER_COLORS[index % PLAYER_COLORS.size()]
	return Color("75829c")

func _save_session() -> void:
	var config := ConfigFile.new()
	config.set_value("session", "room_id", room_id)
	config.set_value("session", "player_id", player_id)
	config.set_value("session", "session_token", session_token)
	config.set_value("session", "revision", revision)
	config.save(SESSION_PATH)

func _load_session() -> void:
	var config := ConfigFile.new()
	if config.load(SESSION_PATH) != OK:
		return
	room_id = config.get_value("session", "room_id", "")
	player_id = config.get_value("session", "player_id", "")
	session_token = config.get_value("session", "session_token", "")
	revision = config.get_value("session", "revision", 0)

func _clear_session() -> void:
	room_id = ""
	player_id = ""
	session_token = ""
	revision = 0
	room_state = {}
	var config := ConfigFile.new()
	config.save(SESSION_PATH)
