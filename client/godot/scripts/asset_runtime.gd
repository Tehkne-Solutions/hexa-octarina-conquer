class_name AssetRuntimeService
extends Node

const RUNTIME_ROOT := "res://assets/runtime"
const REGISTRY_PATH := RUNTIME_ROOT + "/registry/assets-runtime.json"
const DEFAULT_UNIT_ENTITY := "UNIT_RECRUIT_01"
const DEFAULT_FORT_ASSET := "TERR_FORT_NEUTRAL_01"
const DEFAULT_DIRECTION := "SE"

var _assets_by_id: Dictionary = {}
var _runtime_available := false
var _load_error := ""
var _texture_cache: Dictionary = {}

func _ready() -> void:
	reload_registry()

func reload_registry() -> bool:
	_assets_by_id.clear()
	_texture_cache.clear()
	_runtime_available = false
	_load_error = ""
	if not FileAccess.file_exists(REGISTRY_PATH):
		_load_error = "Bootstrap runtime do PACK 99 não encontrado."
		return false
	var file := FileAccess.open(REGISTRY_PATH, FileAccess.READ)
	if file == null:
		_load_error = "Não foi possível abrir %s." % REGISTRY_PATH
		return false
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		_load_error = "Registro runtime inválido."
		return false
	var registry: Dictionary = parsed
	if registry.get("packId", "") != "HOC_PACK_99_FINAL_RUNTIME":
		_load_error = "Registro não pertence ao PACK 99."
		return false
	if registry.get("signature", "") != "Tehkné Solutions":
		_load_error = "Assinatura do registro runtime inválida."
		return false
	for asset in registry.get("assets", []):
		if typeof(asset) != TYPE_DICTIONARY:
			continue
		var asset_id: String = asset.get("id", "")
		if not asset_id.is_empty():
			_assets_by_id[asset_id] = asset
	_runtime_available = not _assets_by_id.is_empty()
	if not _runtime_available:
		_load_error = "Registro runtime sem assets."
	return _runtime_available

func has_runtime() -> bool:
	return _runtime_available

func get_load_error() -> String:
	return _load_error

func has_asset(asset_id: String) -> bool:
	return _assets_by_id.has(asset_id)

func get_asset(asset_id: String) -> Dictionary:
	return _assets_by_id.get(asset_id, {})

func animation_asset_id(entity_id: String, state: String, direction := DEFAULT_DIRECTION) -> String:
	return "%s_%s_%s_01" % [entity_id, state.to_upper(), direction]

func get_asset_res_path(asset_id: String, field := "file") -> String:
	var asset: Dictionary = get_asset(asset_id)
	if asset.is_empty():
		return ""
	var runtime_key := "_runtime%s%s" % [field.left(1).to_upper(), field.substr(1)]
	var relative_path: String = asset.get(runtime_key, "")
	if relative_path.is_empty():
		return ""
	return "%s/%s" % [RUNTIME_ROOT, relative_path]

func load_texture(asset_id: String, field := "file") -> Texture2D:
	var cache_key := "%s:%s" % [asset_id, field]
	if _texture_cache.has(cache_key):
		return _texture_cache[cache_key]
	var resource_path := get_asset_res_path(asset_id, field)
	if resource_path.is_empty() or not ResourceLoader.exists(resource_path):
		return null
	var texture := load(resource_path) as Texture2D
	if texture != null:
		_texture_cache[cache_key] = texture
	return texture

func create_billboard(asset_id: String, pixel_size := 0.0034, modulate := Color.WHITE) -> Sprite3D:
	var texture := load_texture(asset_id)
	if texture == null:
		return null
	var sprite := Sprite3D.new()
	sprite.name = asset_id
	sprite.texture = texture
	sprite.pixel_size = pixel_size
	sprite.centered = true
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	sprite.modulate = modulate
	return sprite

func create_animated_billboard(
	entity_id: String,
	state := "idle",
	direction := DEFAULT_DIRECTION,
	pixel_size := 0.0048,
	modulate := Color.WHITE
) -> AnimatedSprite3D:
	var asset_id := animation_asset_id(entity_id, state, direction)
	var asset: Dictionary = get_asset(asset_id)
	var texture := load_texture(asset_id, "spritesheet")
	if asset.is_empty() or texture == null:
		return null
	var frame_count := maxi(1, int(asset.get("frames", 1)))
	var frame_width := maxi(1, int(texture.get_width() / frame_count))
	var frame_height := texture.get_height()
	var frames := SpriteFrames.new()
	frames.clear("default")
	frames.set_animation_speed("default", maxf(1.0, float(asset.get("fps", 8))))
	frames.set_animation_loop("default", bool(asset.get("loop", state in ["idle", "walk"])))
	for frame_index in range(frame_count):
		var atlas := AtlasTexture.new()
		atlas.atlas = texture
		atlas.region = Rect2(frame_index * frame_width, 0, frame_width, frame_height)
		frames.add_frame("default", atlas)
	var sprite := AnimatedSprite3D.new()
	sprite.name = "RuntimeSprite"
	sprite.sprite_frames = frames
	sprite.animation = "default"
	sprite.pixel_size = pixel_size
	sprite.centered = true
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	sprite.modulate = modulate
	sprite.set_meta("runtime_asset_id", asset_id)
	sprite.play()
	return sprite

