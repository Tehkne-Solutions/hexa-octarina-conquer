class_name ProgressiveBoardRuntimeService
extends Node

const RUNTIME_ROOT := "res://assets/progressive/PACK_02_BOARD_SYSTEM"
const REGISTRY_PATH := RUNTIME_ROOT + "/registry/board-runtime.json"
const PACK_ID := "HOC_PACK_02_BOARD_SYSTEM_FINAL"
const CANONICAL_PACK_ID := "HOC_PACK_02_BOARD_SYSTEM"
const EXPECTED_ASSETS := 55
const SIGNATURE := "Tehkné Solutions"

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
		_load_error = "PACK 02 progressivo não instalado."
		return false
	var file := FileAccess.open(REGISTRY_PATH, FileAccess.READ)
	if file == null:
		_load_error = "Não foi possível abrir %s." % REGISTRY_PATH
		return false
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		_load_error = "Registro progressivo do tabuleiro inválido."
		return false
	var registry: Dictionary = parsed
	if registry.get("packId", "") != PACK_ID or registry.get("canonicalPackId", "") != CANONICAL_PACK_ID:
		_load_error = "Registro não pertence ao PACK 02."
		return false
	if registry.get("signature", "") != SIGNATURE:
		_load_error = "Assinatura do PACK 02 inválida."
		return false
	if registry.get("version", "") != "1.1.0" or registry.get("status", "") != "installed-progressive":
		_load_error = "PACK 02 não está na versão progressiva validada."
		return false
	var assets: Array = registry.get("assets", [])
	if int(registry.get("assetCount", 0)) != EXPECTED_ASSETS or assets.size() != EXPECTED_ASSETS:
		_load_error = "PACK 02 precisa conter exatamente 55 assets."
		return false
	if not registry.get("unresolved", []).is_empty():
		_load_error = "PACK 02 contém referências não resolvidas."
		return false
	var category_counts := {
		"board-node": 0,
		"board-edge": 0,
		"territory-structure": 0,
	}
	for asset in assets:
		if typeof(asset) != TYPE_DICTIONARY:
			_load_error = "PACK 02 contém entrada de asset inválida."
			_assets_by_id.clear()
			return false
		var asset_id: String = asset.get("id", "")
		if asset_id.is_empty() or _assets_by_id.has(asset_id):
			_load_error = "PACK 02 contém ID vazio ou duplicado."
			_assets_by_id.clear()
			return false
		var category: String = asset.get("category", "")
		if not category_counts.has(category):
			_load_error = "PACK 02 contém categoria inválida."
			_assets_by_id.clear()
			return false
		category_counts[category] += 1
		_assets_by_id[asset_id] = asset
	if category_counts["board-node"] != 6 or category_counts["board-edge"] != 24 or category_counts["territory-structure"] != 25:
		_load_error = "Subpacks do PACK 02 possuem contagem inválida."
		_assets_by_id.clear()
		return false
	_runtime_available = _assets_by_id.size() == EXPECTED_ASSETS
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

func _create_channel(asset_id: String, field: String, pixel_size: float, modulate: Color) -> Sprite3D:
	var texture := load_texture(asset_id, field)
	if texture == null:
		return null
	var sprite := Sprite3D.new()
	sprite.name = field.capitalize()
	sprite.texture = texture
	sprite.pixel_size = pixel_size
	sprite.centered = true
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	sprite.modulate = modulate
	return sprite

func create_board_asset(asset_id: String, pixel_size := 0.0032, modulate := Color.WHITE) -> Node3D:
	if not _runtime_available or not has_asset(asset_id):
		return null
	var base := _create_channel(asset_id, "file", pixel_size, modulate)
	if base == null:
		return null
	var root := Node3D.new()
	root.name = asset_id
	root.set_meta("progressive_pack_id", PACK_ID)
	root.set_meta("progressive_asset_id", asset_id)
	var shadow := _create_channel(asset_id, "shadow", pixel_size, Color(1, 1, 1, 0.92))
	if shadow != null:
		shadow.position.z = -0.002
		root.add_child(shadow)
	root.add_child(base)
	var emissive := _create_channel(asset_id, "emissive", pixel_size, Color(1.08, 1.08, 1.08, 0.94))
	if emissive != null:
		emissive.position.z = 0.002
		root.add_child(emissive)
	return root

func pillar_asset_id(selected: bool, blocked := false, faction := "") -> String:
	if blocked:
		return "PILLAR_BLOCKED_01"
	if selected:
		return "PILLAR_SELECTED_01"
	if faction == "player":
		return "PILLAR_BLUE_01"
	if faction == "enemy":
		return "PILLAR_RED_01"
	return "PILLAR_NEUTRAL_01"

func edge_asset_id(owner: String, vertical: bool) -> String:
	var material := "WOOD"
	if owner == "player":
		material = "ARCANE"
	elif owner == "enemy":
		material = "STONE"
	var orientation := "NE_SW" if vertical else "NW_SE"
	return "EDGE_%s_BUILT_%s_01" % [material, orientation]

func territory_asset_id(stage: int, owner: String) -> String:
	var lineage := ["SIGIL", "CAMP", "OUTPOST", "FORT", "CITADEL"]
	var normalized := clampi(stage, 1, 5)
	var state := "RED" if owner == "enemy" else "BLUE"
	return "TERR_%s_%s_01" % [lineage[normalized - 1], state]
