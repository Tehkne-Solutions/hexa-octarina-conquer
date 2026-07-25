class_name AssetRuntimeService
extends Node

const RUNTIME_ROOT := "res://assets/runtime"
const REGISTRY_PATH := RUNTIME_ROOT + "/registry/assets-runtime.json"
const DEFAULT_UNIT_ASSET := "UNIT_RECRUIT_01_IDLE_BASE_NE_01"
const DEFAULT_FORT_ASSET := "TERR_FORT_NEUTRAL_01"

var _assets_by_id: Dictionary = {}
var _runtime_available := false
var _load_error := ""

func _ready() -> void:
	reload_registry()

func reload_registry() -> bool:
	_assets_by_id.clear()
	_runtime_available = false
	_load_error = ""

	if not FileAccess.file_exists(REGISTRY_PATH):
		_load_error = "PACK 99 ainda não foi instalado."
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
	for asset in registry.get("assets", []):
		if typeof(asset) != TYPE_DICTIONARY:
			continue
		var asset_id: String = asset.get("id", "")
		if not asset_id.is_empty():
			_assets_by_id[asset_id] = asset

	_runtime_available = not _assets_by_id.is_empty()
	if not _runtime_available:
		_load_error = "Registro runtime sem assets instalados."
	return _runtime_available

func has_runtime() -> bool:
	return _runtime_available

func get_load_error() -> String:
	return _load_error

func has_asset(asset_id: String) -> bool:
	return _assets_by_id.has(asset_id)

func get_asset(asset_id: String) -> Dictionary:
	return _assets_by_id.get(asset_id, {})

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
	var resource_path := get_asset_res_path(asset_id, field)
	if resource_path.is_empty() or not ResourceLoader.exists(resource_path):
		return null
	var resource: Resource = load(resource_path)
	return resource as Texture2D

func create_billboard(
	asset_id: String,
	pixel_size := 0.0034,
	modulate := Color.WHITE
) -> Sprite3D:
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

func build_unit(
	parent: Node3D,
	owner_color: Color,
	unit: Dictionary,
	world_position: Vector3,
	node_name: String
) -> Node3D:
	if not _runtime_available:
		return null

	var kind: String = unit.get("kind", "recruit")
	var level: int = unit.get("level", 1)
	var asset_id := DEFAULT_UNIT_ASSET
	var pixel_size := 0.0032
	var height := 0.64

	if kind == "fortress" or level >= 3:
		asset_id = DEFAULT_FORT_ASSET
		pixel_size = 0.0025
		height = 0.78
	elif kind == "outpost":
		asset_id = "TERR_OUTPOST_NEUTRAL_01"
		pixel_size = 0.0028
		height = 0.70

	var sprite := create_billboard(asset_id, pixel_size)
	if sprite == null:
		return null

	var root := Node3D.new()
	root.name = node_name
	root.position = world_position
	parent.add_child(root)

	sprite.position.y = height
	root.add_child(sprite)
	_add_owner_marker(root, owner_color, level)
	return root

func play_billboard_vfx(
	parent: Node3D,
	asset_id: String,
	world_position: Vector3,
	scale_multiplier := 1.0,
	duration := 0.55
) -> bool:
	var sprite := create_billboard(asset_id, 0.0038)
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
