extends Node3D

const UNIT_FACTORY = preload("res://scripts/unit_factory.gd")
const PLAYER_COLORS := [
	Color("4cc9f0"),
	Color("f72585"),
	Color("f9c74f"),
	Color("90be6d")
]

@onready var network = $NetworkSession
@onready var board_root: Node3D = $BoardRoot
@onready var combat_fx: Node3D = $CombatFX
@onready var camera: Camera3D = $Camera3D
@onready var battle_ui: Control = $HUD/BattleUI
@onready var room_label: Label = $HUD/Panel/Margin/VBox/RoomLabel
@onready var turn_label: Label = $HUD/Panel/Margin/VBox/TurnLabel
@onready var lobby_label: Label = $HUD/Panel/Margin/VBox/LobbyLabel
@onready var status_label: Label = $HUD/Panel/Margin/VBox/StatusLabel

var room_state: Dictionary = {}
var selected_point: Variant = null
var board_size := 5
var grid_gap := 1.8
var camera_home := Vector3.ZERO
var online_players := 0

func _ready() -> void:
	network.state_changed.connect(_on_state_changed)
	network.private_state_changed.connect(_on_private_state_changed)
	network.event_received.connect(_on_event_received)
	network.status_changed.connect(_on_status_changed)
	network.lobby_changed.connect(_on_lobby_changed)
	if network.has_signal("presence_changed"):
		network.presence_changed.connect(_on_presence_changed)
	battle_ui.macro_requested.connect(_on_macro_requested)
	battle_ui.expansion_armed.connect(_on_expansion_armed)
	battle_ui.duel_submitted.connect(_on_duel_submitted)
	camera.look_at(Vector3.ZERO, Vector3.UP)
	camera_home = camera.position
	network.start()
	_rebuild_arena()

func _on_state_changed(state: Dictionary) -> void:
	room_state = state
	selected_point = null
	battle_ui.update_public_state(room_state, network.player_id)
	_rebuild_arena()

func _on_private_state_changed(state: Dictionary) -> void:
	battle_ui.update_private_state(state)

func _on_status_changed(text: String) -> void:
	status_label.text = text

func _on_lobby_changed(rooms: Array) -> void:
	var waiting := 0
	var active := 0
	for room in rooms:
		if room.get("status", "") == "waiting":
			waiting += 1
		elif room.get("status", "") == "active":
			active += 1
	lobby_label.text = "Lobby: %d aguardando | %d em batalha | %d online" % [waiting, active, online_players]

func _on_presence_changed(players: Array) -> void:
	online_players = players.size()
	_on_lobby_changed([])

func _on_macro_requested(card_id: String, province_id: String) -> void:
	if not network.is_local_turn():
		_on_status_changed("Cartas macro só podem ser usadas no seu turno.")
		return
	network.play_card(card_id, province_id)

func _on_expansion_armed(_card_id: String) -> void:
	_on_status_changed("Expansão Rúnica armada: escolha dois pilares adjacentes.")

func _on_duel_submitted(duel_id: String, card_ids: Array) -> void:
	network.submit_duel_round(duel_id, card_ids)
	_on_status_changed("Sequência enviada. Aguardando o oponente...")

func _on_event_received(event: Dictionary) -> void:
	var event_type: String = event.get("type", "")
	var payload: Dictionary = event.get("payload", {})
	var position := _event_world_position(event_type, payload)
	match event_type:
		"edge.played":
			combat_fx.play_burst(position, _player_color(payload.get("playerId", "")), 280.0, 0.65)
			if not payload.get("claimedProvinceIds", []).is_empty():
				combat_fx.play_burst(position + Vector3(0, 0.25, 0), Color("fef08a"), 520.0, 1.1)
		"card.played":
			combat_fx.play_burst(position, Color("c084fc"), 460.0, 1.0)
		"duel.cards_submitted":
			combat_fx.play_burst(position, Color("60a5fa"), 340.0, 0.75)
		"duel.round_resolved":
			var resolution: Dictionary = payload.get("resolution", {})
			var winner_id: String = resolution.get("winnerId", "")
			combat_fx.play_duel_impact(position, _player_color(winner_id))
			_shake_camera(0.42)
		"player.joined", "player.reconnected":
			combat_fx.play_burst(Vector3.ZERO, Color("a7f3d0"), 610.0, 0.65)

