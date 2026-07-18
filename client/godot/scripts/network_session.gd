extends Node

signal state_changed(state: Dictionary)
signal private_state_changed(state: Dictionary)
signal event_received(event: Dictionary)
signal status_changed(text: String)
signal lobby_changed(rooms: Array)
signal account_changed(profile: Dictionary)
signal leaderboard_changed(entries: Array)
signal history_changed(matches: Array)

const PROTOCOL_VERSION := "1.0"
const SESSION_PATH := "user://hexa_session.cfg"

@export var server_url := "ws://127.0.0.1:8080/ws"
@export var default_board_size := 5

var socket := WebSocketPeer.new()
var socket_open := false
var hello_received := false
var request_sequence := 0
var reconnect_delay := 0.0

var room_id := ""
var player_id := ""
var session_token := ""
var revision := 0
var room_state: Dictionary = {}
var private_state: Dictionary = {}
var room_to_join := ""
var player_name := ""
var force_create := false

var account_id := ""
var account_token := ""
var account_profile: Dictionary = {}
var matchmaking_started := false

func _ready() -> void:
	set_process(false)

func start() -> void:
	_parse_arguments()
	if player_name.is_empty():
		player_name = "Jogador-%04d" % randi_range(1, 9999)
	_load_session()
	set_process(true)
	_connect_socket()

func _parse_arguments() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--room="):
			room_to_join = argument.trim_prefix("--room=").to_upper()
		elif argument.begins_with("--name="):
			player_name = argument.trim_prefix("--name=")
		elif argument.begins_with("--server="):
			server_url = argument.trim_prefix("--server=")
		elif argument == "--create":
			force_create = true

func _connect_socket() -> void:
	socket = WebSocketPeer.new()
	hello_received = false
	var error := socket.connect_to_url(server_url)
	if error != OK:
		_set_status("Falha ao conectar: %s" % error)
		reconnect_delay = 2.0
	else:
		_set_status("Abrindo conexão WebSocket...")

func _process(delta: float) -> void:
	socket.poll()
	var ready_state := socket.get_ready_state()
	if ready_state == WebSocketPeer.STATE_OPEN:
		if not socket_open:
			socket_open = true
			_set_status("Conectado. Negociando protocolo...")
		while socket.get_available_packet_count() > 0:
			_handle_packet(socket.get_packet().get_string_from_utf8())
	elif ready_state == WebSocketPeer.STATE_CLOSED:
		if socket_open:
			socket_open = false
			_set_status("Conexão encerrada. Reconectando...")
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
	elif has_account():
		request_profile()
	else:
		_set_status("Entre em uma conta ou continue como visitante.")

func begin_matchmaking() -> void:
	if matchmaking_started or not room_id.is_empty():
		return
	matchmaking_started = true
	if not room_to_join.is_empty():
		_join_room(room_to_join)
	elif force_create:
		_create_room()
	else:
		_send("lobby.list", {"status": "waiting"})

func play_as_guest() -> void:
	if player_name.is_empty():
		player_name = "Jogador-%04d" % randi_range(1, 9999)
	begin_matchmaking()

func register_account(handle: String, display_name: String, password: String) -> void:
	_send("account.register", {
		"handle": handle,
		"displayName": display_name,
		"password": password
	})

func login_account(handle: String, password: String) -> void:
	_send("account.login", {"handle": handle, "password": password})

func logout_account() -> void:
	account_id = ""
	account_token = ""
	account_profile = {}
	account_changed.emit(account_profile)
	_save_session()

func has_account() -> bool:
	return not account_id.is_empty() and not account_token.is_empty()

func request_profile() -> void:
	if not has_account():
		return
	_send("account.profile", {"accountId": account_id, "accessToken": account_token})

func request_history(limit := 25) -> void:
	if not has_account():
		return
	_send("account.history", {
		"accountId": account_id,
		"accessToken": account_token,
		"limit": limit
	})

func request_leaderboard(limit := 25) -> void:
	_send("leaderboard.list", {"limit": limit})

