extends Node

signal state_changed(state: Dictionary)
signal private_state_changed(state: Dictionary)
signal event_received(event: Dictionary)
signal status_changed(text: String)
signal lobby_changed(rooms: Array)
signal account_changed(profile: Dictionary)
signal leaderboard_changed(entries: Array)
signal history_changed(matches: Array)
signal season_changed(data: Dictionary)
signal season_leaderboard_changed(entries: Array)
signal matchmaking_changed(state: Dictionary)
signal recovery_changed(data: Dictionary)
signal telemetry_accepted(data: Dictionary)
signal presence_changed(players: Array)
signal penalty_changed(data: Dictionary)

const PROTOCOL_VERSION := "1.0"
const CLIENT_VERSION := "0.10.0"
const SESSION_PATH := "user://hexa_session.cfg"

@export var server_url := "ws://127.0.0.1:8080/ws"
@export var default_board_size := 5
@export var matchmaking_region := "global"

var socket := WebSocketPeer.new()
var socket_open := false
var hello_received := false
var request_sequence := 0
var reconnect_delay := 0.0
var server_instance_id := ""

var room_id := ""
var player_id := ""
var session_token := ""
var revision := 0
var room_state: Dictionary = {}
var private_state: Dictionary = {}
var presence_state: Array = []
var room_to_join := ""
var player_name := ""
var force_create := false

var account_id := ""
var account_token := ""
var account_profile: Dictionary = {}
var matchmaking_started := false
var matchmaking_state: Dictionary = {"state": "idle"}
var pending_match_id := ""
var matchmaking_poll_delay := 0.0
var telemetry_session_id := ""

func _ready() -> void:
	telemetry_session_id = "%s-%d-%d" % [OS.get_name(), Time.get_unix_time_from_system(), randi()]
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
		elif argument.begins_with("--region="):
			matchmaking_region = argument.trim_prefix("--region=")
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
		_process_matchmaking(delta)
	elif ready_state == WebSocketPeer.STATE_CLOSED:
		if socket_open:
			socket_open = false
			_set_status("Conexão encerrada. Reconectando...")
			reconnect_delay = 2.0
		if reconnect_delay > 0.0:
			reconnect_delay -= delta
			if reconnect_delay <= 0.0:
				_connect_socket()

func _process_matchmaking(delta: float) -> void:
	if not matchmaking_started or not has_account() or not room_id.is_empty():
		return
	matchmaking_poll_delay -= delta
	if matchmaking_poll_delay > 0.0:
		return
	matchmaking_poll_delay = 2.0
	if not pending_match_id.is_empty():
		accept_matchmaking(pending_match_id)
	elif matchmaking_state.get("state", "idle") == "queued":
		request_matchmaking_status()

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
	if has_account() and room_to_join.is_empty() and not force_create:
		enqueue_matchmaking()
	elif not room_to_join.is_empty():
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

func request_recovery(handle: String) -> void:
	_send("account.recovery.request", {"handle": handle})

func confirm_recovery(handle: String, code: String, new_password: String) -> void:
	_send("account.recovery.confirm", {
		"handle": handle,
		"recoveryCode": code,
		"newPassword": new_password
	})

func logout_account() -> void:
	if has_account():
		cancel_matchmaking()
	account_id = ""
	account_token = ""
	account_profile = {}
	matchmaking_started = false
	matchmaking_state = {"state": "idle"}
	pending_match_id = ""
	account_changed.emit(account_profile)
	matchmaking_changed.emit(matchmaking_state)
	_save_session()

func has_account() -> bool:
	return not account_id.is_empty() and not account_token.is_empty()

func _account_payload(extra: Dictionary = {}) -> Dictionary:
	var payload := {"accountId": account_id, "accessToken": account_token}
	payload.merge(extra, true)
	return payload

func request_profile() -> void:
	if has_account():
		_send("account.profile", _account_payload())

func request_history(limit := 25) -> void:
	if has_account():
		_send("account.history", _account_payload({"limit": limit}))

func request_leaderboard(limit := 25) -> void:
	_send("leaderboard.list", {"limit": limit})

func request_seasons() -> void:
	_send("season.list", {})

func request_season_leaderboard(limit := 25, season_id := "") -> void:
	var payload := {"limit": limit}
	if not season_id.is_empty():
		payload["seasonId"] = season_id
	_send("season.leaderboard", payload)

func enqueue_matchmaking() -> void:
	if not has_account():
		return
	pending_match_id = ""
	matchmaking_poll_delay = 2.0
	_send("matchmaking.enqueue", _account_payload({
		"region": matchmaking_region,
		"boardSize": default_board_size
	}))
	track_event("mobile.matchmaking.enqueued", {
		"region": matchmaking_region,
		"boardSize": default_board_size
	})

func request_matchmaking_status() -> void:
	if has_account():
		_send("matchmaking.status", _account_payload())

func cancel_matchmaking() -> void:
	if has_account():
		_send("matchmaking.cancel", _account_payload())
	pending_match_id = ""
	matchmaking_state = {"state": "idle"}
	matchmaking_changed.emit(matchmaking_state)

func accept_matchmaking(match_id: String) -> void:
	if has_account() and not match_id.is_empty():
		_send("matchmaking.accept", _account_payload({"matchId": match_id}))