func _event_world_position(event_type: String, payload: Dictionary) -> Vector3:
	if event_type == "edge.played":
		var edge: Dictionary = payload.get("edge", {})
		var start: Array = edge.get("start", [0, 0])
		var end: Array = edge.get("end", [0, 0])
		return _grid_world((start[0] + end[0]) * 0.5, (start[1] + end[1]) * 0.5, 0.6)
	if event_type.begins_with("duel."):
		var duel_id: String = payload.get("duelId", "")
		for duel in network.room_state.get("duels", []):
			if duel.get("id", "") == duel_id:
				return _province_world(duel.get("provinceId", ""))
	if event_type == "card.played":
		var action_result: Dictionary = payload.get("actionResult", {})
		if action_result.has("province"):
			return _province_world(action_result.get("province", {}).get("id", ""))
		if action_result.has("duelId"):
			for duel in network.room_state.get("duels", []):
				if duel.get("id", "") == action_result.get("duelId", ""):
					return _province_world(duel.get("provinceId", ""))
	return Vector3.ZERO

func _province_world(province_id: String) -> Vector3:
	var board: Dictionary = network.room_state.get("board", {})
	var cells_by_id := {}
	for cell in board.get("cells", []):
		cells_by_id[cell.get("id", "")] = cell
	for province in board.get("provinces", []):
		if province.get("id", "") != province_id:
			continue
		var center := Vector2.ZERO
		var count := 0
		for cell_id in province.get("cellIds", []):
			var cell: Dictionary = cells_by_id.get(cell_id, {})
			if not cell.is_empty():
				center += Vector2(cell.get("x", 0) + 0.5, cell.get("y", 0) + 0.5)
				count += 1
		if count > 0:
			center /= float(count)
			return _grid_world(center.x, center.y, 1.0)
	return Vector3.ZERO

func _shake_camera(strength: float) -> void:
	camera_home = camera.position
	var tween := create_tween()
	for index in range(5):
		var offset := Vector3(
			randf_range(-strength, strength),
			randf_range(-strength * 0.45, strength * 0.45),
			randf_range(-strength, strength)
		)
		tween.tween_property(camera, "position", camera_home + offset, 0.045)
	tween.tween_property(camera, "position", camera_home, 0.08)

func _rebuild_arena() -> void:
	for child in board_root.get_children():
		board_root.remove_child(child)
		child.queue_free()

	var board: Dictionary = room_state.get("board", {})
	board_size = board.get("boardSize", 5)
	grid_gap = clampf(8.0 / maxf(4.0, board_size - 1), 0.7, 1.8)
	_build_ground()
	_build_cells(board.get("cells", []))
	_build_edges(board.get("edges", []))
	_build_points()
	_build_provinces(board.get("provinces", []), board.get("cells", []))
	_update_camera()
	_update_hud(board)

func _build_ground() -> void:
	var extent := float(board_size - 1) * grid_gap + grid_gap * 1.6
	var mesh := BoxMesh.new()
	mesh.size = Vector3(extent, 0.25, extent)
	_add_mesh(mesh, Color("111827"), Vector3(0, -0.25, 0), "ArenaBase", 0.05, 0.9)

func _build_cells(cells: Array) -> void:
	for cell in cells:
		var mesh := BoxMesh.new()
		mesh.size = Vector3(grid_gap * 0.88, 0.22, grid_gap * 0.88)
		var color := _player_color(cell.get("ownerId", "")).darkened(0.48)
		var position := _cell_world(cell.get("x", 0), cell.get("y", 0), 0.0)
		_add_mesh(mesh, color, position, "Cell_%s" % cell.get("id", ""), 0.15, 0.72)

func _build_edges(edges: Array) -> void:
	for edge in edges:
		var start: Array = edge.get("start", [0, 0])
		var end: Array = edge.get("end", [0, 0])
		var mesh := BoxMesh.new()
		if start[0] != end[0]:
			mesh.size = Vector3(grid_gap * 0.88, 0.34, 0.18)
		else:
			mesh.size = Vector3(0.18, 0.34, grid_gap * 0.88)
		var midpoint := Vector2((start[0] + end[0]) * 0.5, (start[1] + end[1]) * 0.5)
		var position := _grid_world(midpoint.x, midpoint.y, 0.35)
		_add_mesh(mesh, _player_color(edge.get("ownerId", "")), position, "Edge", 0.65, 0.3)

func _build_points() -> void:
	for y in range(board_size):
		for x in range(board_size):
			var mesh := CylinderMesh.new()
			mesh.top_radius = 0.12
			mesh.bottom_radius = 0.17
			mesh.height = 0.75 if selected_point != Vector2i(x, y) else 1.15
			var color := Color("dbeafe") if selected_point != Vector2i(x, y) else Color("fef08a")
			var instance := _add_mesh(mesh, color, _grid_world(x, y, mesh.height * 0.5), "Pillar_%d_%d" % [x, y], 0.45, 0.38)
			if selected_point == Vector2i(x, y):
				var material: StandardMaterial3D = instance.material_override
				material.emission_enabled = true
				material.emission = color
				material.emission_energy_multiplier = 1.8