func _room_identity_payload() -> Dictionary:
	if has_account():
		return {"accountId": account_id, "accessToken": account_token}
	return {"playerName": player_name}

func _create_room() -> void:
	var payload := _room_identity_payload()
	payload["boardSize"] = default_board_size
	_send("room.create", payload)

func _join_room(target_room_id: String) -> void:
	var payload := _room_identity_payload()
	payload["roomId"] = target_room_id
	_send("room.join", payload)

func play_edge(start: Vector2i, end: Vector2i) -> void:
	if not _has_session():
		return
	_send("action.play_edge", _action_payload({
		"start": [start.x, start.y],
		"end": [end.x, end.y]
	}))

func play_card(card_id: String, province_id := "", start: Variant = null, end: Variant = null) -> void:
	if not _has_session():
		return
	var extra := {"cardId": card_id}
	if not province_id.is_empty():
		extra["provinceId"] = province_id
	if start is Vector2i and end is Vector2i:
		extra["start"] = [start.x, start.y]
		extra["end"] = [end.x, end.y]
	_send("action.play_card", _action_payload(extra))

func submit_duel_round(duel_id: String, card_ids: Array) -> void:
	if not _has_session():
		return
	_send("action.resolve_duel_round", _action_payload({"duelId": duel_id, "cardIds": card_ids}))

func forfeit_match() -> void:
	if not _has_session():
		return
	_send("match.forfeit", _action_payload({}))

func list_lobby() -> void:
	_send("lobby.list", {})

func _has_session() -> bool:
	if room_id.is_empty() or player_id.is_empty() or session_token.is_empty():
		_set_status("Sessão ainda não estabelecida.")
		return false
	return true

func _action_payload(extra: Dictionary) -> Dictionary:
	var payload := {
		"roomId": room_id,
		"playerId": player_id,
		"sessionToken": session_token,
		"expectedRevision": revision
	}
	payload.merge(extra, true)
	return payload

func _send(message_type: String, payload: Dictionary) -> void:
	if socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return
	request_sequence += 1
	var request_name := account_profile.get("handle", player_name)
	var message := {
		"protocolVersion": PROTOCOL_VERSION,
		"type": message_type,
		"requestId": "%s-%d" % [request_name, request_sequence],
		"payload": payload
	}
	socket.send_text(JSON.stringify(message))

func _handle_packet(raw: String) -> void:
	var message = JSON.parse_string(raw)
	if typeof(message) != TYPE_DICTIONARY:
		_set_status("Mensagem inválida recebida.")
		return
	var message_type: String = message.get("type", "")
	var payload: Dictionary = message.get("payload", {})

	match message_type:
		"server.hello":
			hello_received = true
			_set_status("Servidor compatível com protocolo %s" % PROTOCOL_VERSION)
			_establish_session()
		"account.session":
			account_id = payload.get("account", {}).get("id", "")
			account_token = payload.get("accessToken", "")
			_apply_account(payload.get("account", {}))
			_save_session()
			begin_matchmaking()
		"account.profile":
			_apply_account(payload)
			_save_session()
			begin_matchmaking()
		"account.history":
			history_changed.emit(payload.get("matches", []))
		"leaderboard.data":
			leaderboard_changed.emit(payload.get("leaderboard", []))
		"match.progression":
			var local_profile: Dictionary = payload.get("winner", {})
			if local_profile.get("id", "") != account_id:
				local_profile = payload.get("loser", {})
			if local_profile.get("id", "") == account_id:
				_apply_account(local_profile)
			request_history()
		"lobby.rooms":
			var rooms: Array = payload.get("rooms", [])
			lobby_changed.emit(rooms)
			if room_id.is_empty() and room_to_join.is_empty():
				if rooms.is_empty():
					_create_room()
				else:
					room_to_join = rooms[0].get("roomId", "")
					_join_room(room_to_join)
		"lobby.updated":
			lobby_changed.emit(payload.get("rooms", []))
		"session.established":
			room_id = payload.get("roomId", "")
			player_id = payload.get("playerId", "")
			session_token = payload.get("sessionToken", "")
			_apply_snapshot(payload.get("snapshot", {}))
			_apply_private_state(payload.get("privateState", {}))
			_save_session()
			_set_status("Sala %s conectada." % room_id)
		"session.reconnected":
			room_id = payload.get("roomId", room_id)
			player_id = payload.get("playerId", player_id)
			session_token = payload.get("sessionToken", session_token)
			if payload.get("mode", "snapshot") == "patches":
				for patch in payload.get("patches", []):
					_apply_patch(patch)
			else:
				_apply_snapshot(payload.get("snapshot", {}))
			_apply_private_state(payload.get("privateState", {}))
			_save_session()
			_set_status("Sessão restaurada na sala %s." % room_id)
		"room.patch":
			_apply_patch(payload)
		"player.private_state":
			_apply_private_state(payload)
		"command.accepted":
			_set_status("Comando confirmado na revisão %d." % payload.get("revision", revision))
		"error":
			var code: String = payload.get("code", "UNKNOWN")
			_set_status("%s: %s" % [code, payload.get("message", "Erro do servidor")])
			if code in ["INVALID_SESSION", "ROOM_NOT_FOUND"]:
				_clear_room_session()
				matchmaking_started = false
				begin_matchmaking()
			elif code == "INVALID_ACCOUNT_SESSION":
				logout_account()
		"pong":
			pass