func track_event(event_name: String, data: Dictionary = {}) -> void:
	var payload := {
		"sessionId": telemetry_session_id,
		"eventName": event_name,
		"data": data
	}
	if has_account():
		payload.merge(_account_payload(), true)
	_send("telemetry.track", payload)

func _room_identity_payload() -> Dictionary:
	if has_account():
		return _account_payload()
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
	if _has_session():
		_send("action.play_edge", _action_payload({"start": [start.x, start.y], "end": [end.x, end.y]}))

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
	if _has_session():
		_send("action.resolve_duel_round", _action_payload({"duelId": duel_id, "cardIds": card_ids}))

func forfeit_match() -> void:
	if _has_session():
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
			server_instance_id = payload.get("instanceId", "")
			_set_status("Servidor %s • protocolo %s" % [server_instance_id.left(12), PROTOCOL_VERSION])
			track_event("client.connected", {"platform": OS.get_name(), "version": CLIENT_VERSION, "instanceId": server_instance_id})
			_establish_session()
		"account.session":
			account_id = payload.get("account", {}).get("id", "")
			account_token = payload.get("accessToken", "")
			_apply_account(payload.get("account", {}))
			_save_session()
			request_seasons()
			matchmaking_started = false
			begin_matchmaking()
		"account.profile":
			_apply_account(payload)
			_save_session()
			request_seasons()
			matchmaking_started = false
			begin_matchmaking()
		"account.history":
			history_changed.emit(payload.get("matches", []))
		"account.recovery.requested":
			recovery_changed.emit(payload)
		"leaderboard.data":
			leaderboard_changed.emit(payload.get("leaderboard", []))
		"season.data":
			season_changed.emit(payload)
		"season.leaderboard":
			season_leaderboard_changed.emit(payload.get("leaderboard", []))
		"matchmaking.state":
			matchmaking_state = payload
			matchmaking_changed.emit(matchmaking_state)
			var queue_state: String = payload.get("state", "idle")
			if queue_state == "matched":
				pending_match_id = payload.get("match", {}).get("id", "")
				matchmaking_poll_delay = 0.1
				_set_status("Adversário encontrado. Confirmando arena...")
			elif queue_state == "queued":
				pending_match_id = ""
				_set_status("Buscando adversário • faixa ±%d" % payload.get("searchWindow", 100))
			else:
				pending_match_id = ""
		"matchmaking.penalty":
			penalty_changed.emit(payload)
			var penalty: Dictionary = payload.get("penalty", payload)
			var retry_at: int = int(penalty.get("retryAt", penalty.get("expiresAt", 0)))
			var remaining := maxi(0, int((retry_at - Time.get_unix_time_from_system() * 1000.0) / 1000.0))
			_set_status("Fila competitiva bloqueada por %d segundos." % remaining)
		"telemetry.accepted":
			telemetry_accepted.emit(payload)
		"match.progression":
			var local_profile: Dictionary = payload.get("winner", {})
			if local_profile.get("id", "") != account_id:
				local_profile = payload.get("loser", {})
			if local_profile.get("id", "") == account_id:
				_apply_account(local_profile)
			request_history()
			request_season_leaderboard()
		"lobby.rooms":
			var rooms: Array = payload.get("rooms", [])
			lobby_changed.emit(rooms)
			if room_id.is_empty() and room_to_join.is_empty() and not has_account():
				if rooms.is_empty():
					_create_room()
				else:
					room_to_join = rooms[0].get("roomId", "")
					_join_room(room_to_join)
		"lobby.updated":
			lobby_changed.emit(payload.get("rooms", []))
		"presence.updated":
			_apply_presence(payload.get("players", []))
		"session.established":
			room_id = payload.get("roomId", "")
			player_id = payload.get("playerId", "")
			session_token = payload.get("sessionToken", "")
			_apply_snapshot(payload.get("snapshot", {}))
			_apply_private_state(payload.get("privateState", {}))
			_apply_presence(payload.get("presence", []))
			pending_match_id = ""
			matchmaking_state = {"state": "claimed", "matchmaking": payload.get("matchmaking", {})}
			matchmaking_changed.emit(matchmaking_state)
			_save_session()
			track_event("mobile.matchmaking.claimed", {"roomId": room_id, "instanceId": server_instance_id})
			_set_status("Sala %s conectada na réplica %s." % [room_id, server_instance_id.left(12)])
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
			_apply_presence(payload.get("presence", []))
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
			elif code == "MATCH_HOST_PENDING":
				matchmaking_poll_delay = 1.0
			elif code == "MATCHMAKING_COOLDOWN":
				var details: Dictionary = payload.get("details", {})
				penalty_changed.emit(details)
				matchmaking_started = false
				matchmaking_state = {"state": "cooldown", "penalty": details}
				matchmaking_changed.emit(matchmaking_state)
			elif code in ["ROOM_WRITE_CONFLICT", "REVISION_CONFLICT"] and _has_session():
				_send("room.reconnect", {
					"roomId": room_id,
					"playerId": player_id,
					"sessionToken": session_token,
					"lastRevision": revision
				})
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

func _apply_presence(players: Array) -> void:
	presence_state = players
	presence_changed.emit(presence_state)

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
	presence_state = []
	presence_changed.emit(presence_state)
	_save_session()
