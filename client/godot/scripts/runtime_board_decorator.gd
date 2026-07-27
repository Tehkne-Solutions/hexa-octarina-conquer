class_name RuntimeBoardDecoratorService
extends Node

const DECORATION_META := "runtime_pack99_decorated"
const REFRESH_INTERVAL := 0.28
var _elapsed := 0.0
var _connected_session: Node = null
var _board_root: Node3D = null

func _process(delta: float) -> void:
	_elapsed += delta
	if _elapsed < REFRESH_INTERVAL:
		return
	_elapsed = 0.0
	_refresh_scene()

func _refresh_scene() -> void:
	if not AssetRuntime.has_runtime() and not ProgressiveTerrainRuntime.has_runtime():
		return
	var scene := get_tree().current_scene
	if scene == null:
		return
	var board := scene.get_node_or_null("BoardRoot") as Node3D
	if board != _board_root:
		_board_root = board
	if _board_root != null:
		for child in _board_root.get_children():
			_decorate_board_node(child)
	var session := scene.get_node_or_null("NetworkSession")
	if session != _connected_session:
		_connect_session(session)

func _connect_session(session: Node) -> void:
	var callback := Callable(self, "_on_event_received")
	if _connected_session != null and _connected_session.has_signal("event_received") and _connected_session.is_connected("event_received", callback):
		_connected_session.disconnect("event_received", callback)
	_connected_session = session
	if _connected_session != null and _connected_session.has_signal("event_received"):
		_connected_session.connect("event_received", callback)

func _decorate_board_node(node: Node) -> void:
	if bool(node.get_meta(DECORATION_META, false)) or node is not Node3D:
		return
	var node_3d := node as Node3D
	if bool(node_3d.get_meta("runtime_pack99_unit", false)):
		node.set_meta(DECORATION_META, true)
		return
	if node.name.begins_with("Cell_"):
		_add_ground_tile(node_3d)
	elif node.name.begins_with("Pillar_"):
		_add_pillar(node_3d)
	elif node.name.begins_with("Edge"):
		_add_edge(node_3d)
	else:
		return
	node.set_meta(DECORATION_META, true)

func _add_ground_tile(root: Node3D) -> void:
	if ProgressiveTerrainRuntime.has_runtime():
		var terrain_id := _terrain_id_for(root)
		var progressive := ProgressiveTerrainRuntime.create_ground_tile(terrain_id, int(root.get_instance_id() % 3), 0.0021)
		if progressive != null:
			progressive.rotation_degrees.x = -90.0
			progressive.position.y = 0.14
			progressive.modulate.a = 0.9
			root.add_child(progressive)
			return
	var sprite := AssetRuntime.create_billboard("TILE_GRASS_FLAT_CENTER_A_01", 0.0021)
	if sprite == null:
		return
	sprite.name = "RuntimeTerrain"
	sprite.billboard = BaseMaterial3D.BILLBOARD_DISABLED
	sprite.rotation_degrees.x = -90.0
	sprite.position.y = 0.14
	sprite.modulate.a = 0.76
	root.add_child(sprite)

func _terrain_id_for(root: Node3D) -> String:
	var explicit: String = root.get_meta("terrain_id", "")
	if not explicit.is_empty():
		return explicit
	var scene := get_tree().current_scene
	if scene != null:
		var theme: String = scene.get_meta("board_theme", "")
		match theme:
			"prismatic-ruins": return "TERRAIN_RUNIC_STONE"
			"ash-fortress": return "TERRAIN_CORRUPTED"
	return "TERRAIN_GRASS_ANCESTRAL"

func _add_pillar(root: Node3D) -> void:
	var selected := false
	if root is MeshInstance3D and (root as MeshInstance3D).mesh is CylinderMesh:
		selected = ((root as MeshInstance3D).mesh as CylinderMesh).height > 0.9
	var sprite := AssetRuntime.create_billboard("PILLAR_SELECTED_01" if selected else "PILLAR_NEUTRAL_01", 0.0019)
	if sprite == null:
		return
	sprite.name = "RuntimePillar"
	sprite.position.y = 0.44
	sprite.modulate.a = 0.96
	root.add_child(sprite)

func _add_edge(root: Node3D) -> void:
	var asset_id := "EDGE_ARCANE_BUILT_NE_SW_01"
	if root is MeshInstance3D and (root as MeshInstance3D).mesh is BoxMesh:
		var size := ((root as MeshInstance3D).mesh as BoxMesh).size
		if size.z > size.x:
			asset_id = "EDGE_ARCANE_BUILT_NW_SE_01"
	var sprite := AssetRuntime.create_billboard(asset_id, 0.0019)
	if sprite == null:
		return
	sprite.name = "RuntimeEdge"
	sprite.position.y = 0.33
	sprite.modulate.a = 0.92
	root.add_child(sprite)

func _on_event_received(event: Dictionary) -> void:
	if _board_root == null:
		return
	var event_type: String = event.get("type", "")
	var payload: Dictionary = event.get("payload", {})
	var position := _event_position(event_type, payload)
	match event_type:
		"edge.played":
			AssetRuntime.play_billboard_vfx(_board_root, "VFX_CELL_SELECTED_01", position, 0.8, 0.42)
		"card.played":
			AssetRuntime.play_billboard_vfx(_board_root, "VFX_COMBAT_SHIELD_01", position, 1.0, 0.5)
		"duel.round_resolved":
			AssetRuntime.play_nearest_unit_state(_board_root, position, "attack")
			AssetRuntime.play_billboard_vfx(_board_root, "VFX_COMBAT_SLASH_01", position, 1.2, 0.48)

func _event_position(event_type: String, payload: Dictionary) -> Vector3:
	var scene := get_tree().current_scene
	if scene != null and scene.has_method("_event_world_position"):
		var resolved: Variant = scene.call("_event_world_position", event_type, payload)
		if resolved is Vector3:
			return resolved
	return Vector3.ZERO