func _build_provinces(provinces: Array, cells: Array) -> void:
	var cells_by_id := {}
	for cell in cells:
		cells_by_id[cell.get("id", "")] = cell
	for province in provinces:
		var province_cells: Array = province.get("cellIds", [])
		if province_cells.is_empty():
			continue
		var center := Vector2.ZERO
		var valid_cells := 0
		for cell_id in province_cells:
			var cell: Dictionary = cells_by_id.get(cell_id, {})
			if cell.is_empty():
				continue
			center += Vector2(cell.get("x", 0) + 0.5, cell.get("y", 0) + 0.5)
			valid_cells += 1
		if valid_cells == 0:
			continue
		center /= float(valid_cells)
		var unit: Dictionary = province.get("unit", {})
		var position := _grid_world(center.x, center.y, 0.18)
		UNIT_FACTORY.build_unit(
			board_root,
			_player_color(province.get("ownerId", "")).lightened(0.12),
			unit,
			position,
			province.get("id", "Province")
		)

func _add_mesh(mesh: PrimitiveMesh, color: Color, position: Vector3, node_name: String, metallic: float, roughness: float) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = node_name
	instance.mesh = mesh
	instance.position = position
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.metallic = metallic
	material.roughness = roughness
	instance.material_override = material
	board_root.add_child(instance)
	return instance

func _update_camera() -> void:
	var radius := maxf(7.0, float(board_size) * grid_gap * 0.9)
	camera.position = Vector3(radius * 0.78, radius * 1.05, radius)
	camera_home = camera.position
	camera.look_at(Vector3.ZERO, Vector3.UP)

func _update_hud(board: Dictionary) -> void:
	var current_player: String = board.get("currentPlayerId", "")
	room_label.text = "Sala %s | Revisão %d | Províncias %d | Online %d" % [
		network.room_id if not network.room_id.is_empty() else "—",
		network.revision,
		board.get("provinces", []).size(),
		online_players
	]
	turn_label.text = ("SEU TURNO" if current_player == network.player_id else "Turno do oponente") + " | Ações %d" % board.get("actionsRemaining", 0)
	turn_label.modulate = _player_color(current_player)

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed):
		return
	if not network.active_local_duel().is_empty():
		_on_status_changed("Resolva o Duelo de Célula pelo painel de cartas.")
		return
	if not network.is_local_turn():
		_on_status_changed("Aguarde o turno do oponente.")
		return
	var point = _point_from_mouse(event.position)
	if point == null:
		selected_point = null
		_rebuild_arena()
		return
	if selected_point == null:
		selected_point = point
		_on_status_changed("Selecione um pilar ortogonalmente adjacente.")
	elif abs(selected_point.x - point.x) + abs(selected_point.y - point.y) == 1:
		if battle_ui.consume_expansion():
			network.play_card("expansion", "", selected_point, point)
		else:
			network.play_edge(selected_point, point)
		selected_point = null
	else:
		selected_point = point
		_on_status_changed("Os pilares precisam ser ortogonalmente adjacentes.")
	_rebuild_arena()

func _point_from_mouse(mouse_position: Vector2) -> Variant:
	var origin := camera.project_ray_origin(mouse_position)
	var direction := camera.project_ray_normal(mouse_position)
	if absf(direction.y) < 0.0001:
		return null
	var distance := (0.35 - origin.y) / direction.y
	if distance <= 0.0:
		return null
	var hit := origin + direction * distance
	var center := float(board_size - 1) * 0.5
	var grid_x := roundi(hit.x / grid_gap + center)
	var grid_y := roundi(hit.z / grid_gap + center)
	if grid_x < 0 or grid_y < 0 or grid_x >= board_size or grid_y >= board_size:
		return null
	var nearest := _grid_world(grid_x, grid_y, 0.35)
	if Vector2(hit.x, hit.z).distance_to(Vector2(nearest.x, nearest.z)) > grid_gap * 0.38:
		return null
	return Vector2i(grid_x, grid_y)

func _grid_world(x: float, y: float, height: float) -> Vector3:
	var center := float(board_size - 1) * 0.5
	return Vector3((x - center) * grid_gap, height, (y - center) * grid_gap)

func _cell_world(x: int, y: int, height: float) -> Vector3:
	return _grid_world(x + 0.5, y + 0.5, height)

func _player_color(target_player_id: String) -> Color:
	var players: Array = room_state.get("players", [])
	for index in range(players.size()):
		if players[index].get("id", "") == target_player_id:
			return PLAYER_COLORS[index % PLAYER_COLORS.size()]
	return Color("64748b")