func _apply_account(profile: Dictionary) -> void:
	account_profile = profile
	if not profile.is_empty():
		player_name = profile.get("displayName", player_name)
	account_changed.emit(account_profile)

func _apply_snapshot(snapshot: Dictionary) -> void:
	if snapshot.is_empty():
		return
	revision = snapshot.get("revision", revision)
	room_state = snapshot
	state_changed.emit(room_state)

func _apply_private_state(state: Dictionary) -> void:
	if state.is_empty():
		return
	private_state = state
	private_state_changed.emit(private_state)

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
			"duels": state.get("duels", []),
			"matchResult": state.get("matchResult", null)
		}
	var event: Dictionary = patch.get("event", {})
	if not event.is_empty():
		_set_status("Evento: %s" % event.get("type", "atualização"))
		event_received.emit(event)
	_save_session()
	state_changed.emit(room_state)

func active_local_duel() -> Dictionary:
	for duel in room_state.get("duels", []):
		if duel.get("status", "") == "resolved":
			continue
		if player_id in [duel.get("attackerId", ""), duel.get("defenderId", "")]:
			return duel
	return {}

func is_local_turn() -> bool:
	var board: Dictionary = room_state.get("board", {})
	return room_state.get("status", "") == "active" and board.get("currentPlayerId", "") == player_id

func _set_status(text: String) -> void:
	status_changed.emit(text)

func _save_session() -> void:
	var config := ConfigFile.new()
	config.set_value("room", "room_id", room_id)
	config.set_value("room", "player_id", player_id)
	config.set_value("room", "session_token", session_token)
	config.set_value("room", "revision", revision)
	config.set_value("account", "account_id", account_id)
	config.set_value("account", "access_token", account_token)
	config.save(SESSION_PATH)

func _load_session() -> void:
	var config := ConfigFile.new()
	if config.load(SESSION_PATH) != OK:
		return
	room_id = config.get_value("room", "room_id", config.get_value("session", "room_id", ""))
	player_id = config.get_value("room", "player_id", config.get_value("session", "player_id", ""))
	session_token = config.get_value("room", "session_token", config.get_value("session", "session_token", ""))
	revision = config.get_value("room", "revision", config.get_value("session", "revision", 0))
	account_id = config.get_value("account", "account_id", "")
	account_token = config.get_value("account", "access_token", "")

func _clear_room_session() -> void:
	room_id = ""
	player_id = ""
	session_token = ""
	revision = 0
	room_state = {}
	private_state = {}
	_save_session()