func build_unit(parent: Node3D, owner_color: Color, unit: Dictionary, world_position: Vector3, node_name: String) -> Node3D:
	if not _runtime_available:
		return null
	var kind: String = unit.get("kind", "recruit")
	var level: int = unit.get("level", 1)
	if kind == "fortress" or level >= 3:
		return _build_static_structure(parent, DEFAULT_FORT_ASSET, owner_color, world_position, node_name, level)
	if kind == "outpost":
		return _build_static_structure(parent, "TERR_OUTPOST_NEUTRAL_01", owner_color, world_position, node_name, level)
	var entity_id := _unit_entity_id(unit)
	var tint := _entity_tint(entity_id)
	var sprite := create_animated_billboard(entity_id, "idle", DEFAULT_DIRECTION, 0.0048, tint)
	if sprite == null:
		return null
	var root := Node3D.new()
	root.name = node_name
	root.position = world_position
	root.set_meta("runtime_pack99_unit", true)
	root.set_meta("runtime_entity_id", entity_id)
	root.set_meta("runtime_direction", DEFAULT_DIRECTION)
	root.set_meta("runtime_tint", tint)
	parent.add_child(root)
	sprite.position.y = 0.64
	root.add_child(sprite)
	_add_owner_marker(root, owner_color, level)
	return root

func play_unit_state(root: Node3D, state: String, return_to_idle := true) -> bool:
	if root == null or not bool(root.get_meta("runtime_pack99_unit", false)):
		return false
	var entity_id: String = root.get_meta("runtime_entity_id", DEFAULT_UNIT_ENTITY)
	var direction: String = root.get_meta("runtime_direction", DEFAULT_DIRECTION)
	var tint: Color = root.get_meta("runtime_tint", Color.WHITE)
	var replacement := create_animated_billboard(entity_id, state, direction, 0.0048, tint)
	if replacement == null:
		return false
	var current := root.get_node_or_null("RuntimeSprite")
	if current != null:
		current.queue_free()
	replacement.position.y = 0.64
	root.add_child(replacement)
	if return_to_idle and state not in ["idle", "walk", "defeat"]:
		var asset: Dictionary = get_asset(animation_asset_id(entity_id, state, direction))
		var duration := float(asset.get("frames", 1)) / maxf(1.0, float(asset.get("fps", 8)))
		get_tree().create_timer(maxf(0.15, duration)).timeout.connect(func() -> void:
			if is_instance_valid(root):
				play_unit_state(root, "idle", false)
		)
	return true

func play_nearest_unit_state(parent: Node3D, world_position: Vector3, state: String) -> bool:
	var nearest: Node3D = null
	var nearest_distance := INF
	for child in parent.get_children():
		if child is not Node3D or not bool(child.get_meta("runtime_pack99_unit", false)):
			continue
		var distance := (child as Node3D).global_position.distance_squared_to(world_position)
		if distance < nearest_distance:
			nearest_distance = distance
			nearest = child
	return play_unit_state(nearest, state) if nearest != null else false

func play_billboard_vfx(parent: Node3D, asset_id: String, world_position: Vector3, scale_multiplier := 1.0, duration := 0.55) -> bool:
	var sprite := create_billboard(asset_id, 0.0046)
	if sprite == null:
		return false
	sprite.position = world_position + Vector3(0, 0.55, 0)
	sprite.scale = Vector3.ONE * maxf(0.1, scale_multiplier * 0.35)
	sprite.modulate.a = 0.95
	parent.add_child(sprite)
	var tween := parent.create_tween().set_parallel(true)
	tween.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(sprite, "scale", Vector3.ONE * scale_multiplier, duration)
	tween.tween_property(sprite, "modulate:a", 0.0, duration)
	tween.chain().tween_callback(sprite.queue_free)
	return true

func _unit_entity_id(unit: Dictionary) -> String:
	var element: String = unit.get("element", "neutral")
	var level: int = unit.get("level", 1)
	if element == "air":
		return "HERO_RANGER_01"
	if element == "earth" and level >= 2:
		return "HERO_GUARDIAN_01"
	if element == "fire" and level >= 2:
		return "CHAMP_BERSERKER_01"
	return DEFAULT_UNIT_ENTITY

func _entity_tint(entity_id: String) -> Color:
	if entity_id == "CHAMP_BERSERKER_01":
		return Color(1.0, 0.56, 0.48, 1.0)
	if entity_id == "UNIT_RECRUIT_01":
		return Color(0.58, 0.75, 0.62, 1.0)
	return Color.WHITE

func _build_static_structure(parent: Node3D, asset_id: String, owner_color: Color, world_position: Vector3, node_name: String, level: int) -> Node3D:
	var sprite := create_billboard(asset_id, 0.0032)
	if sprite == null:
		return null
	var root := Node3D.new()
	root.name = node_name
	root.position = world_position
	parent.add_child(root)
	sprite.position.y = 0.76
	root.add_child(sprite)
	_add_owner_marker(root, owner_color, level)
	return root

func _add_owner_marker(root: Node3D, owner_color: Color, level: int) -> void:
	var ring := MeshInstance3D.new()
	var mesh := TorusMesh.new()
	mesh.inner_radius = 0.23 + float(level - 1) * 0.018
	mesh.outer_radius = 0.28 + float(level - 1) * 0.018
	ring.mesh = mesh
	ring.rotation_degrees.x = 90.0
	ring.position.y = 0.035
	var material := StandardMaterial3D.new()
	material.albedo_color = owner_color
	material.emission_enabled = true
	material.emission = owner_color
	material.emission_energy_multiplier = 1.35
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring.material_override = material
	root.add_child(ring)
